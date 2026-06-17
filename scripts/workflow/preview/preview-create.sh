#!/usr/bin/env bash
set -euo pipefail

# Create (or restart) an on-demand Supabase preview branch for a PR, migrate +
# seed it, wire its credentials into the Vercel preview for the PR's git branch,
# and trigger a fresh preview build.
#
# Invoked by .github/workflows/preview-control.yaml on `/preview`.
#
# Idempotent: if the Supabase branch `pr-<PR_NUMBER>` already exists it is
# reused rather than recreated. Vercel env vars are overwritten with --force.
#
# Required environment:
#   GIT_BRANCH                 PR head branch name (e.g. feat/foo) — Vercel only
#   PR_NUMBER                  PR number — Supabase branch identity (pr-<N>)
#   SUPABASE_ACCESS_TOKEN      Supabase management API token
#   SUPABASE_PROJECT_ID        production project ref
#   VERCEL_TOKEN               Vercel auth token
#   VERCEL_ORG_ID              Vercel team/org id
#   VERCEL_PROJECT_ID          Vercel project id
# Optional:
#   PREVIEW_BRANCH_SIZE        Supabase branch compute size (default: micro)
#
# Outputs (appended to $GITHUB_OUTPUT when set):
#   preview_url                the stable git-branch preview alias URL
#   deployment_url             the deployment hash URL from the Vercel API
#
# The Vercel section is isolated in inject_vercel_env() + trigger_vercel_build():
# inject branch-scoped Preview env vars, then create a git-integration deployment
# from the branch HEAD via the REST API so it reads that env and owns the stable
# branch alias. See the comments there for why a CLI `vercel deploy` does not work.

: "${GIT_BRANCH:?GIT_BRANCH is required}"
: "${PR_NUMBER:?PR_NUMBER is required}"
: "${SUPABASE_PROJECT_ID:?SUPABASE_PROJECT_ID is required}"

# Supabase branch identity is the deterministic name `pr-<PR_NUMBER>`, NOT the
# git branch. `supabase branches create` (CLI) has no git-branch binding flag —
# only the (now-disabled) GitHub integration populates the `git_branch` field —
# so a CLI-created branch has a null `git_branch`. Matching on it would never
# find our branch (duplicate creates) and would make the reaper skip it forever
# (it shares the empty-`git_branch` clause with main/production -> unbounded
# cost). The git branch name is kept only for Vercel env scoping + the alias.
BRANCH_NAME="pr-${PR_NUMBER}"

# --- Supabase branch create (idempotent) ------------------------------------

echo "::group::Resolve or create Supabase branch '${BRANCH_NAME}'"

# List existing branches and reuse one already named `pr-<PR_NUMBER>`.
EXISTING_JSON="$(supabase branches list \
  --project-ref "$SUPABASE_PROJECT_ID" \
  --output json 2>/dev/null || echo '[]')"

EXISTING_NAME="$(echo "$EXISTING_JSON" \
  | jq -r --arg n "$BRANCH_NAME" \
    '.[] | select(.name == $n) | .name' \
  | head -n1)"

# Reusing a live branch means its DB still holds the previous schema + seed, so
# migrate+seed must reset first to pick up regenerated migrations / changed seed
# (otherwise drizzle skips already-journaled migrations and seed skips existing
# rows). A freshly-created branch is empty, so no reset is needed.
if [[ -n "$EXISTING_NAME" ]]; then
  echo "Reusing existing Supabase branch: ${EXISTING_NAME}"
  PREVIEW_RESET="1"
else
  echo "Creating Supabase branch '${BRANCH_NAME}' (size: ${PREVIEW_BRANCH_SIZE:-micro})"
  PREVIEW_RESET="0"
  # Explicit name = deterministic identity. --size keeps the branch DB small;
  # micro is enough to run migrate + seed for a fresh preview schema.
  supabase branches create "$BRANCH_NAME" \
    --project-ref "$SUPABASE_PROJECT_ID" \
    --size "${PREVIEW_BRANCH_SIZE:-micro}" \
    --output json >/dev/null
fi
echo "::endgroup::"

# --- Wait for the branch to become healthy ----------------------------------

echo "::group::Wait for branch '${BRANCH_NAME}' to be ready"
ATTEMPTS=0
MAX_ATTEMPTS=30   # ~5 minutes at 10s intervals
until supabase branches get "$BRANCH_NAME" -o env 2>/dev/null | grep -q POSTGRES_URL; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [[ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]]; then
    echo "::error::Branch '${BRANCH_NAME}' did not become ready in time"
    exit 1
  fi
  echo "  branch not ready yet (attempt ${ATTEMPTS}/${MAX_ATTEMPTS})..."
  sleep 10
done
echo "::endgroup::"

# --- Load branch credentials into the environment ---------------------------
# Same recipe as the retired supabase-branch-setup.yaml: `branches get -o env`
# emits KEY="value" lines; strip the quotes and source them.

echo "::group::Load branch credentials"
CREDS_FILE="$(mktemp)"
trap 'rm -f "$CREDS_FILE"' EXIT
supabase branches get "$BRANCH_NAME" -o env \
  | sed 's/="\(.*\)"/=\1/' > "$CREDS_FILE"
# Export every credential so child processes (drizzle-kit, node, vercel) inherit
# them, not just this shell.
set -a
# shellcheck disable=SC1090
source "$CREDS_FILE"
set +a

missing=()
for var in POSTGRES_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
  [[ -z "${!var:-}" ]] && missing+=("$var")
done
if [[ ${#missing[@]} -gt 0 ]]; then
  echo "::error::Missing branch credentials: ${missing[*]}"
  echo "Common causes: SUPABASE_ACCESS_TOKEN expired, or the branch failed to provision."
  exit 1
fi
echo "Branch credentials loaded (project: ${SUPABASE_URL##*/})"
echo "::endgroup::"

# --- Wait for the database to actually accept connections -------------------
# `branches get` returns a connection string as soon as the branch *record*
# exists, but a freshly-provisioned (micro) instance may still be booting and
# refuse connections through the pooler. drizzle-kit migrate (below) is the
# first thing to open a connection, so probe the exact pooled URL it will use
# until a real round-trip succeeds. Without this, migrate races the cold start
# and exits 1 with no Postgres error. (Casework: pr-1524 migrate flake,
# 2026-06-09.) This is a data-plane readiness gate — the "branch ready" loop
# above only confirms the control plane minted credentials, not that Postgres
# answers.

echo "::group::Wait for database to accept connections"
DB_ATTEMPTS=0
DB_MAX_ATTEMPTS=12   # ~2 minutes at 10s intervals
until psql "$POSTGRES_URL" -tAc 'select 1' >/dev/null 2>&1; do
  DB_ATTEMPTS=$((DB_ATTEMPTS + 1))
  if [[ "$DB_ATTEMPTS" -ge "$DB_MAX_ATTEMPTS" ]]; then
    echo "::error::Database for '${BRANCH_NAME}' did not accept connections in time"
    exit 1
  fi
  echo "  database not accepting connections yet (attempt ${DB_ATTEMPTS}/${DB_MAX_ATTEMPTS})..."
  sleep 10
done
echo "Database is accepting connections"
echo "::endgroup::"

# --- Reset (reused branch only) + migrate + seed ----------------------------
# The shared script is the single source of truth for the DB-setup sequence, so
# the `/preview` path here and the push-triggered resync path (preview-resync.sh)
# can never drift. PREVIEW_RESET=1 (set above when reusing a live branch) makes
# it drop + recreate the schema first; the branch creds are already exported.
PREVIEW_RESET="$PREVIEW_RESET" \
PROD_PROJECT_REF="$SUPABASE_PROJECT_ID" \
  bash scripts/workflow/preview/preview-migrate-seed.sh

# --- Vercel wiring ----------------------------------------------------------
# With native Supabase auto-branching disabled, Vercel does NOT receive branch
# DB creds automatically. Two steps, in order:
#   1. inject_vercel_env  — set the branch DB creds as *git-branch-scoped* Preview
#      env vars. A git-integration build for this branch reads these with
#      precedence over the all-branches Preview vars (Vercel's documented "test a
#      branch against a different database" feature).
#   2. trigger_vercel_build — ask Vercel to create a *git-integration* deployment
#      from the branch HEAD (REST API), so it reads the env from step 1 and is
#      assigned the stable `<project>-git-<branch>-<scope>.vercel.app` alias.
# We do NOT use `vercel deploy`: a CLI deploy is not git-branch-linked, so it
# neither owns that alias nor reads branch-scoped env — Vercel's own
# push-triggered build owns the alias (prod-wired). (Casework: pr-1524.)
#
#   env add (CLI):  vercel env add NAME preview <git-branch> --force < value-file
#   deploy (API):   POST /v13/deployments  gitSource:{github, org, repo, ref}
#   auth:           VERCEL_TOKEN + VERCEL_ORG_ID (teamId)
# The CLI is invoked via npx so no global install / setup-node step is needed;
# override $VERCEL for a pinned version or a preinstalled binary.
VERCEL="${VERCEL:-npx --yes vercel@latest}"

# The publishable/anon key may arrive under either name from `branches get`.
# env.ts reads NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? NEXT_PUBLIC_SUPABASE_ANON_KEY.
PUBLISHABLE_KEY="${SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_ANON_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}}"

set_vercel_env() {
  # set_vercel_env <NAME> <VALUE>
  local name="$1" value="$2"
  if [[ -z "$value" ]]; then
    echo "  skip ${name} (empty value)"
    return 0
  fi
  # `vercel env add NAME preview <git-branch>` reads the value from stdin.
  # --force overwrites an existing var for the same target without prompting.
  if printf '%s' "$value" \
    | $VERCEL env add "$name" preview "$GIT_BRANCH" --force --token="$VERCEL_TOKEN" \
    >/dev/null 2>&1; then
    echo "  set ${name}"
  else
    echo "::warning::failed to set Vercel env ${name} for branch ${GIT_BRANCH}"
  fi
}

inject_vercel_env() {
  echo "::group::Inject Vercel env vars (git-branch-scoped preview: ${GIT_BRANCH})"
  : "${VERCEL_TOKEN:?VERCEL_TOKEN is required for Vercel wiring}"
  : "${VERCEL_ORG_ID:?VERCEL_ORG_ID is required for Vercel wiring}"
  : "${VERCEL_PROJECT_ID:?VERCEL_PROJECT_ID is required for Vercel wiring}"
  export VERCEL_ORG_ID VERCEL_PROJECT_ID

  # Client-side (inlined at build time by Next.js):
  set_vercel_env "NEXT_PUBLIC_SUPABASE_URL" "$SUPABASE_URL"
  set_vercel_env "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" "$PUBLISHABLE_KEY"
  set_vercel_env "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$PUBLISHABLE_KEY"

  # Server-side (read at runtime + by migrate-production guard):
  set_vercel_env "POSTGRES_URL" "$POSTGRES_URL"
  set_vercel_env "SUPABASE_URL" "$SUPABASE_URL"
  set_vercel_env "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"
  echo "::endgroup::"
}

wait_for_ready() {
  # wait_for_ready <deployment-id> — bounded poll so the sticky comment posts
  # only once the preview is actually live. Non-fatal: on timeout/error we warn
  # and return 0 (Vercel still finishes the build; the alias updates when ready).
  local id="$1"
  [[ -z "$id" ]] && return 0
  local attempts=0 max=40 json state   # ~6.7 min at 10s intervals
  while ((attempts < max)); do
    json="$(curl -sS \
      "https://api.vercel.com/v13/deployments/${id}?teamId=${VERCEL_ORG_ID}" \
      -H "Authorization: Bearer ${VERCEL_TOKEN}" 2>/dev/null || true)"
    state="$(printf '%s' "$json" | jq -r '.readyState // .status // empty' 2>/dev/null || true)"
    case "$state" in
      READY)
        echo "Deployment ${id} is READY"
        # Capture the alias Vercel actually assigned — authoritative. Vercel
        # hash-truncates a branch alias whose templated label would exceed the
        # 63-char DNS limit, so reconstructing the hostname yields an unresolvable
        # URL for long branch names (PP-9opq). Prefer a "-git-" branch alias from
        # .alias[], else .meta.branchAlias. Read by the PREVIEW_URL block below.
        ASSIGNED_ALIAS="$(printf '%s' "$json" \
          | jq -r '(.alias // []) | map(select(test("-git-"))) | .[0] // empty' 2>/dev/null || true)"
        if [[ -z "$ASSIGNED_ALIAS" ]]; then
          ASSIGNED_ALIAS="$(printf '%s' "$json" | jq -r '.meta.branchAlias // empty' 2>/dev/null || true)"
        fi
        return 0 ;;
      ERROR | CANCELED) echo "::warning::deployment ${id} ended in ${state}"; return 0 ;;
    esac
    attempts=$((attempts + 1))
    echo "  build ${state:-pending} (${attempts}/${max})..."
    sleep 10
  done
  echo "::warning::deployment ${id} not READY within budget; alias updates when it finishes"
  return 0
}

trigger_vercel_build() {
  echo "::group::Trigger git-integration preview build"
  : "${VERCEL_TOKEN:?VERCEL_TOKEN is required for Vercel wiring}"
  : "${VERCEL_ORG_ID:?VERCEL_ORG_ID is required for Vercel wiring}"

  # Create a git-integration deployment from the branch HEAD via the REST API.
  # Unlike `vercel deploy`, this is branch-linked: it reads the branch-scoped
  # env injected above and Vercel assigns it the stable branch alias (which it
  # also re-points to every future push, so the URL survives new commits).
  # Vercel's REST API identifies the GitHub repo by numeric id (the SDK resolves
  # org/repo -> repoId under the hood). GITHUB_REPOSITORY_ID is a default Actions
  # env var; fall back to org/repo strings if it is somehow unset.
  local owner repo payload
  owner="${GITHUB_REPOSITORY%%/*}"
  repo="${GITHUB_REPOSITORY##*/}"
  if [[ -n "${GITHUB_REPOSITORY_ID:-}" ]]; then
    payload="$(jq -n \
      --arg name "${VERCEL_PROJECT_NAME:-pin-point}" \
      --argjson repoId "$GITHUB_REPOSITORY_ID" \
      --arg ref "$GIT_BRANCH" \
      '{name: $name,
        gitSource: {type: "github", repoId: $repoId, ref: $ref}}')"
  else
    payload="$(jq -n \
      --arg name "${VERCEL_PROJECT_NAME:-pin-point}" \
      --arg org "$owner" --arg repo "$repo" --arg ref "$GIT_BRANCH" \
      '{name: $name,
        gitSource: {type: "github", org: $org, repo: $repo, ref: $ref}}')"
  fi

  # Capture body + HTTP status separately so a 4xx surfaces Vercel's error
  # message (the request token is in a header, never echoed; the payload carries
  # no secrets — branch creds live in Vercel's env store, set above).
  local raw http_code body dep_id dep_url
  raw="$(curl -sS -X POST \
    "https://api.vercel.com/v13/deployments?teamId=${VERCEL_ORG_ID}&forceNew=1&skipAutoDetectionConfirmation=1" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    -w $'\n%{http_code}' 2>/dev/null || true)"
  http_code="$(printf '%s' "$raw" | tail -n1)"
  body="$(printf '%s' "$raw" | sed '$d')"

  if [[ "$http_code" =~ ^20 ]]; then
    dep_id="$(printf '%s' "$body" | jq -r '.id // empty')"
    dep_url="$(printf '%s' "$body" | jq -r '.url // empty')"
    DEPLOYMENT_URL="${dep_url:+https://$dep_url}"
    echo "Created git-integration deployment: ${dep_id:-unknown} (${DEPLOYMENT_URL:-no url})"
    wait_for_ready "$dep_id"
  else
    echo "::warning::Vercel deployment API returned HTTP ${http_code:-?}"
    printf '%s' "$body" | jq -r '.error // .' 2>/dev/null | head -c 800
    echo
    DEPLOYMENT_URL=""
  fi
  echo "::endgroup::"
}

inject_vercel_env
DEPLOYMENT_URL=""
ASSIGNED_ALIAS=""   # set by wait_for_ready from the Vercel API (PP-9opq)
trigger_vercel_build

# Preview URL: prefer the alias Vercel actually assigned (captured in
# wait_for_ready), which is authoritative. Vercel hash-truncates a branch alias
# whose templated `<project>-git-<branch-slug>-<scope>.vercel.app` label would
# exceed the 63-char DNS limit, so string-templating the hostname produces an
# unresolvable URL for long branch names (PP-9opq). Fall back to the template
# only when the API alias is unavailable.
if [[ -n "${ASSIGNED_ALIAS:-}" ]]; then
  PREVIEW_URL="https://${ASSIGNED_ALIAS#https://}"
  echo "Preview URL (Vercel-assigned alias): ${PREVIEW_URL}"
else
  PROJECT_NAME="${VERCEL_PROJECT_NAME:-pin-point}"
  TEAM_SLUG="${VERCEL_TEAM_SLUG:-advacar}"
  BRANCH_SLUG="$(echo "$GIT_BRANCH" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')"
  PREVIEW_URL="https://${PROJECT_NAME}-git-${BRANCH_SLUG}-${TEAM_SLUG}.vercel.app"
  echo "::warning::Vercel alias unavailable from API; falling back to templated host (unresolvable if >63 chars): ${PREVIEW_URL}"
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "preview_url=${PREVIEW_URL}"
    echo "deployment_url=${DEPLOYMENT_URL}"
  } >> "$GITHUB_OUTPUT"
fi

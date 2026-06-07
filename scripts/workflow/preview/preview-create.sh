#!/usr/bin/env bash
set -euo pipefail

# Create (or restart) an on-demand Supabase preview branch for a PR, migrate +
# seed it, wire its credentials into the Vercel preview for the PR's git branch,
# and trigger a fresh preview build.
#
# Invoked by .github/workflows/preview-control.yaml on `/preview`.
#
# Idempotent: if a Supabase branch already exists for the git branch, it is
# reused rather than recreated. Vercel env vars are overwritten with --force.
#
# Required environment:
#   GIT_BRANCH                 PR head branch name (e.g. feat/foo)
#   SUPABASE_ACCESS_TOKEN      Supabase management API token
#   SUPABASE_PROJECT_ID        production project ref
#   VERCEL_TOKEN               Vercel auth token
#   VERCEL_ORG_ID              Vercel team/org id
#   VERCEL_PROJECT_ID          Vercel project id
#
# Outputs (appended to $GITHUB_OUTPUT when set):
#   preview_url                the git-branch preview alias URL
#   deployment_url             the deployment URL returned by `vercel deploy`
#
# The Vercel section is isolated in inject_vercel_env() + trigger_vercel_build()
# and is PENDING LIVE VERIFICATION — see comments there. CLI syntax was taken
# from the Vercel CLI docs (vercel env / vercel deploy / global options) but has
# not been run end-to-end against the live project in this environment.

: "${GIT_BRANCH:?GIT_BRANCH is required}"
: "${SUPABASE_PROJECT_ID:?SUPABASE_PROJECT_ID is required}"

# --- Supabase branch create (idempotent) ------------------------------------

echo "::group::Resolve or create Supabase branch for '${GIT_BRANCH}'"

# List existing branches and find one already bound to this git branch.
EXISTING_JSON="$(supabase branches list \
  --project-ref "$SUPABASE_PROJECT_ID" \
  --output json 2>/dev/null || echo '[]')"

EXISTING_NAME="$(echo "$EXISTING_JSON" \
  | jq -r --arg gb "$GIT_BRANCH" \
    '.[] | select(.git_branch == $gb) | .name' \
  | head -n1)"

if [[ -n "$EXISTING_NAME" ]]; then
  echo "Reusing existing Supabase branch: ${EXISTING_NAME}"
  BRANCH_NAME="$EXISTING_NAME"
else
  echo "Creating Supabase branch for git branch '${GIT_BRANCH}'"
  # `supabase branches create` names the branch after the current git branch.
  supabase branches create "$GIT_BRANCH" \
    --project-ref "$SUPABASE_PROJECT_ID" \
    --output json >/dev/null
  BRANCH_NAME="$GIT_BRANCH"
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

# --- Migrate + seed (lifted near-verbatim from supabase-branch-setup.yaml) ---

echo "::group::Run Drizzle migrations"
# Use the pooled connection (IPv4, port 6543) because GitHub Actions runners
# cannot reach the direct connection (IPv6, port 5432). drizzle.config.ts
# prefers POSTGRES_URL_NON_POOLING for directUrl, so point it at the pooled URL
# too. POSTGRES_URL is already exported into this shell from the creds file.
export DRIZZLE_FORCE_PRODUCTION="1"
export POSTGRES_URL_NON_POOLING="$POSTGRES_URL"
pnpm exec drizzle-kit migrate
echo "::endgroup::"

echo "::group::Run seed SQL (triggers + grants)"
psql "$POSTGRES_URL" -f supabase/seed.sql
echo "::endgroup::"

echo "::group::Seed users and data"
NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL" \
SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  node supabase/seed-users.mjs
echo "::endgroup::"

# --- Vercel wiring ----------------------------------------------------------
# PENDING LIVE VERIFICATION. With native Supabase auto-branching disabled,
# Vercel will NOT receive branch DB creds automatically, so we inject them as
# git-branch-scoped preview env vars and trigger a fresh build. NEXT_PUBLIC_*
# vars are inlined at BUILD time, so the env vars MUST be set before the build
# (a cache-reusing redeploy is not enough — hence `vercel deploy --force`).
#
# Vercel CLI reference used:
#   env add:  vercel env add NAME preview <git-branch> --force < value-file
#   deploy:   vercel deploy --target=preview --force   (prints URL on stdout)
#   auth:     VERCEL_TOKEN / VERCEL_ORG_ID / VERCEL_PROJECT_ID env vars
#             (no `vercel link` needed in CI)
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
  printf '%s' "$value" \
    | $VERCEL env add "$name" preview "$GIT_BRANCH" --force --token="$VERCEL_TOKEN" \
    >/dev/null 2>&1 || {
      echo "::warning::failed to set Vercel env ${name} for branch ${GIT_BRANCH}"
    }
  echo "  set ${name}"
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

trigger_vercel_build() {
  echo "::group::Trigger fresh Vercel preview build"
  export VERCEL_ORG_ID VERCEL_PROJECT_ID
  # --force => no build cache, guaranteeing NEXT_PUBLIC_* values are re-inlined
  # from the env vars we just set. stdout is the deployment URL.
  local deployment_url
  if deployment_url="$($VERCEL deploy \
      --target=preview \
      --force \
      --token="$VERCEL_TOKEN" 2>/dev/null)"; then
    echo "Deployment URL: ${deployment_url}"
    DEPLOYMENT_URL="$deployment_url"
  else
    echo "::warning::vercel deploy failed; preview build not triggered"
    DEPLOYMENT_URL=""
  fi
  echo "::endgroup::"
}

inject_vercel_env
DEPLOYMENT_URL=""
trigger_vercel_build

# Stable git-branch preview alias. Vercel slugifies the branch (slashes and
# other non-alphanumerics become hyphens). This is the friendly URL to share.
BRANCH_SLUG="$(echo "$GIT_BRANCH" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')"
PREVIEW_URL="https://pinpoint-git-${BRANCH_SLUG}.vercel.app"

echo "Preview URL (git-branch alias): ${PREVIEW_URL}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "preview_url=${PREVIEW_URL}"
    echo "deployment_url=${DEPLOYMENT_URL}"
  } >> "$GITHUB_OUTPUT"
fi

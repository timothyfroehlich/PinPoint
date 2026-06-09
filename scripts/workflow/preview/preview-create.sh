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
#   preview_url                the git-branch preview alias URL
#   deployment_url             the deployment URL returned by `vercel deploy`
#
# The Vercel section is isolated in inject_vercel_env() + trigger_vercel_build()
# and is PENDING LIVE VERIFICATION — see comments there. CLI syntax was taken
# from the Vercel CLI docs (vercel env / vercel deploy / global options) but has
# not been run end-to-end against the live project in this environment.

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

if [[ -n "$EXISTING_NAME" ]]; then
  echo "Reusing existing Supabase branch: ${EXISTING_NAME}"
else
  echo "Creating Supabase branch '${BRANCH_NAME}' (size: ${PREVIEW_BRANCH_SIZE:-micro})"
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

trigger_vercel_build() {
  echo "::group::Trigger fresh Vercel preview build"
  export VERCEL_ORG_ID VERCEL_PROJECT_ID
  # A bare CLI `vercel deploy` is NOT linked to the git branch, so Vercel gives
  # it neither the branch-scoped env vars nor the stable
  # `<project>-git-<branch>-<scope>.vercel.app` alias (Vercel KB: "branch
  # specific variables and domains not linked to CLI deployments"). Passing git
  # metadata via `-m` links the deployment to the branch, so it inherits the
  # branch-scoped preview env we just set AND is reachable at the stable branch
  # alias computed below. `--force` skips the build cache so NEXT_PUBLIC_* values
  # re-inline from the freshly-set env vars (a cached build keeps stale ones).
  local head_sha owner repo
  head_sha="$(git rev-parse HEAD 2>/dev/null || true)"
  owner="${GITHUB_REPOSITORY%%/*}"
  repo="${GITHUB_REPOSITORY##*/}"

  local -a meta=(
    -m githubDeployment=1
    -m "githubCommitRef=${GIT_BRANCH}"
    -m "githubOrg=${owner}"
    -m "githubRepo=${repo}"
  )
  [[ -n "$head_sha" ]] && meta+=(-m "githubCommitSha=${head_sha}")

  local deployment_url
  if deployment_url="$($VERCEL deploy \
      --target=preview \
      --force \
      --token="$VERCEL_TOKEN" \
      "${meta[@]}" 2>/dev/null)"; then
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

# Stable git-branch preview alias assigned by Vercel to the branch-linked
# deployment above: `<project>-git-<branch-slug>-<scope-slug>.vercel.app`.
# Vercel lowercases the branch and replaces non-alphanumerics with hyphens.
# Project/scope are overridable but default to this project's bespoke values.
# (Caveat: very long branch names overflow the 63-char DNS label and Vercel
# falls back to a hashed alias — keep preview branch names short.)
PROJECT_NAME="${VERCEL_PROJECT_NAME:-pin-point}"
TEAM_SLUG="${VERCEL_TEAM_SLUG:-advacar}"
BRANCH_SLUG="$(echo "$GIT_BRANCH" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')"
PREVIEW_URL="https://${PROJECT_NAME}-git-${BRANCH_SLUG}-${TEAM_SLUG}.vercel.app"

echo "Preview URL (git-branch alias): ${PREVIEW_URL}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "preview_url=${PREVIEW_URL}"
    echo "deployment_url=${DEPLOYMENT_URL}"
  } >> "$GITHUB_OUTPUT"
fi

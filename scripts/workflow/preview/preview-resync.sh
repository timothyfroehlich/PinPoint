#!/usr/bin/env bash
set -euo pipefail

# Re-sync an EXISTING preview branch DB after a push that changed migrations or
# seed. Invoked by .github/workflows/preview-sync.yaml on `pull_request`
# synchronize, path-filtered to drizzle/seed/schema files.
#
# Why this exists: `/preview` only runs migrate+seed when someone types the
# comment. Every later push just triggers Vercel's own git-integration build,
# which serves new code against a branch DB still on the OLD schema/seed. So a
# pushed migration appears "not applied" and changed seed "not updated" until
# you remember to re-comment `/preview`. This closes that gap automatically.
#
# Zero-cost guarantee: if there is NO live `pr-<N>` branch (the PR never opted
# in via `/preview`, or it was reaped), this exits 0 without doing anything —
# pushes never provision a branch. Only an already-opted-in PR gets re-synced.
#
# Required environment:
#   PR_NUMBER               PR number — Supabase branch identity (pr-<N>)
#   SUPABASE_ACCESS_TOKEN   Supabase management API token
#   SUPABASE_PROJECT_ID     production project ref

: "${PR_NUMBER:?PR_NUMBER is required}"
: "${SUPABASE_PROJECT_ID:?SUPABASE_PROJECT_ID is required}"

BRANCH_NAME="pr-${PR_NUMBER}"

# --- Gate: only act when a live branch already exists -----------------------
echo "::group::Check for an active preview branch '${BRANCH_NAME}'"
EXISTING_JSON="$(supabase branches list \
  --project-ref "$SUPABASE_PROJECT_ID" \
  --output json 2>/dev/null || echo '[]')"

EXISTING_NAME="$(echo "$EXISTING_JSON" \
  | jq -r --arg n "$BRANCH_NAME" \
    '.[] | select(.name == $n) | .name' \
  | head -n1)"

if [[ -z "$EXISTING_NAME" ]]; then
  echo "No active preview branch for PR #${PR_NUMBER}; nothing to re-sync."
  echo "::endgroup::"
  exit 0
fi
echo "Active preview branch found: ${EXISTING_NAME}"
echo "::endgroup::"

# --- Load branch credentials into the environment ---------------------------
# `branches get -o env` emits KEY="value" lines; strip the quotes and source.
echo "::group::Load branch credentials"
CREDS_FILE="$(mktemp)"
trap 'rm -f "$CREDS_FILE"' EXIT
supabase branches get "$BRANCH_NAME" -o env \
  | sed 's/="\(.*\)"/=\1/' > "$CREDS_FILE"
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

# --- Wait for the database to accept connections ----------------------------
# A warm reused branch usually answers immediately, but guard against a branch
# that was paused/scaling. (Same data-plane readiness gate as preview-create.)
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

# --- Reset + migrate + seed (shared with preview-create.sh) -----------------
# A resync always resets: the branch is live, so its DB holds the previous
# schema + seed that this push is meant to replace.
PREVIEW_RESET="1" \
PROD_PROJECT_REF="$SUPABASE_PROJECT_ID" \
  bash scripts/workflow/preview/preview-migrate-seed.sh

echo "Preview branch '${BRANCH_NAME}' re-synced to the pushed schema + seed."

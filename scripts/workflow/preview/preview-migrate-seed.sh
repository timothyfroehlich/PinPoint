#!/usr/bin/env bash
set -euo pipefail

# Reset (optional) + migrate + seed an on-demand Supabase preview branch DB.
#
# This is the SINGLE source of truth for the preview DB-setup sequence. It is
# called by BOTH:
#   - preview-create.sh   (on `/preview`: create-or-restart the branch)
#   - preview-resync.sh   (on a migration/seed push to a PR with a live branch)
# so the two paths can never drift. A PR that needs an extra demo seed adds it
# HERE (in seed_branch), not in either caller. (Casework: PR #1388 previews
# served stale schema/seed because `/preview` reused a live branch without
# resetting, and pushes never re-ran migrate/seed at all — PP preview drift.)
#
# Requires these in the environment (loaded from `supabase branches get -o env`
# by the caller):
#   POSTGRES_URL                branch transaction pooler (:6543) connection
#   SUPABASE_URL                branch API URL
#   SUPABASE_SERVICE_ROLE_KEY   branch service-role key (seed-users)
# Optional:
#   PREVIEW_RESET=1             drop + recreate the schema before migrating, so
#                               regenerated migrations and changed seed content
#                               actually take. Set when reusing a live branch;
#                               leave unset for a freshly-created (empty) branch.

: "${POSTGRES_URL:?POSTGRES_URL is required (load branch creds first)}"
: "${SUPABASE_URL:?SUPABASE_URL is required (load branch creds first)}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is required (load branch creds first)}"

# --- Reset (only when reusing a live branch) --------------------------------
# drizzle-kit migrate is journaled, so on a reused branch it skips any migration
# whose hash is already recorded — a regenerated/amended migration would never
# re-apply. The seed scripts are skip-if-exists, so changed seed data would not
# update either. A clean reset before migrate+seed makes both deterministic.
if [[ "${PREVIEW_RESET:-0}" == "1" ]]; then
  echo "::group::Reset branch database (reused branch)"
  node scripts/reset-preview-db.mjs
  echo "::endgroup::"
fi

# --- Migrate ----------------------------------------------------------------
echo "::group::Run Drizzle migrations"
# drizzle-kit reads POSTGRES_URL_NON_POOLING as its (direct) migrate URL. The
# branch's POSTGRES_URL is the :6543 TRANSACTION pooler, which does not reliably
# support the DDL / prepared statements a migration run issues (see the warning
# in drizzle.config.ts) — the suspected cause of "migrate exits 1 with no
# surfaced Postgres error" (PP-l9qb). Use the SESSION-mode pooler instead: same
# host, port 5432, IPv4-reachable from runners AND DDL-capable. (The *direct* db
# host on :5432 is IPv6 and unreachable from runners — a different endpoint.)
export DRIZZLE_FORCE_PRODUCTION="1"
migrate_url="${POSTGRES_URL/:6543/:5432}"
export POSTGRES_URL_NON_POOLING="$migrate_url"
echo "migrate connection: $(printf '%s' "$migrate_url" | sed -E 's#://[^@]+@#://***@#')"
# Cold-start race: a freshly-provisioned branch can fail the first migrate ~3s
# in (no surfaced Postgres error) yet succeed on a warm retry against the SAME
# endpoint (evidence: PR #1388 run 27481880209 cold-failed, run 27482214047
# warm-passed on the identical :6543 url). The `select 1` readiness gate in the
# caller does not cover this, so retry migrate itself with a short backoff.
# Migrations are journaled + per-migration transactional, so a retry re-applies
# cleanly. Pipe through `tr '\r' '\n'` so drizzle-kit's spinner can't bury a
# real error behind carriage-return overwrites; pipefail preserves its exit code.
migrate_attempt=0
migrate_max=4
until pnpm exec drizzle-kit migrate 2>&1 | tr '\r' '\n'; do
  migrate_attempt=$((migrate_attempt + 1))
  if [[ "$migrate_attempt" -ge "$migrate_max" ]]; then
    echo "::error::drizzle-kit migrate failed after ${migrate_attempt} attempts"
    exit 1
  fi
  echo "migrate failed (cold-start race?); retrying in 10s (${migrate_attempt}/${migrate_max})..."
  sleep 10
done
echo "::endgroup::"

# --- Seed -------------------------------------------------------------------
echo "::group::Run seed SQL (triggers + grants)"
psql "$POSTGRES_URL" -f supabase/seed.sql
echo "::endgroup::"

echo "::group::Seed users and data"
NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL" \
SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  node supabase/seed-users.mjs
echo "::endgroup::"

# PR-specific demo seeds go below this line (run only if their script exists, so
# this stays a no-op on branches that don't carry them). Example for PR #1388:
#   [[ -f supabase/seed-machine-settings.mjs ]] && {
#     echo "::group::Seed machine settings demo"
#     node supabase/seed-machine-settings.mjs
#     echo "::endgroup::"
#   }

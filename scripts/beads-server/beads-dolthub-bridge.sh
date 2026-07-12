#!/usr/bin/env bash
# beads-dolthub-bridge.sh — async bridge between the live Dolt SQL server and
# DoltHub (advacar/pinpoint-beads).
#
# Run on the Bazzite host on a ~15-minute timer (beads-dolthub-bridge.timer).
# It commits any working-set drift, pulls DoltHub (in case an off-tailnet cloud
# Claude session pushed), then pushes local commits back up. DoltHub is demoted
# to an async bridge + off-machine backup; the shared server is the source of
# truth on the tailnet.
#
# LOUD FAILURE — deliberately NOT fail-open (contrast the huddle hooks, cf.
# PP-0b7p). Any step failing exits non-zero so systemd marks the unit `failed`
# and it stays failed until a human restarts it. On a pull CONFLICT we do NOT
# leave the live server sitting in a conflicted working set that both machines
# read/write: we immediately roll the merge back via DOLT_MERGE('--abort'),
# alert, and stop (nonzero). A human resolves before re-enabling the timer.
#
# Required env:
#   BEADS_DOLT_PASSWORD  — password for the `beads` SQL user (env only, never
#                          on disk). Sourced from the unit's environment.
# Optional env (defaults suit the SETUP.md layout):
#   BEADS_SERVER_HOST    (default 100.87.228.116)
#   BEADS_SERVER_PORT    (default 3306)
#   BEADS_SERVER_USER    (default beads)
#   BEADS_DB             (default PP)

set -euo pipefail

HOST="${BEADS_SERVER_HOST:-100.87.228.116}"
PORT="${BEADS_SERVER_PORT:-3306}"
USER="${BEADS_SERVER_USER:-beads}"
DB="${BEADS_DB:-PP}"

log() { printf '[beads-bridge] %s\n' "$*" >&2; }
die() { printf '[beads-bridge] ERROR: %s\n' "$*" >&2; exit 1; }

command -v bd >/dev/null 2>&1 || die "bd not found on PATH"
command -v dolt >/dev/null 2>&1 || die "dolt not found on PATH"
[[ -n "${BEADS_DOLT_PASSWORD:-}" ]] || die "BEADS_DOLT_PASSWORD not set"

# dolt SQL helper against the live server (used for the abort path). Uses the
# same env password; --result-format null keeps output quiet.
dolt_sql() {
  dolt sql \
    --host "$HOST" --port "$PORT" \
    --user "$USER" --password "$BEADS_DOLT_PASSWORD" \
    --use-db "$DB" \
    --query "$1"
}

# 1. Commit any uncommitted working-set drift so pull has a clean base.
log "commit (flush working set)"
bd dolt commit >&2 || die "bd dolt commit failed"

# 2. Pull DoltHub. A conflict is the dangerous case — abort it on the server so
#    neither machine reads/writes a conflicted working set, then stop loudly.
log "pull DoltHub"
pull_rc=0
pull_out=$(bd dolt pull 2>&1) || pull_rc=$?
printf '%s\n' "$pull_out" >&2
if [[ "$pull_rc" -ne 0 ]]; then
  if printf '%s' "$pull_out" | grep -qiE 'conflict|operator resolution'; then
    log "PULL CONFLICT — aborting the merge on the live server (DOLT_MERGE --abort)"
    if dolt_sql "CALL DOLT_MERGE('--abort');" >&2; then
      log "merge aborted; working set restored to pre-pull HEAD"
    else
      log "DOLT_MERGE('--abort') FAILED — server may be in a conflicted state; manual intervention required"
    fi
    die "DoltHub pull hit a merge conflict — bridge stopped. Resolve manually, then: systemctl --user restart beads-dolthub-bridge.timer"
  fi
  die "bd dolt pull failed (non-conflict): $pull_out"
fi

# 3. Push local commits up to DoltHub.
log "push DoltHub"
bd dolt push >&2 || die "bd dolt push failed"

log "bridge cycle complete"

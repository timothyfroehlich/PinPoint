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
# read/write: we verify whether unresolved conflicts remain, abort an active
# merge when needed, verify again, alert, and stop (nonzero). A human resolves
# the remote divergence before re-enabling the timer.
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

PINPOINT_DIR="${PINPOINT_DIR:-$HOME/Code/PinPoint}"
COMPAT_FILE="$PINPOINT_DIR/scripts/beads-compatibility.json"

command -v bd >/dev/null 2>&1 || die "bd not found on PATH"
command -v dolt >/dev/null 2>&1 || die "dolt not found on PATH"
[[ -n "${BEADS_DOLT_PASSWORD:-}" ]] || die "BEADS_DOLT_PASSWORD not set"

if [[ ! -f "$COMPAT_FILE" ]]; then
  die "compatibility manifest not found at $COMPAT_FILE"
fi

BD_PINNED="$(sed -nE 's/^[[:space:]]*"bd"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$COMPAT_FILE" | head -n1 || true)"
DOLT_PINNED="$(sed -nE 's/^[[:space:]]*"dolt"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$COMPAT_FILE" | head -n1 || true)"

[[ -n "$BD_PINNED" ]] || die "could not parse \"bd\" version from $COMPAT_FILE"
[[ -n "$DOLT_PINNED" ]] || die "could not parse \"dolt\" version from $COMPAT_FILE"

bd_raw="$(bd version 2>&1 || true)"
bd_ver="$(printf '%s\n' "$bd_raw" | sed -nE 's/^bd version ([0-9]+\.[0-9]+\.[0-9]+).*/\1/p' | head -n1 || true)"
if [[ "$bd_ver" != "$BD_PINNED" ]]; then
  die "bd $bd_ver != pinned $BD_PINNED from $COMPAT_FILE — refusing bridge cycle"
fi

dolt_raw="$(dolt version 2>&1 || true)"
dolt_ver="$(printf '%s\n' "$dolt_raw" | sed -nE 's/^dolt version ([0-9]+\.[0-9]+\.[0-9]+).*/\1/p' | head -n1 || true)"
if [[ "$dolt_ver" != "$DOLT_PINNED" ]]; then
  die "dolt $dolt_ver != pinned $DOLT_PINNED from $COMPAT_FILE — refusing bridge cycle"
fi

log "bd $bd_ver and dolt $dolt_ver match compatibility contract ($COMPAT_FILE)"

# Dolt connection options are global flags and must precede the `sql`
# subcommand. The server is tailnet-local and does not serve TLS.
dolt_sql() {
  dolt \
    --host "$HOST" --port "$PORT" \
    --user "$USER" --password "$BEADS_DOLT_PASSWORD" \
    --no-tls --use-db "$DB" \
    sql --result-format csv \
    --query "$1"
}

merge_in_progress() {
  local output is_merging
  if ! output="$(dolt_sql "SELECT is_merging FROM dolt_merge_status;")"; then
    log "failed to inspect dolt_merge_status on the live server"
    return 1
  fi

  is_merging="$(printf '%s\n' "$output" | tail -n1 | tr -d '\r')"
  if [[ ! "$is_merging" =~ ^[01]$ ]]; then
    log "unexpected merge-status response from the live server: $output"
    return 1
  fi
  printf '%s\n' "$is_merging"
}

# 1. Commit any uncommitted working-set drift so pull has a clean base.
log "commit (flush working set)"
bd dolt commit >&2 || die "bd dolt commit failed"

# 2. Pull DoltHub. bd normally restores the pre-pull working set after a
#    conflict. Verify that claim against the server's merge status; abort only
#    if a merge actually remains active, then verify once more before stopping
#    loudly. `dolt_merge_status` covers row and schema conflicts.
log "pull DoltHub"
pull_rc=0
pull_out=$(bd dolt pull 2>&1) || pull_rc=$?
printf '%s\n' "$pull_out" >&2
if [[ "$pull_rc" -ne 0 ]]; then
  if printf '%s' "$pull_out" | grep -qiE 'conflict|operator resolution'; then
    log "PULL CONFLICT — checking whether a merge remains active on the live server"
    if ! is_merging="$(merge_in_progress)"; then
      die "could not verify live-server merge state; manual intervention required"
    fi

    if [[ "$is_merging" -eq 0 ]]; then
      log "pull restored the pre-merge working set; no merge remains active"
    else
      log "a merge remains active — aborting it"
      if ! dolt_sql "CALL DOLT_MERGE('--abort');" >&2; then
        die "DOLT_MERGE('--abort') failed; manual intervention required"
      fi
      if ! is_merging="$(merge_in_progress)"; then
        die "merge abort returned but merge state could not be verified"
      fi
      if [[ "$is_merging" -ne 0 ]]; then
        die "merge abort returned but a merge remains active"
      fi
      log "merge aborted; no merge remains active"
    fi
    die "DoltHub pull hit a merge conflict — bridge stopped. Resolve manually, then: systemctl --user restart beads-dolthub-bridge.timer"
  fi
  die "bd dolt pull failed (non-conflict): $pull_out"
fi

# 3. Push local commits up to DoltHub.
log "push DoltHub"
bd dolt push >&2 || die "bd dolt push failed"

log "bridge cycle complete"

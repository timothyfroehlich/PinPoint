#!/usr/bin/env bash
# dolt-sql-server.sh — start dolt sql-server after validating version against PinPoint manifest.
#
# Sourced/executed under user-global mise on Bazzite. Validates that the active
# dolt binary matches scripts/beads-compatibility.json in the PinPoint repository
# before starting the server, preventing silent version drift from mutating the
# shared beads database.

set -euo pipefail

PINPOINT_DIR="${PINPOINT_DIR:-$HOME/Code/PinPoint}"
COMPAT_FILE="$PINPOINT_DIR/scripts/beads-compatibility.json"

log() { printf '[dolt-sql-server] %s\n' "$*" >&2; }
die() { printf '[dolt-sql-server] ERROR: %s\n' "$*" >&2; exit 1; }

command -v dolt >/dev/null 2>&1 || die "dolt not found on PATH"

if [[ ! -f "$COMPAT_FILE" ]]; then
  die "compatibility manifest not found at $COMPAT_FILE"
fi

DOLT_PINNED="$(sed -nE 's/^[[:space:]]*"dolt"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$COMPAT_FILE" | head -n1 || true)"
[[ -n "$DOLT_PINNED" ]] || die "could not parse \"dolt\" version from $COMPAT_FILE"

dolt_raw="$(dolt version 2>&1 || true)"
dolt_ver="$(printf '%s\n' "$dolt_raw" | sed -nE 's/^dolt version ([0-9]+\.[0-9]+\.[0-9]+).*/\1/p' | head -n1 || true)"
[[ -n "$dolt_ver" ]] || die "could not parse version from 'dolt version': $dolt_raw"

if [[ "$dolt_ver" != "$DOLT_PINNED" ]]; then
  die "dolt $dolt_ver != pinned $DOLT_PINNED from $COMPAT_FILE — refusing to start server against shared DB"
fi

log "dolt $dolt_ver matches compatibility contract ($COMPAT_FILE) — starting sql-server"
exec dolt sql-server "$@"

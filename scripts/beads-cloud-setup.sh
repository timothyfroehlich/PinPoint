#!/usr/bin/env bash
# beads-cloud-setup.sh — install the beads/dolt binaries for a Claude cloud env.
#
# This is the ENVIRONMENT SETUP script, run once at container provisioning —
# before the agent starts, and (unlike beads-cloud-init.sh) with NO access to the
# claude.ai environment variables. Its whole job is to put two binaries on PATH:
#   - dolt (the storage engine, PINNED — see below)
#   - bd   (beads, PINNED — see below)
# The agent then runs scripts/beads-cloud-init.sh, which materializes the DoltHub
# credential and clones the shared DB.
#
# WHY THIS LIVES IN THE REPO. The claude.ai environment's "Setup script" field
# used to hold this inline. That copy could not be reviewed or diffed, and its
# version pins silently drifted. Moving the body here makes it reviewable and
# collapses the pin to a SINGLE source of truth: scripts/beads-compatibility.json.
# The UI field is now just a one-line shim — the repo is already cloned at
# container-provision time, so the shim locates the checkout and runs this script:
#
#     bash "$(ls -d ~/PinPoint /home/*/PinPoint /root/PinPoint 2>/dev/null | head -1)/scripts/beads-cloud-setup.sh"
#
# It locates rather than hardcodes because (verified 2026-08-17) setup runs as
# root with $HOME=/root while the checkout is at /home/user/PinPoint — so a plain
# ~/PinPoint resolves to /root/PinPoint and misses it. This script itself uses
# BASH_SOURCE below, so it works no matter which of those paths invoked it.
#
# THE PINS ARE READ FROM COMPATIBILITY CONTRACT, NOT DUPLICATED. bd and dolt are
# installed at exactly the versions this script parses out of
# scripts/beads-compatibility.json. So bumping the pin is an edit to the manifest;
# the installed binaries and runtime guards move together and cannot disagree.
# (Rationale for exact pins: an accidental newer release, e.g. bd 1.2.1 on
# 2026-08-16, migrated the shared DB to a schema no supported binary could read
# and locked every client out for two days. An exact pin fails loud; a floor fails
# silent.) The bump is a weekly-chores item.

set -euo pipefail

log()  { printf '[beads-cloud-setup] %s\n' "$*" >&2; }
die()  { printf '[beads-cloud-setup] ERROR: %s\n' "$*" >&2; exit 1; }

# Resolve this script's directory so the pin read below works regardless of the
# setup script's cwd (it runs from $HOME, not the repo root).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPAT_FILE="$SCRIPT_DIR/beads-compatibility.json"

# --- The pins: read from the compatibility manifest (single source of truth). --
[[ -f "$COMPAT_FILE" ]] || die "cannot find $COMPAT_FILE — is this the PinPoint checkout?"
BD_VER="$(sed -nE 's/^[[:space:]]*"bd"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$COMPAT_FILE" | head -n1 || true)"
[[ -n "$BD_VER" ]] || die "could not parse \"bd\" version from $COMPAT_FILE"
DOLT_VER="$(sed -nE 's/^[[:space:]]*"dolt"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$COMPAT_FILE" | head -n1 || true)"
[[ -n "$DOLT_VER" ]] || die "could not parse \"dolt\" version from $COMPAT_FILE"
# ------------------------------------------------------------------------------

BIN=/usr/local/bin
export PATH="$BIN:$PATH"

# dolt: pinned to the version read above. Download by exact tag.
log "installing dolt $DOLT_VER (pinned via beads-compatibility.json)"
DOLT_TAG="v${DOLT_VER}"
curl -fsSL -o /tmp/dolt.tgz \
  "https://github.com/dolthub/dolt/releases/download/${DOLT_TAG}/dolt-linux-amd64.tar.gz"
tar xzf /tmp/dolt.tgz -C /tmp
install /tmp/dolt-linux-amd64/bin/dolt "$BIN/dolt"

# bd: pinned to the version read above. Download by exact tag — no latest-tag
# resolution, which is exactly the drift this rewrite removes.
log "installing bd $BD_VER (pinned via beads-compatibility.json)"
BD_TAG="v${BD_VER}"
curl -fsSL -o /tmp/bd.tgz \
  "https://github.com/steveyegge/beads/releases/download/${BD_TAG}/beads_${BD_VER}_linux_amd64.tar.gz"
tar xzf /tmp/bd.tgz -C /tmp
install /tmp/bd "$BIN/bd"

log "verifying installed versions:"
dolt_installed="$(dolt version 2>&1 | sed -nE 's/^dolt version ([0-9]+\.[0-9]+\.[0-9]+).*/\1/p' | head -n1 || true)"
[[ "$dolt_installed" == "$DOLT_VER" ]] \
  || die "installed dolt version ($dolt_installed) does not match pinned $DOLT_VER"

# bd's tarball binary needs libicu; some base images lack it and bd won't print
# its version until it's present. Install on that failure, then re-check.
if ! bd version >&2; then
  log "bd failed to link — installing libicu and retrying"
  apt-get update -qq && apt-get install -y libicu-dev
fi
bd_installed="$(bd version 2>&1 | sed -nE 's/^bd version ([0-9]+\.[0-9]+\.[0-9]+).*/\1/p' | head -n1 || true)"
[[ "$bd_installed" == "$BD_VER" ]] \
  || die "installed bd version ($bd_installed) does not match pinned $BD_VER"

log "done — dolt $DOLT_VER + bd $BD_VER on PATH; agent runs scripts/beads-cloud-init.sh next"

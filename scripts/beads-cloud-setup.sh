#!/usr/bin/env bash
# beads-cloud-setup.sh — install the beads/dolt binaries for a Claude cloud env.
#
# This is the ENVIRONMENT SETUP script, run once at container provisioning —
# before the agent starts, and (unlike beads-cloud-init.sh) with NO access to the
# claude.ai environment variables. Its whole job is to put two binaries on PATH:
#   - dolt (the storage engine; version-agnostic, tracks latest)
#   - bd   (beads, PINNED — see below)
# The agent then runs scripts/beads-cloud-init.sh, which materializes the DoltHub
# credential and clones the shared DB.
#
# WHY THIS LIVES IN THE REPO. The claude.ai environment's "Setup script" field
# used to hold this inline. That copy could not be reviewed or diffed, and its
# bd-version pin silently drifted (a leftover "resolve latest tag" block clobbered
# the literal, so it kept installing latest). Moving the body here makes it
# reviewable and collapses the pin to a SINGLE source of truth. The UI field is
# now just a one-line shim — the repo is already cloned at container-provision
# time (verified 2026-08-16: setup cwd is $HOME, the checkout is at ~/PinPoint):
#
#     bash ~/PinPoint/scripts/beads-cloud-setup.sh
#
# THE PIN IS READ, NOT DUPLICATED. bd is installed at exactly the version this
# script parses out of beads-cloud-init.sh's BD_PINNED_VERSION. So bumping the pin
# is a one-line edit to beads-cloud-init.sh; the installed binary and the runtime
# guard move together and cannot disagree. (Rationale for an exact pin at all: an
# accidental newer release, bd 1.2.1 on 2026-08-16, migrated the shared DB to a
# schema no supported binary could read and locked every client out for two days.
# An exact pin fails loud; a floor fails silent.) The bump is a weekly-chores item.

set -euo pipefail

log()  { printf '[beads-cloud-setup] %s\n' "$*" >&2; }
die()  { printf '[beads-cloud-setup] ERROR: %s\n' "$*" >&2; exit 1; }

# Resolve this script's directory so the pin read below works regardless of the
# setup script's cwd (it runs from $HOME, not the repo root).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INIT_SCRIPT="$SCRIPT_DIR/beads-cloud-init.sh"

# --- The pin: read it from the init script, the single source of truth. --------
[[ -f "$INIT_SCRIPT" ]] || die "cannot find $INIT_SCRIPT — is this the PinPoint checkout?"
BD_VER="$(sed -nE 's/^BD_PINNED_VERSION="([0-9]+\.[0-9]+\.[0-9]+)".*/\1/p' "$INIT_SCRIPT" | head -n1 || true)"
[[ -n "$BD_VER" ]] || die "could not parse BD_PINNED_VERSION from $INIT_SCRIPT"
# ------------------------------------------------------------------------------

BIN=/usr/local/bin
export PATH="$BIN:$PATH"

# dolt: the version-agnostic release asset, so we never hit api.github.com (which
# rate-limits unauthenticated cloud IPs and is not allowlisted).
log "installing dolt (latest)"
curl -fsSL -o /tmp/dolt.tgz \
  "https://github.com/dolthub/dolt/releases/latest/download/dolt-linux-amd64.tar.gz"
tar xzf /tmp/dolt.tgz -C /tmp
install /tmp/dolt-linux-amd64/bin/dolt "$BIN/dolt"

# bd: pinned to the version read above. Download by exact tag — no latest-tag
# resolution, which is exactly the drift this rewrite removes.
log "installing bd $BD_VER (pinned via beads-cloud-init.sh)"
BD_TAG="v${BD_VER}"
curl -fsSL -o /tmp/bd.tgz \
  "https://github.com/steveyegge/beads/releases/download/${BD_TAG}/beads_${BD_VER}_linux_amd64.tar.gz"
tar xzf /tmp/bd.tgz -C /tmp
install /tmp/bd "$BIN/bd"

log "installed versions:"
dolt version >&2
# bd's tarball binary needs libicu; some base images lack it and bd won't print
# its version until it's present. Install on that failure, then re-check.
if ! bd version >&2; then
  log "bd failed to link — installing libicu and retrying"
  apt-get update -qq && apt-get install -y libicu-dev
  bd version >&2
fi

log "done — dolt + bd $BD_VER on PATH; agent runs scripts/beads-cloud-init.sh next"

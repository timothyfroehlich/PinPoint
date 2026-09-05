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
# the approved cloud-asset digests, installed binaries, and runtime guards move
# together and cannot disagree.
# (Rationale for exact pins: an accidental newer release, e.g. bd 1.2.1 on
# 2026-08-16, migrated the shared DB to a schema no supported binary could read
# and locked every client out for two days. An exact pin fails loud; a floor fails
# silent.) The bump is a weekly-chores item.

set -euo pipefail

log()  { printf '[beads-cloud-setup] %s\n' "$*" >&2; }
die()  { printf '[beads-cloud-setup] ERROR: %s\n' "$*" >&2; exit 1; }

verify_sha256() {
  local archive="$1"
  local expected="$2"
  local actual=""

  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$archive" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "$archive" | awk '{print $1}')"
  else
    die "cannot verify $(basename "$archive"): sha256sum or shasum is required"
  fi

  [[ "$actual" == "$expected" ]] \
    || die "SHA-256 mismatch for $(basename "$archive") (expected $expected, got $actual)"
}

manifest_platform_digest() {
  local platform="$1"
  local field="$2"

  awk -v platform="$platform" -v field="$field" '
    $0 ~ "^[[:space:]]*\\\"" platform "\\\"[[:space:]]*:" {
      in_platform = 1
      next
    }
    in_platform && $0 ~ "^[[:space:]]*}" { exit }
    in_platform && $0 ~ "\\\"" field "\\\"[[:space:]]*:" {
      value = $0
      sub(/^.*:[[:space:]]*"/, "", value)
      sub(/".*$/, "", value)
      print value
      exit
    }
  ' "$COMPAT_FILE"
}

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

UNAME_S="$(uname -s)"
UNAME_M="$(uname -m)"
case "$UNAME_S:$UNAME_M" in
  Linux:x86_64|Linux:amd64)
    CLOUD_PLATFORM="linux-amd64"
    ;;
  *)
    die "unsupported cloud platform $UNAME_S/$UNAME_M; declare its assets and digests in $COMPAT_FILE first"
    ;;
esac

BD_SHA256="$(manifest_platform_digest "$CLOUD_PLATFORM" "bdSha256")"
[[ "$BD_SHA256" =~ ^[0-9a-f]{64}$ ]] \
  || die "could not parse bd SHA-256 for $CLOUD_PLATFORM from $COMPAT_FILE"
DOLT_SHA256="$(manifest_platform_digest "$CLOUD_PLATFORM" "doltSha256")"
[[ "$DOLT_SHA256" =~ ^[0-9a-f]{64}$ ]] \
  || die "could not parse dolt SHA-256 for $CLOUD_PLATFORM from $COMPAT_FILE"
# ------------------------------------------------------------------------------

BIN="${BEADS_CLOUD_BIN_DIR:-/usr/local/bin}"
export PATH="$BIN:$PATH"

# Downloads are isolated and removed on every exit, including checksum failure.
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/beads-cloud-setup.XXXXXXXX")"
cleanup() {
  rm -rf -- "$WORK_DIR"
}
trap cleanup EXIT

# Download both exact-tag assets before extracting or installing either one.
# This ensures a mismatch in either archive performs no privileged installation.
log "downloading dolt $DOLT_VER + bd $BD_VER for $CLOUD_PLATFORM"
DOLT_TAG="v${DOLT_VER}"
curl -fsSL -o "$WORK_DIR/dolt.tgz" \
  "https://github.com/dolthub/dolt/releases/download/${DOLT_TAG}/dolt-linux-amd64.tar.gz"
BD_TAG="v${BD_VER}"
curl -fsSL -o "$WORK_DIR/bd.tgz" \
  "https://github.com/steveyegge/beads/releases/download/${BD_TAG}/beads_${BD_VER}_linux_amd64.tar.gz"

log "verifying approved release-asset digests"
verify_sha256 "$WORK_DIR/dolt.tgz" "$DOLT_SHA256"
verify_sha256 "$WORK_DIR/bd.tgz" "$BD_SHA256"

mkdir "$WORK_DIR/dolt-extract" "$WORK_DIR/bd-extract"
tar xzf "$WORK_DIR/dolt.tgz" -C "$WORK_DIR/dolt-extract"
tar xzf "$WORK_DIR/bd.tgz" -C "$WORK_DIR/bd-extract"
[[ -f "$WORK_DIR/dolt-extract/dolt-linux-amd64/bin/dolt" ]] \
  || die "verified dolt archive did not contain the expected binary"
[[ -f "$WORK_DIR/bd-extract/bd" ]] \
  || die "verified bd archive did not contain the expected binary"

log "installing verified dolt $DOLT_VER + bd $BD_VER"
install "$WORK_DIR/dolt-extract/dolt-linux-amd64/bin/dolt" "$BIN/dolt"
install "$WORK_DIR/bd-extract/bd" "$BIN/bd"

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

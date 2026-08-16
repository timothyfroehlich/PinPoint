#!/usr/bin/env bash
# beads-cloud-init.sh — one-shot beads (DoltHub) setup for Claude cloud routines.
#
# Claude cloud routines run in ephemeral sandboxes with a fresh PinPoint checkout
# but no .beads data (.beads/ is gitignored). This script — run by the AGENT at
# routine start, because the claude.ai environment variables are visible only at
# agent runtime and NEVER to the environment's setup script
# (anthropics/claude-code#55440, closed not_planned) — materializes the dedicated
# DoltHub credential, guards the bd version, then clones the shared beads DB.
#
# It replaces the multi-line agent preamble that used to be pasted into every
# beads-writing routine prompt. A routine now runs, in one line:
#
#     bash scripts/beads-cloud-init.sh && cd ~/beads
#
# THE VERSION PIN (loud, exact, deliberate). This refuses to proceed unless bd is
# EXACTLY BD_PINNED_VERSION — newer or older. Rationale: an accidental *newer*
# beads release (1.2.1, 2026-08-16) migrated the shared DB to a schema no
# supported binary could read and locked every client out for two days. A stale
# exact pin fails LOUD ("routine refuses to run") — the safe direction; a version
# floor would fail SILENT (a newer release migrates the shared DB before anyone
# notices). The binary is already installed by the environment's setup script
# (from releases/latest) before this runs, so this guard's job is to stop a wrong
# binary from TOUCHING THE DB, not to control the download. The real download pin
# belongs in that setup script — which lives in the claude.ai UI, not this repo,
# and so cannot be reviewed or diffed. This in-repo guard is the reviewable
# backstop.
#
# When Tim upgrades his machines past the pin, bump BD_PINNED_VERSION below. It is
# a weekly-chores checklist item so the bump is a known recurring task, not a
# surprise Saturday outage.
#
# Required env (materialized by claude.ai environment config; agent-runtime only):
#   DOLT_CREDS_JWK     — the dedicated cloud DoltHub credential's private JWK
#                        (one-line JSON)
#   DOLT_CREDS_PUB     — the local file-stem handle for that credential
#   BEADS_SYNC_REMOTE  — https://doltremoteapi.dolthub.com/advacar/pinpoint-beads
# Optional env:
#   BEADS_DIR          — where to clone (default: ~/beads)
#   DOLT_USER_NAME     — Dolt commit author name (default: advacar)
#   DOLT_USER_EMAIL    — Dolt commit author email; metadata only, NOT auth
#                        (default: beads-cloud@pinpoint.invalid)

set -euo pipefail

# --- The pin. Bump when Tim's machines move past it (weekly chores item). ------
BD_PINNED_VERSION="1.2.2"
# ------------------------------------------------------------------------------

BEADS_DIR="${BEADS_DIR:-$HOME/beads}"
DOLT_USER_NAME="${DOLT_USER_NAME:-advacar}"
DOLT_USER_EMAIL="${DOLT_USER_EMAIL:-beads-cloud@pinpoint.invalid}"

log() { printf '[beads-cloud-init] %s\n' "$*" >&2; }
die() { printf '[beads-cloud-init] ERROR: %s\n' "$*" >&2; exit 1; }

# 1. bd must be installed and actually RUN. A version that will not print usually
#    means the tarball binary is missing libicu (the setup script installs it on
#    that failure).
command -v bd >/dev/null 2>&1 \
  || die "bd not found on PATH — the environment setup script should install it"
bd_ver="$(bd version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)" \
  || die "bd is installed but will not run (missing libicu?) — check the setup script"
[[ -n "$bd_ver" ]] || die "could not parse 'bd version' output"

# 2. THE GUARD. Exact-pin — refuse anything else, newer OR older.
if [[ "$bd_ver" != "$BD_PINNED_VERSION" ]]; then
  die "bd $bd_ver != pinned $BD_PINNED_VERSION — refusing to touch the shared beads DB.
       If this is a deliberate upgrade, bump BD_PINNED_VERSION in scripts/beads-cloud-init.sh.
       Do NOT install, build, or 'upgrade' bd inside a cloud routine to get past this."
fi
log "bd $bd_ver matches pin — proceeding"

# 3. Required env for credential materialization.
[[ -n "${DOLT_CREDS_JWK:-}" ]]    || die "DOLT_CREDS_JWK not set (claude.ai env var, agent-runtime only)"
[[ -n "${DOLT_CREDS_PUB:-}" ]]    || die "DOLT_CREDS_PUB not set"
[[ -n "${BEADS_SYNC_REMOTE:-}" ]] || die "BEADS_SYNC_REMOTE not set"

# 4. Materialize the dedicated DoltHub credential. The private key stays off git —
#    it comes from the env var each run. user.creds binds the private JWK to the
#    registered public key (that is the access grant); user.name/email are Dolt
#    commit metadata only, not authentication.
log "materializing DoltHub credential"
mkdir -p "$HOME/.dolt/creds"
printf '%s' "$DOLT_CREDS_JWK" > "$HOME/.dolt/creds/$DOLT_CREDS_PUB.jwk"
chmod 600 "$HOME/.dolt/creds/$DOLT_CREDS_PUB.jwk"
printf '{"user.creds":"%s","user.name":"%s","user.email":"%s"}' \
  "$DOLT_CREDS_PUB" "$DOLT_USER_NAME" "$DOLT_USER_EMAIL" \
  > "$HOME/.dolt/config_global.json"

# 5. Clone the shared beads DB (persists sync.remote; no hand-seeded config.yaml).
if [[ -d "$BEADS_DIR/.beads" ]]; then
  log "beads workspace already present in $BEADS_DIR — leaving it as-is"
else
  log "cloning shared beads DB into $BEADS_DIR"
  mkdir -p "$BEADS_DIR"
  cd "$BEADS_DIR"
  bd init --remote "$BEADS_SYNC_REMOTE" --prefix PP --non-interactive
fi

log "beads ready in $BEADS_DIR (bd $bd_ver) — cd there to use bd"

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
# before this runs — that script pins the same version (BD_VER), but its live
# copy lives in the claude.ai UI, not this repo, and so cannot be reviewed or
# diffed and can drift. This guard's job is to stop a wrong binary from TOUCHING
# THE DB if that happens: it is the reviewable, enforced backstop to the UI pin.
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
#   DOLT_USER_NAME     — Dolt commit author name (default: advacar)
#   DOLT_USER_EMAIL    — Dolt commit author email; metadata only, NOT auth
#                        (default: beads-cloud@pinpoint.invalid)

set -euo pipefail

# --- The pin. Bump when Tim's machines move past it (weekly chores item). ------
BD_PINNED_VERSION="1.2.2"
# ------------------------------------------------------------------------------

# Fixed, not overridable: the runbook preamble cd's into ~/beads, so a
# configurable clone target would let the two drift (clone one place, cd to an
# empty other). Edit here if you ever need a different path.
BEADS_DIR="$HOME/beads"
DOLT_USER_NAME="${DOLT_USER_NAME:-advacar}"
DOLT_USER_EMAIL="${DOLT_USER_EMAIL:-beads-cloud@pinpoint.invalid}"

log() { printf '[beads-cloud-init] %s\n' "$*" >&2; }
die() { printf '[beads-cloud-init] ERROR: %s\n' "$*" >&2; exit 1; }

# 1. bd must be installed and actually RUN. A version that will not print usually
#    means the tarball binary is missing libicu (the setup script installs it on
#    that failure). Capture stdout AND stderr (some CLIs print the banner to
#    stderr), and keep the grep|head pipeline off the die path — under `set -o
#    pipefail`, head closing the pipe early makes grep exit 141 (SIGPIPE), which
#    would otherwise fire a false "will not run" abort on a healthy bd. The real
#    gate is whether a version parsed at all.
command -v bd >/dev/null 2>&1 \
  || die "bd not found on PATH — the environment setup script should install it"
bd_raw="$(bd version 2>&1 || true)"
# Anchor on bd's own "bd version X.Y.Z ..." line rather than the first semver-
# shaped token anywhere in the output — a future banner that also prints a Go
# runtime or build id in semver shape must not be able to feed the pin guard the
# wrong number. If the prefix ever changes, this parses empty and dies loud.
bd_ver="$(printf '%s\n' "$bd_raw" | sed -nE 's/^bd version ([0-9]+\.[0-9]+\.[0-9]+).*/\1/p' | head -n1 || true)"
[[ -n "$bd_ver" ]] \
  || die "could not parse a version from 'bd version' (missing libicu, a broken binary, or a changed output format): $bd_raw"

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

# DOLT_CREDS_PUB becomes a file path; DOLT_USER_NAME/EMAIL are interpolated into
# JSON. Defaults are safe, but a malformed override could traverse out of the
# creds dir or produce invalid JSON — reject both. (if/then, not `&& die`, so a
# false test does not trip `set -e`.)
if [[ "$DOLT_CREDS_PUB" == *[/\\]* ]]; then
  die "DOLT_CREDS_PUB must be a bare file stem with no path separators: $DOLT_CREDS_PUB"
fi
if [[ "$DOLT_USER_NAME$DOLT_USER_EMAIL" == *[\"\\]* ]]; then
  die "DOLT_USER_NAME / DOLT_USER_EMAIL must not contain a double-quote or backslash — they would break config_global.json"
fi

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
  # A surviving/reused workspace must be re-synced, not trusted — operating on a
  # stale local snapshot of the shared DB (then pushing work computed against it)
  # is the exact failure that motivated this script. Pull fails loud if it can't.
  log "beads workspace already present in $BEADS_DIR — syncing from remote"
  cd "$BEADS_DIR"
  bd dolt pull
else
  log "cloning shared beads DB into $BEADS_DIR"
  mkdir -p "$BEADS_DIR"
  cd "$BEADS_DIR"
  bd init --remote "$BEADS_SYNC_REMOTE" --prefix PP --non-interactive
fi

# 6. Create the dolt_ignore'd tables a fresh clone is missing. bd keeps five
#    tables (events, bd_events_journal, bd_events_seq, leases, wisps) out of
#    version control via dolt_ignore — they live only in each machine's working
#    set, so no clone of the remote ever contains them, and bd 1.2.2 does not
#    lazily create them in an embedded clone. Without this, the first write
#    fails: "Error 1146: table not found: events" (incident 2026-08-17,
#    PP-esqi). Idempotent (IF NOT EXISTS) and safe for the shared remote:
#    dolt_ignore keeps these tables out of bd's commits and pushes. Runs on the
#    pull path too — a reused workspace may predate this repair.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPAIR_SQL="$SCRIPT_DIR/beads-cloud-repair-tables.sql"
DOLT_DB_DIR="$BEADS_DIR/.beads/embeddeddolt/PP"
[[ -f "$REPAIR_SQL" ]] || die "repair SQL not found: $REPAIR_SQL"
[[ -d "$DOLT_DB_DIR" ]] \
  || die "embedded dolt DB not at $DOLT_DB_DIR — bd's workspace layout changed; update this script"
command -v dolt >/dev/null 2>&1 \
  || die "dolt not found on PATH — the environment setup script should install it"
log "ensuring dolt_ignore'd working-set tables exist (events et al)"
(cd "$DOLT_DB_DIR" && dolt sql < "$REPAIR_SQL")

log "beads ready in $BEADS_DIR (bd $bd_ver) — cd there to use bd"

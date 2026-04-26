#!/usr/bin/env bash
# One-shot environment bootstrap for Claude Code remote sessions.
#
# Designed to be invoked as the "setup command" on a Claude Code web/remote
# environment. Installs missing CLIs, configures DoltHub credentials, syncs
# the beads database, and runs `pnpm install`. Idempotent — safe to re-run.
#
# Required env (configure as a secret on the remote env):
#   DOLT_CREDS_JWK   Contents of a Dolt JWK creds file with read+write access
#                    to advacar/pinpoint-beads. Without this, beads sync is
#                    skipped and the agent runs without a beads workspace.
#
# Optional env:
#   BEADS_BOOTSTRAP_SKIP_PNPM=1   Skip `pnpm install` (faster re-runs).
#   BEADS_BOOTSTRAP_SKIP_DOLT=1   Skip beads sync (offline / read-only).
#
# Targets Linux (Anthropic web env). The apt block is gated so the script
# is non-destructive on macOS, but the rest assumes a Linux-style sandbox.

set -euo pipefail

ACTIONLINT_VERSION="1.7.11"
ZIZMOR_VERSION="1.23.1"
BEADS_DOLT_REMOTE="https://doltremoteapi.dolthub.com/advacar/pinpoint-beads"
BEADS_PREFIX="PP"

log()  { printf '\033[36m[bootstrap]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[bootstrap]\033[0m %s\n' "$*" >&2; }

ensure_path() {
  local d=$1
  case ":$PATH:" in *":$d:"*) ;; *) export PATH="$d:$PATH" ;; esac
}

ensure_path "$HOME/.local/bin"
ensure_path "$(go env GOPATH)/bin"

# 1. apt packages (Linux only; macOS runs assume Homebrew already provided these)
if command -v apt-get >/dev/null; then
  need_apt=()
  dpkg -s libicu-dev    >/dev/null 2>&1 || need_apt+=(libicu-dev)
  dpkg -s fd-find       >/dev/null 2>&1 || need_apt+=(fd-find)
  command -v shellcheck >/dev/null      || need_apt+=(shellcheck)
  command -v yamllint   >/dev/null      || need_apt+=(yamllint)

  if (( ${#need_apt[@]} )); then
    log "apt install: ${need_apt[*]}"
    # Tolerate failed third-party PPAs — only the targeted packages need to resolve.
    sudo apt-get update -qq || warn "apt-get update reported errors (likely third-party PPAs); continuing"
    sudo apt-get install -y --no-install-recommends "${need_apt[@]}"
  fi
fi

# Ubuntu ships fd as `fdfind`; AGENTS.md references `fd`.
mkdir -p "$HOME/.local/bin"
if [ ! -e "$HOME/.local/bin/fd" ] && command -v fdfind >/dev/null; then
  ln -s "$(command -v fdfind)" "$HOME/.local/bin/fd"
fi

# 2. Go-installed CLIs --------------------------------------------------------
go_bin="$(go env GOPATH)/bin"

if ! command -v bd >/dev/null; then
  log "go install bd (beads)"
  go install github.com/steveyegge/beads/cmd/bd@latest
fi

if ! command -v ratchet >/dev/null; then
  log "go install ratchet"
  go install github.com/sethvargo/ratchet@latest
fi

# Surface go-installed binaries on the default PATH for post-bootstrap shells.
for bin in bd ratchet; do
  if [ -x "$go_bin/$bin" ] && [ ! -e "$HOME/.local/bin/$bin" ]; then
    ln -s "$go_bin/$bin" "$HOME/.local/bin/$bin"
  fi
done

# 3. actionlint (pinned, mirrors CI) ------------------------------------------
if ! command -v actionlint >/dev/null; then
  log "install actionlint $ACTIONLINT_VERSION"
  tmp="$(mktemp -d)"
  ( cd "$tmp" && bash <(curl -sSL https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash) "$ACTIONLINT_VERSION" >/dev/null )
  install -m 0755 "$tmp/actionlint" "$HOME/.local/bin/actionlint"
  rm -rf "$tmp"
fi

# 4. zizmor (pinned, mirrors CI) ----------------------------------------------
if ! command -v zizmor >/dev/null; then
  log "uv tool install zizmor==$ZIZMOR_VERSION"
  uv tool install --quiet "zizmor==$ZIZMOR_VERSION"
fi

# 5. dolt CLI -----------------------------------------------------------------
if ! command -v dolt >/dev/null; then
  log "install dolt"
  tmp_installer="$(mktemp)"
  curl -fsSL https://github.com/dolthub/dolt/releases/latest/download/install.sh -o "$tmp_installer"
  sudo bash "$tmp_installer" >/dev/null
  rm -f "$tmp_installer"
fi

# 6. beads sync ---------------------------------------------------------------
if [ "${BEADS_BOOTSTRAP_SKIP_DOLT:-0}" = "1" ]; then
  log "beads sync skipped (BEADS_BOOTSTRAP_SKIP_DOLT=1)"
elif [ -z "${DOLT_CREDS_JWK:-}" ]; then
  warn "DOLT_CREDS_JWK not set — skipping beads sync. Agent will run without a beads workspace."
else
  # Install creds (idempotent: dolt creds import is a no-op if already there)
  mkdir -p "$HOME/.dolt/creds"
  chmod 700 "$HOME/.dolt"
  jwk_file="$(mktemp --suffix=.jwk)"
  printf '%s' "$DOLT_CREDS_JWK" > "$jwk_file"
  chmod 600 "$jwk_file"

  if ! dolt creds ls 2>/dev/null | grep -q '^[*+]'; then
    log "import dolt creds"
    dolt creds import "$jwk_file" >/dev/null
  fi
  rm -f "$jwk_file"

  active_key=$(dolt creds ls 2>/dev/null | awk '/^\*/ {print $2; exit}')
  if [ -z "$active_key" ]; then
    first_key=$(dolt creds ls 2>/dev/null | awk 'NR>0 && $1 ~ /^[+*]/ {print $2; exit}')
    [ -n "$first_key" ] && dolt creds use "$first_key" >/dev/null
  fi

  if [ ! -d .beads ]; then
    log "bd init (skip-agents, skip-hooks)"
    CI=true bd init --non-interactive --role contributor \
      --prefix "$BEADS_PREFIX" --skip-agents --skip-hooks >/dev/null
  fi

  dolt_dir=".beads/embeddeddolt/$BEADS_PREFIX"
  if [ ! -d "$dolt_dir/.dolt" ]; then
    warn "expected dolt repo at $dolt_dir not found; skipping sync"
  else
    pushd "$dolt_dir" >/dev/null
    if ! dolt remote -v 2>/dev/null | grep -q '^origin\b'; then
      log "configure dolt remote -> $BEADS_DOLT_REMOTE"
      dolt remote add origin "$BEADS_DOLT_REMOTE"
    fi
    log "fetch beads from DoltHub"
    if dolt fetch origin 2>&1 | tee /tmp/bd-fetch.log | grep -q "PermissionDenied"; then
      warn "DoltHub denied the fetch (Host not in allowlist or invalid creds). See /tmp/bd-fetch.log."
    else
      log "reset local DB to origin/main"
      dolt reset --hard origin/main >/dev/null
    fi
    popd >/dev/null
  fi
fi

# 7. project deps -------------------------------------------------------------
if [ "${BEADS_BOOTSTRAP_SKIP_PNPM:-0}" = "1" ]; then
  log "pnpm install skipped (BEADS_BOOTSTRAP_SKIP_PNPM=1)"
else
  log "pnpm install --frozen-lockfile"
  pnpm install --frozen-lockfile
fi

log "bootstrap complete"

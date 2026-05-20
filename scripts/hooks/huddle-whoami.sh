#!/usr/bin/env bash
# shellcheck disable=SC2250  # unbraced $vars are consistent throughout this codebase
# shellcheck disable=SC2310  # discover_session_id is best-effort; `|| …` fallbacks are intentional
# huddle-whoami.sh — look up or register the current session's huddle name
#
# Harness-agnostic. Identity is keyed by the agent's session_id (a UUID
# supplied by the harness — Claude Code's session_id, Antigravity's
# conversationId, etc.). Names live in a single JSON map at
# <main-worktree>/.agents/huddle/session-names.json so every session can be
# inspected/edited from one place and the mapping persists across restarts.
# See huddle-lib.sh for the state-dir resolver.
#
# Names should embed the harness as a prefix (e.g. `Claude-DesignBible`,
# `Antigravity-AgentsMdCleanup`, `Codex-TestAudit`) so Tim can recognize
# which agent stack each parallel session belongs to. The huddle self-filter
# uses the full registered name when matching `—<name>` sign-offs.
#
# Subcommands:
#   whoami [SESSION_ID]      Print the registered name for SESSION_ID (or the
#                            discovered session, see below). Empty if unknown.
#   register NAME [SESSION_ID]
#                            Add or update SESSION_ID → NAME in the JSON map.
#                            If SESSION_ID is omitted, uses the discovered one.
#   list                     Dump all session_id → name pairs (sorted by name).
#   discover                 Print the best-guess session_id of the calling
#                            shell (Claude Code only; see WARNING below).
#
# WARNING — session_id discovery is a Claude-Code-specific best-effort
# heuristic. It reads ~/.claude/projects/<mangled-root>/<session_id>.jsonl,
# the transcript location Claude Code uses. Other harnesses (Antigravity,
# Codex, etc.) do not write transcripts there and MUST pass session_id
# explicitly — their bootstrap shims already do (see
# .agents/hooks/agy-beads-bootstrap.cjs). Even within Claude Code the
# heuristic is racy when multiple sessions are active; agents should learn
# their session_id from the SessionStart hook payload and pass it explicitly.
# The discover heuristic is a convenience fallback only.

set -euo pipefail

# shellcheck source=huddle-lib.sh disable=SC1091
source "$(dirname "$0")/huddle-lib.sh"

STATE_DIR=$(huddle_state_dir) || {
  echo "huddle-whoami.sh: not inside a git checkout; can't locate huddle state" >&2
  exit 1
}
NAMES_JSON="$STATE_DIR/session-names.json"

mkdir -p "$STATE_DIR"
if [[ ! -f "$NAMES_JSON" ]]; then
  echo "{}" > "$NAMES_JSON"
fi

# Derive the project's transcript directory from the main worktree root.
# Linked worktrees share the project's transcript dir (Claude Code keys by
# project root, not by CWD).
project_transcript_dir() {
  local repo_root
  if common_dir=$(git rev-parse --git-common-dir 2>/dev/null); then
    repo_root=$(cd "$(dirname "$common_dir")" && pwd)
  else
    repo_root=$(pwd)
  fi
  local mangled
  mangled="${repo_root//\//-}"
  echo "$HOME/.claude/projects/$mangled"
}

# Best-effort: newest top-level transcript .jsonl (excluding subagents/ subdir).
# Use bash globbing with `nullglob` so we can detect the empty case BEFORE
# invoking ls — without the guard, `find ... | xargs ls -t` runs `ls -t`
# with no args (which lists CWD) and returns an unrelated basename.
discover_session_id() {
  local dir
  dir=$(project_transcript_dir)
  if [[ ! -d "$dir" ]]; then
    return 1
  fi
  local files=()
  shopt -s nullglob
  files=("$dir"/*.jsonl)
  shopt -u nullglob
  if [[ ${#files[@]} -eq 0 ]]; then
    return 1
  fi
  local newest
  # shellcheck disable=SC2012  # session_id filenames are UUIDs (no special chars), ls is safe
  newest=$(ls -t "${files[@]}" 2>/dev/null | head -1) || return 1
  if [[ -z "$newest" ]]; then
    return 1
  fi
  basename "$newest" .jsonl
}

cmd="${1:-whoami}"

case "$cmd" in
  whoami)
    sid="${2:-}"
    if [[ -z "$sid" ]]; then
      sid=$(discover_session_id) || { echo ""; exit 0; }
    fi
    jq -r --arg sid "$sid" '.[$sid] // ""' "$NAMES_JSON"
    ;;

  register)
    name="${2:-}"
    if [[ -z "$name" ]]; then
      echo "Usage: huddle-whoami.sh register NAME [SESSION_ID]" >&2
      exit 1
    fi
    # Restrict names to alphanumeric + underscore + hyphen. Defense in depth:
    # huddle-poll.sh passes the name via jq --arg (safe under any input), but
    # validating at registration keeps the JSON file clean and grep-friendly.
    if [[ ! "$name" =~ ^[A-Za-z0-9_-]+$ ]]; then
      echo "huddle-whoami.sh: NAME must be alphanumeric (plus _ and -); got: $name" >&2
      exit 1
    fi
    sid="${3:-}"
    if [[ -z "$sid" ]]; then
      sid=$(discover_session_id) || {
        echo "huddle-whoami.sh: could not discover session_id; pass it explicitly" >&2
        exit 1
      }
    fi
    # Reject duplicate names: if any OTHER session_id already owns this name,
    # registering it again would make the self-filter suppress both sessions'
    # comments from each other. Re-registering your own session under the same
    # name is allowed (idempotent).
    existing=$(jq -r --arg name "$name" --arg sid "$sid" \
      'to_entries | map(select(.value == $name and .key != $sid)) | .[0].key // ""' \
      "$NAMES_JSON")
    if [[ -n "$existing" ]]; then
      echo "huddle-whoami.sh: name '$name' is already registered to session $existing" >&2
      echo "Pick a different name (e.g. ${name}2, ${name}B) and retry." >&2
      exit 1
    fi
    tmp=$(mktemp)
    jq --arg sid "$sid" --arg name "$name" '. + {($sid): $name}' "$NAMES_JSON" > "$tmp"
    mv "$tmp" "$NAMES_JSON"
    echo "Registered: $sid → $name"
    ;;

  list)
    jq -r 'to_entries | sort_by(.value) | .[] | "\(.value)\t\(.key)"' "$NAMES_JSON"
    ;;

  discover)
    discover_session_id || { echo "(could not discover)" >&2; exit 1; }
    ;;

  *)
    echo "Usage: huddle-whoami.sh [whoami|register NAME|list|discover] [SESSION_ID]" >&2
    exit 1
    ;;
esac

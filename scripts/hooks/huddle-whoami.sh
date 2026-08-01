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
#   whoami SESSION_ID        Print the registered name for SESSION_ID. Exits 1
#                            with usage if SESSION_ID is omitted.
#   register [--force] NAME SESSION_ID
#                            Add SESSION_ID → NAME to the JSON map. Refuses to
#                            rebind a SESSION_ID that already holds a DIFFERENT
#                            name unless --force is passed. Exits 1 with usage
#                            if SESSION_ID is omitted.
#   list                     Dump all session_id → name pairs (sorted by name).
#   discover                 Print the best-guess session_id of the calling
#                            shell. Prefers $CLAUDE_SESSION_ID when set;
#                            falls back to the transcript heuristic with a
#                            warning (Claude Code only; see WARNING below).
#
# OWNERSHIP — a session_id is owned by whoever registered it first. `register`
# guards BOTH directions of collision:
#   - name → other sid: the name is taken; pick a different one (no override).
#   - sid → other name: refuse the rebind; --force overrides, for the genuine
#     "I want to rename my own session" case.
# The second guard is the fix for PP-788v. The write used to be an
# unconditional `. + {($sid): $name}` — last writer won, silently, and printed
# a cheerful success line. On 2026-07-31 three consecutive subagents each
# overwrote the orchestrator's mapping for the orchestrator's OWN session_id,
# which broke its self-filter (it saw its own posts re-injected as a peer's)
# and misattributed its huddle comments to the subagents — even to Tim.
#
# WARNING — the transcript-based session_id discovery is a Claude-Code-specific
# best-effort heuristic. It reads ~/.claude/projects/<mangled-root>/<session_id>.jsonl,
# the transcript location Claude Code uses. Other harnesses (Antigravity,
# Codex, etc.) do not write transcripts there and MUST pass session_id
# explicitly — their bootstrap shims already do (see
# .agents/hooks/antigravity-bootstrap.cjs). Even within Claude Code the
# heuristic is racy when multiple sessions are active: it returns the newest
# transcript, which is wrong for any non-newest session (2026-05-20 incident
# on PP-lt12 — root cause of PP-sjkz). SESSION_ID is therefore REQUIRED for
# whoami and register; the discover subcommand invokes the heuristic only
# when the caller explicitly requests it and $CLAUDE_SESSION_ID is absent.

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

# Is the calling process a dispatched Claude Code subagent (`Agent({...})`)?
#
# A subagent CANNOT learn its own session_id, so it must never register:
#   - $CLAUDE_CODE_SESSION_ID is seeded with the PARENT's id;
#   - discover_session_id above returns the newest TOP-LEVEL transcript, which
#     excludes subagents/ by construction — so also the parent's;
#   - the scratchpad path handed to a subagent embeds the parent's UUID.
# Every available route yields the parent's id (PP-788v). Telling agents to
# "use your own id" was tried twice and failed both times, because the value
# it asks for does not exist anywhere in a subagent's environment.
#
# Detection: Claude Code spawns a subagent as its own process seeded with
# CLAUDE_CODE_CHILD_SESSION=1 AND AI_AGENT=claude-code_<version>_agent. The
# CHILD_SESSION marker alone is NOT sufficient — harness-spawned TOP-LEVEL
# sessions (cmux, the web bridge) carry it too and are legitimate registrants;
# only the `_agent` suffix marks a dispatch (a harness session gets
# `_harness`). Requiring both keeps top-level sessions registerable.
#
# Fails open by design: other harnesses (Antigravity, Codex) set neither var,
# so they are unaffected, and a Claude Code version that stops setting them
# just falls back to the harness-agnostic rebind guard in `register`.
caller_is_subagent() {
  [[ -n "${CLAUDE_CODE_CHILD_SESSION:-}" ]] || return 1
  [[ "${AI_AGENT:-}" == *_agent ]] || return 1
  return 0
}

# Shared refusal for the subagent case. $1 is the subcommand being refused.
refuse_subagent() {
  printf 'huddle-whoami.sh: refusing to %s — this is a dispatched subagent.\n' "$1" >&2
  printf 'A subagent cannot determine its own session_id: every route (the\n' >&2
  printf 'CLAUDE_CODE_SESSION_ID env var, the transcript heuristic, the scratchpad\n' >&2
  printf 'path) yields the id of the PARENT session, so registering would rename\n' >&2
  printf 'the parent out from under it (PP-788v).\n\n' >&2
  printf 'Subagents are ephemeral and must not hold huddle names — see the\n' >&2
  printf 'pinpoint-huddle skill, "Subagent sessions". Sign your huddle posts with\n' >&2
  printf '—<YourName> instead; a signature needs no registration.\n' >&2
}

cmd="${1:-whoami}"

case "$cmd" in
  whoami)
    sid="${2:-}"
    if [[ -z "$sid" ]]; then
      printf 'Usage: huddle-whoami.sh whoami SESSION_ID\n' >&2
      printf 'SESSION_ID is required — the heuristic is unreliable when multiple sessions are active.\n' >&2
      printf 'Use the discover subcommand if you want the heuristic result explicitly.\n' >&2
      exit 1
    fi
    jq -r --arg sid "$sid" '.[$sid] // ""' "$NAMES_JSON"
    ;;

  register)
    # A subagent has no correct id to register, so refuse before parsing —
    # there is no combination of arguments that makes the write correct, and
    # that includes --force.
    if caller_is_subagent; then
      refuse_subagent "register"
      exit 1
    fi
    shift
    force=0
    positional=()
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --force) force=1 ;;
        --)
          shift
          while [[ $# -gt 0 ]]; do
            positional+=("$1")
            shift
          done
          break
          ;;
        -*)
          echo "huddle-whoami.sh: unknown option '$1' (register accepts --force)" >&2
          exit 1
          ;;
        *) positional+=("$1") ;;
      esac
      shift
    done
    name="${positional[0]:-}"
    if [[ -z "$name" ]]; then
      echo "Usage: huddle-whoami.sh register [--force] NAME SESSION_ID" >&2
      exit 1
    fi
    # Restrict names to alphanumeric + underscore + hyphen. Defense in depth:
    # huddle-poll.sh passes the name via jq --arg (safe under any input), but
    # validating at registration keeps the JSON file clean and grep-friendly.
    if [[ ! "$name" =~ ^[A-Za-z0-9_-]+$ ]]; then
      echo "huddle-whoami.sh: NAME must be alphanumeric (plus _ and -); got: $name" >&2
      exit 1
    fi
    sid="${positional[1]:-}"
    if [[ -z "$sid" ]]; then
      printf 'Usage: huddle-whoami.sh register [--force] NAME SESSION_ID\n' >&2
      printf 'SESSION_ID is required — the heuristic is unreliable when multiple sessions are active.\n' >&2
      printf 'To get the discovered session_id, run:\n' >&2
      printf '  bash scripts/hooks/huddle-whoami.sh discover\n' >&2
      exit 1
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
    # Reject the REVERSE-direction collision (PP-788v): this session_id is
    # already registered under a DIFFERENT name. Overwriting it renames the
    # session that owns it — silently corrupting that session's self-filter
    # and the attribution of every comment it has signed. Re-registering the
    # same name is still idempotent; only a genuine rename needs --force.
    current=$(jq -r --arg sid "$sid" '.[$sid] // ""' "$NAMES_JSON")
    if [[ -n "$current" && "$current" != "$name" && $force -eq 0 ]]; then
      printf 'huddle-whoami.sh: session %s is already registered as %s\n' "$sid" "$current" >&2
      printf 'Refusing to rebind it to %s — that would rename whoever owns this\n' "$name" >&2
      printf 'session and break their self-filter and comment attribution (PP-788v).\n\n' >&2
      printf 'If you were handed this session_id by another agent, it is almost\n' >&2
      printf 'certainly NOT yours — do not register; sign your huddle posts instead.\n\n' >&2
      printf 'If this really is your own session and you mean to rename it:\n' >&2
      printf '  bash scripts/hooks/huddle-whoami.sh register --force %s %s\n' "$name" "$sid" >&2
      exit 1
    fi
    tmp=$(mktemp)
    jq --arg sid "$sid" --arg name "$name" '. + {($sid): $name}' "$NAMES_JSON" > "$tmp"
    mv "$tmp" "$NAMES_JSON"
    if [[ -n "$current" && "$current" != "$name" ]]; then
      echo "Renamed (--force): $sid → $name (was $current)"
    else
      echo "Registered: $sid → $name"
    fi
    ;;

  list)
    jq -r 'to_entries | sort_by(.value) | .[] | "\(.value)\t\(.key)"' "$NAMES_JSON"
    ;;

  discover)
    # Refuse for subagents rather than handing back the parent's id. Both
    # branches below resolve to the parent for a subagent — the env var
    # because Claude Code seeds it with the parent's id, the heuristic because
    # it only considers TOP-LEVEL transcripts (PP-788v cause #1).
    if caller_is_subagent; then
      refuse_subagent "discover a session_id"
      exit 1
    fi
    # Prefer the env var set by Claude Code's hook context — it is guaranteed
    # correct for the calling session. Fall back to the transcript heuristic
    # only when the env var is absent, and warn that the result may be wrong
    # when multiple sessions are active concurrently (PP-bh7w).
    if [[ -n "${CLAUDE_SESSION_ID:-}" ]]; then
      printf '%s\n' "$CLAUDE_SESSION_ID"
    else
      printf 'WARNING: CLAUDE_SESSION_ID is not set; falling back to transcript heuristic.\n' >&2
      printf 'WARNING: This result may be incorrect when multiple Claude sessions are active.\n' >&2
      printf 'WARNING: Pass the session_id explicitly, or run from a hook context where CLAUDE_SESSION_ID is set.\n' >&2
      discover_session_id || { printf '(could not discover)\n' >&2; exit 1; }
    fi
    ;;

  *)
    # Spell each subcommand out rather than factoring SESSION_ID into a single
    # trailing `[SESSION_ID]`: it is REQUIRED for whoami and register and
    # accepted by neither list nor discover, so the collapsed form misleads on
    # exactly the mistyped-subcommand path that prints this.
    printf 'Usage: huddle-whoami.sh <subcommand>\n' >&2
    printf '  whoami SESSION_ID                     Print the name registered for SESSION_ID\n' >&2
    printf '  register [--force] NAME SESSION_ID    Register SESSION_ID as NAME\n' >&2
    printf '  list                                  Print every session_id → name pair\n' >&2
    printf '  discover                              Print the best-guess session_id of this shell\n' >&2
    exit 1
    ;;
esac

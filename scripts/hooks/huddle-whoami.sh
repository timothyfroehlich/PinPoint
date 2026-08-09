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
#   discover                 Print the session_id of the calling shell. Uses
#                            $CLAUDE_CODE_SESSION_ID when set (exact), then
#                            $CLAUDE_SESSION_ID as a fallback for other
#                            harnesses, then the transcript heuristic with a
#                            warning (Claude Code only; see WARNING below).
#                            Refuses for subagents.
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
# when the caller explicitly requests it and $CLAUDE_CODE_SESSION_ID is absent.

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
# DETECTION IS BY TRANSCRIPT PATH, NOT BY ENV (PP-uxnn). The original guard
# keyed off CLAUDE_CODE_CHILD_SESSION plus an AI_AGENT ending in `_agent`, on
# the belief that Claude Code seeds those only into a dispatch. It does not.
# The CLI builds the environment of EVERY shell the Bash tool spawns with
#   T2t({sessionId: <session id>, effortLevel: …, source: "agent"})
# and `source: "agent"` there means "the model is spawning this process" — any
# tool call — not "dispatched subagent". So both markers are present in a
# top-level session's Bash shell too, the predicate was true for everyone, and
# from 2026-08-08 every Claude session on the machine was locked out of
# registering. (Verified on 2.1.224/225/226; a top-level session and a
# dispatched subagent were measured to have byte-identical values for
# AI_AGENT, CLAUDE_CODE_CHILD_SESSION and CLAUDE_CODE_SESSION_ID. There is no
# env-level discriminator.)
#
# The docs say the same thing, and are the durable citation now that the
# reasoning above rests on a minified bundle that will be shaped differently
# next release. Per https://code.claude.com/docs/en/env-vars.md,
# CLAUDE_CODE_CHILD_SESSION is "set to 1 in subprocesses Claude Code spawns
# via the Bash, PowerShell, and Monitor tools, hook commands, and status line
# commands" — every Bash-tool shell, not a dispatch marker. Its actual purpose
# is unrelated to subagents: it "distinguishes a nested claude session from a
# top-level claude launched in an IDE-integrated terminal", so a nested TUI is
# excluded from --resume, --continue and `claude agents`. AI_AGENT appears
# nowhere in the documentation at all — the old guard rested half on a
# misread variable and half on an undocumented internal. No documented
# variable distinguishes a dispatched subagent from its parent.
#
# What IS different is where the harness records the call. Claude Code writes
# a top-level session's transcript to <project>/<session>.jsonl and a
# dispatched subagent's to <project>/<session>/subagents/<agent>.jsonl — the
# same `*/subagents/*` signal huddle-poll.sh and huddle-session-start.sh
# already use, which they get free from their hook payload. A script invoked
# from the Bash tool has to find its own record instead: the tool_use for the
# running command is USUALLY flushed to the CALLING agent's transcript before
# the command executes, so the newest record naming this script identifies the
# caller.
#
# "Usually" is load-bearing and was originally written as a certainty. The
# flush is not guaranteed — a top-level `discover` was observed running with
# its own record still unwritten. So the newest record is only trusted when it
# is also RECENT (see WHOAMI_FRESH_SECONDS); otherwise the read is treated as
# indeterminate. Nothing here is a security boundary — it picks between a
# clear error message and a confusing one, and `register`'s rebind guard is
# what actually prevents the damage.
#
# Fails open by design, in both the old sense and a new one: other harnesses
# (Antigravity, Codex) do not write these transcripts and are unaffected, and
# an indeterminate read — no matching record, an unrecognised layout, an
# invocation wrapped in another script — is treated as "not a subagent" and
# falls back to the harness-agnostic rebind guard in `register`.

# The literal that must appear in the caller's recorded command. Every
# documented invocation is `bash scripts/hooks/huddle-whoami.sh …` typed by the
# agent, so the script's filename is in the command string verbatim.
WHOAMI_SIGNATURE=$(basename "$0")

# Regex for a command that RUNS this script, as opposed to one that merely
# names it. `contains($sig)` is not enough: `rg -n discover
# scripts/hooks/huddle-whoami.sh` contains the signature and is a Bash tool_use,
# but reading the file is not invoking it — and an agent researching this guard
# does exactly that. Both misreadings are live: a subagent that greps the file
# makes its parent look like a subagent, and a parent that cats it makes a real
# subagent look top-level.
#
# So the signature must sit in COMMAND POSITION: at the start of the command,
# on a new LINE, or after a `;`/`&`/`|` separator, optionally behind a
# `bash`/`sh` prefix, and optionally behind a directory path. As an argument to
# some other program it does not count.
#
# The newline in the separator class is load-bearing. jq's Oniguruma runs with
# ONIG_OPTION_SINGLELINE, so `^` means START OF STRING, not start of line —
# without `\n` here, a multi-line command matched nothing at all, and 17.5% of
# real Bash tool_use commands in this project's transcripts are multi-line
# (117 of 669 across the 8 newest). A subagent running the ordinary
# `cd "$REPO"\nbash scripts/hooks/huddle-whoami.sh register …` was classified
# top-level and could clobber the parent's mapping — the PP-788v path. Every
# INVOCATIONS test case was single-line, so the suite stayed green through it.
#
# Known and accepted gap: a wrapper prefix other than bash/sh (`timeout 5 bash
# …`, `env FOO=1 …`) still misses. That is the fail-OPEN direction, caught by
# `register`'s rebind guard, and widening the pattern to chase it would risk
# false positives, which have no backstop and lock a session out.
WHOAMI_INVOCATION_RE="(^|[;&|\\n][[:space:]]*)[[:space:]]*(([^[:space:]]*/)?(ba)?sh[[:space:]]+)?([^[:space:]]*/)?$(
  printf '%s' "$WHOAMI_SIGNATURE" | sed 's/\./\\./g'
)([[:space:]]|$)"

# How many trailing records to scan. The caller's tool_use is normally the LAST
# line, but records land after it: a PreToolUse hook_success attachment
# (measured: 1 of 34 Bash calls), and — the bigger effect — parallel tool calls,
# which write one record per tool_use, with runs of 5 consecutive tool_use
# records measured in this project's transcripts. A window of 5 sat exactly at
# that boundary, so a batched call could push the caller's own record out of
# view. `tail` on a few more lines costs nothing.
WHOAMI_TAIL_RECORDS=25

# How recent a record must be to count as evidence about the process running
# right now, in seconds.
#
# Without this bound the guard reads STALE evidence and refuses a legitimate
# top-level session (PP-uxnn, second bug). The flush of the caller's own
# tool_use is not guaranteed to happen before the command executes — measured
# live: a top-level `discover` whose record had not yet been written lost to an
# 18-minute-old record left in a subagent transcript by an earlier dispatch,
# and the session was told it was a subagent. Any session that has ever
# dispatched a subagent touching this script was one unflushed write away from
# being locked out, which is the exact failure this detection replaced.
#
# A real caller's record is written moments before the command runs, so a
# generous bound separates the two cases cleanly. Anything older is not
# evidence about this process and is ignored, which degrades to "indeterminate"
# — deliberately the fail-OPEN direction, backstopped by the rebind guard in
# `register`.
WHOAMI_FRESH_SECONDS=120

# jq program: newest epoch-MILLISECONDS among the input records that record an
# actual Bash invocation of this script, or nothing. $re is
# WHOAMI_INVOCATION_RE.
#
# THE MATCH MUST BE STRUCTURAL, NOT A SUBSTRING OF THE LINE. A raw
# `grep -F huddle-whoami.sh` over the JSONL matches any record that merely
# mentions the path, which is not the same claim at all. Measured in a live
# transcript, the raw grep's matches in one 25-record window were a
# `file-history-snapshot`, a `queue-operation` and a `user` message — and NOT
# ONE was a Bash tool_use invoking the script. Editing this file is enough to
# produce matching records. Both misreadings are reachable: a subagent that
# merely greps the file makes the parent look like a subagent (the PP-uxnn
# lockout again), and a parent that merely cats it makes a real subagent look
# top-level (the PP-788v clobber). So: require a tool_use block, name Bash, and
# the signature inside input.command.
#
# Milliseconds are kept. Truncating to whole seconds made same-second records
# compare equal, and the caller's loop keeps the FIRST candidate on a tie —
# always the top-level transcript — so a genuine subagent record 0.4s newer
# than an unrelated parent record silently lost. The bias was systematic in the
# fail-open direction.
#
# `fromjson? // empty` skips malformed or partially-flushed lines instead of
# aborting the whole read, which matters when the file is being appended to as
# it is read. `fromdateiso8601` rejects fractional seconds, so the fraction is
# split off and re-added as milliseconds.
# shellcheck disable=SC2016  # $re is a jq variable (--arg re), not a shell one
WHOAMI_JQ_NEWEST_EPOCH_MS='
  def epoch_ms:
    capture("^(?<base>[^.]+?)(?:\\.(?<frac>[0-9]+))?Z$")
    | (((.base + "Z") | fromdateiso8601) * 1000)
      + (((.frac // "0") + "000")[0:3] | tonumber);
  [ inputs
    | fromjson? // empty
    | select(.timestamp != null)
    | select(
        # `?` on both steps: a record whose .message is not an object (a plain
        # string, say) makes a bare .message.content raise, and jq aborts the
        # WHOLE program on the first such record. The caller swallows that
        # (`2>/dev/null || true`), so one odd record would silently disable
        # detection for the entire transcript. Every other risky step here is
        # already defensive for the same reason.
        (.message?.content? // [])
        | if type == "array" then
            any(
              .type == "tool_use"
              and .name == "Bash"
              and ((.input.command // "") | test($re))
            )
          else false end
      )
    | (.timestamp | epoch_ms? // empty)
  ] | max // empty
'

# Newest record in $1 that invokes this script AND is no older than
# $WHOAMI_FRESH_SECONDS, as epoch milliseconds; empty if there is none.
newest_fresh_signature_epoch_ms() {
  local ms now_ms
  ms=$(
    jq -n -R --arg re "$WHOAMI_INVOCATION_RE" "$WHOAMI_JQ_NEWEST_EPOCH_MS" \
      < <(tail -n "$WHOAMI_TAIL_RECORDS" "$1" 2>/dev/null) 2>/dev/null || true
  )
  [[ -n $ms ]] || return 0
  now_ms=$(jq -n 'now * 1000 | floor')
  # Future-dated records (clock skew) are as untrustworthy as stale ones.
  if ((ms <= now_ms && now_ms - ms <= WHOAMI_FRESH_SECONDS * 1000)); then
    printf '%s\n' "$ms"
  fi
}

# Path of the transcript belonging to the agent whose tool call is running us,
# or exit 1 when that cannot be determined. Candidates are the session's own
# top-level transcript plus every subagent transcript under it; the one holding
# the most recent FRESH record that INVOKES this script wins, which is the
# caller's, because that record was written moments ago. Stale records are
# ignored entirely rather than ranked (see WHOAMI_FRESH_SECONDS), and records
# that merely mention the script do not count at all (see
# WHOAMI_JQ_NEWEST_EPOCH_MS).
caller_transcript() {
  local sid=${CLAUDE_CODE_SESSION_ID:-}
  [[ -n $sid ]] || return 1
  local dir
  dir=$(project_transcript_dir)
  [[ -d $dir ]] || return 1
  local candidates=()
  shopt -s nullglob
  candidates=("$dir/$sid.jsonl" "$dir/$sid"/subagents/*.jsonl)
  shopt -u nullglob
  local best_file="" best_ms="" file ms
  for file in "${candidates[@]}"; do
    ms=$(newest_fresh_signature_epoch_ms "$file")
    [[ -n $ms ]] || continue
    if [[ -z $best_ms ]] || ((ms > best_ms)); then
      best_ms=$ms
      best_file=$file
    fi
  done
  [[ -n $best_file ]] || return 1
  printf '%s\n' "$best_file"
}

caller_is_subagent() {
  local transcript
  transcript=$(caller_transcript) || return 1
  case "$transcript" in
    */subagents/*) return 0 ;;
    *) return 1 ;;
  esac
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
    # Prefer the env var Claude Code seeds into the shell — it is exact, where
    # the transcript heuristic is a guess. Safe to trust HERE specifically:
    # it holds the PARENT's id inside a subagent, but the guard above already
    # returned for that case, so reaching this line means the caller is
    # top-level and the id is its own.
    #
    # $CLAUDE_CODE_SESSION_ID is the real variable name, documented at
    # https://code.claude.com/docs/en/env-vars.md ("Set automatically to the
    # current session ID in Bash and PowerShell tool subprocesses, hook
    # command subprocesses, and stdio MCP server subprocesses"). This used to
    # read $CLAUDE_SESSION_ID — no such variable exists, so the exact path was
    # unreachable and every `discover` fell through to the heuristic and its
    # three warnings (PP-uxnn). The test suite did not catch it because it
    # sets the variable it asserts on; the assertion was self-fulfilling.
    #
    # $CLAUDE_SESSION_ID is still read, as a FALLBACK — not an override. It
    # loses to Claude's own variable whenever both are set, so a non-Claude
    # shim launched from inside a Claude Code shell inherits Claude's id and
    # gets that, even having exported its own. Documented as the lesser of two
    # imperfect options: making it win would let one stale value in a shell
    # profile silently misroute every session on the machine, which is the
    # failure mode this file already has two regressions for. A harness that
    # needs certainty passes the id as an argument — the documented route, and
    # what .agents/hooks/antigravity-bootstrap.cjs does.
    #
    # Fall back to the transcript heuristic only when neither is set, and warn
    # that the result may be wrong when multiple sessions are active
    # concurrently (PP-bh7w).
    session_id_env="${CLAUDE_CODE_SESSION_ID:-${CLAUDE_SESSION_ID:-}}"
    if [[ -n "$session_id_env" ]]; then
      printf '%s\n' "$session_id_env"
    else
      printf 'WARNING: CLAUDE_CODE_SESSION_ID is not set; falling back to transcript heuristic.\n' >&2
      printf 'WARNING: This result may be incorrect when multiple Claude sessions are active.\n' >&2
      printf 'WARNING: Pass the session_id explicitly, or run from a context where CLAUDE_CODE_SESSION_ID is set.\n' >&2
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

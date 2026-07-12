#!/usr/bin/env bash
# session-start-chores-nag.sh — SessionStart hook: nudge when the weekly chores
# are overdue.
#
# The recurring "Weekly Chores" bead (labeled `weekly-chore`) is the durable,
# beads-synced state + due-date holder. This hook looks it up BY LABEL (never a
# hardcoded ID — the ID differs per machine/db and the bead may be recreated),
# reads its `defer_until` + `status`, and injects ONE line on stdout that Claude
# Code surfaces as session context:
#
#     🧹 Weekly chores are N days overdue — say "let's do chores".
#
# State machine (defer_until vs now, gated by status):
#   - DORMANT  — defer_until in the FUTURE            → no nag (between cycles).
#   - DUE      — defer_until in the PAST, status is
#                NOT in_progress and NOT closed       → NAG.
#   - WORKING  — status == in_progress                → no nag (chores under way;
#                the operator moves the bead to in_progress at the start of a
#                chores session, then re-defers to next Saturday when done).
#   - (a bead with no defer_until — created before its first defer — is silent.)
#
# Design: PP-ld0o.3 (Option C — recurring bead + SessionStart nag). Doing chores
# on ANY machine re-defers the bead and the nag clears everywhere (beads sync).
# The runbook the chores session follows: .agents/skills/pinpoint-chores/SKILL.md.
#
# Why SessionStart (not UserPromptSubmit): the nag should match "when I start
# talking to you", not fire on every message. Mirrors the huddle /
# orphan-sweep SessionStart-nudge pattern (cheap, one line, fail-open).
#
# Guardrails:
#   - Best-effort: every failure path exits 0 silently. This hook must NEVER
#     block or fail a session start.
#   - Skips subagent sessions (transcript path under /subagents/) — the nag is
#     for Tim's interactive sessions, not tool-spawned agents.
#   - Single fast `bd list` query, wrapped in a short timeout so a cold dolt
#     server can't stall session start.

set -u

# bd unavailable → nothing to do.
command -v bd >/dev/null 2>&1 || exit 0

# Read stdin JSON (best-effort). Skip subagent sessions.
INPUT=""
if [[ ! -t 0 ]]; then
  INPUT=$(cat)
fi
if [[ -n "$INPUT" ]]; then
  TRANSCRIPT_PATH=$(
    printf '%s' "$INPUT" | python3 -c "
import sys, json
try:
    print(json.load(sys.stdin).get('transcript_path') or '')
except Exception:
    print('')
" 2>/dev/null
  ) || TRANSCRIPT_PATH=""
  case "$TRANSCRIPT_PATH" in
    */subagents/*) exit 0 ;;
    *) ;;
  esac
fi

# Look up the chores bead by its stable `weekly-chore` label. The call is ALWAYS
# time-bounded so a cold/hung dolt server can't stall session start — using the
# same timeout/gtimeout/perl-alarm fallback ladder as session-start-orphan-sweep.sh
# (perl covers macOS boxes that ship neither coreutils `timeout` nor `gtimeout`).
# Fail open on any error.
if command -v timeout >/dev/null 2>&1; then
  JSON=$(timeout 4 bd list --label weekly-chore --json 2>/dev/null) || exit 0
elif command -v gtimeout >/dev/null 2>&1; then
  JSON=$(gtimeout 4 bd list --label weekly-chore --json 2>/dev/null) || exit 0
else
  JSON=$(perl -e '
    use strict;
    $SIG{ALRM} = sub { kill 15, -$$; exit 0 };
    alarm 4;
    setpgrp 0, 0;
    exec @ARGV
  ' bd list --label weekly-chore --json 2>/dev/null) || exit 0
fi
[[ -n "$JSON" ]] || exit 0

MSG=$(
  printf '%s' "$JSON" | python3 -c "
import sys, json, datetime

try:
    beads = json.load(sys.stdin)
except Exception:
    sys.exit(0)

now = datetime.datetime.now(datetime.timezone.utc)
for b in beads:
    # WORKING or done: chores actively under way (in_progress) or the bead was
    # closed — never nag in either state.
    if b.get('status') in ('in_progress', 'closed'):
        continue
    du = b.get('defer_until')
    if not du:
        # Not armed yet (created before its first defer) — no nag.
        continue
    try:
        dt = datetime.datetime.fromisoformat(du.replace('Z', '+00:00'))
    except Exception:
        continue
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    if now <= dt:
        # This bead is still dormant — keep scanning; another weekly-chore bead
        # (e.g. a pre-sync duplicate) may be overdue and should still nag.
        continue
    days = (now - dt).days  # floor: whole days past the defer date
    if days < 1:
        print('🧹 Weekly chores are due today — say \"let\'s do chores\".')
    else:
        unit = 'day' if days == 1 else 'days'
        print(f'🧹 Weekly chores are {days} {unit} overdue — say \"let\'s do chores\".')
    break
" 2>/dev/null
) || exit 0

[[ -n "$MSG" ]] && printf '%s\n' "$MSG"
exit 0

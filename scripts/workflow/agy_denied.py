#!/usr/bin/env python3
"""Report the tool calls agy's permission list refused, as candidate allow-rules.

Usage: ./scripts/workflow/agy_denied.py [--runs N] [--json] [--all]

  --runs N  Look at the N most recent agy CLI logs (default 1 — the last run).
  --json    Emit the rules as a JSON array, ready to splice into settings.json.
  --all     Show every denial, not just one line per distinct rule.

## Why this exists

agy's allow-list is not something you can derive by reasoning about it. In headless
mode a denied tool is auto-denied with no prompt, and the run either degrades quietly
or produces nothing — the failure surfaces as "no output produced", which names the
permission system but not the command. Meanwhile agy improvises: across successive
runs of the *same* prompt it reached for `pwd && ls -la`, then `git branch -a; git
worktree list`, then `find`, then `python3 -c`. Guessing the list is a losing game;
reading back what it actually wanted is not.

So the loop is: run a review, run this, decide which of the refused calls are
legitimate, add those to `permissions.allow`. Deciding is the point — this script
deliberately does NOT edit settings.json. A denial is evidence of what agy wanted, not
an argument that it should have it, and `command(gh)` is the standing example: the
wrapper posts the review precisely so agy cannot attest its own work.

## What it reads

`~/.gemini/antigravity-cli/log/cli-*.log`. Denials appear there as
`permission_manager.go … permission check failed for command "…"`, which is logged
whether or not the run produced output — the one place the refused command is named.
"""

from __future__ import annotations

import argparse
import json
import re
import shlex
import sys
from pathlib import Path

LOG_DIR = Path.home() / ".gemini" / "antigravity-cli" / "log"

_DENIED = re.compile(r'permission check failed for command "((?:[^"\\]|\\.)*)"')

# Commands whose first word alone is too coarse a rule. `git` is the case that matters:
# `command(git)` would allow `git push` and `git reset --hard`, and the review worktree
# is a LINKED worktree whose .git points at the real repository — so a rule written at
# that granularity hands agy the ability to move refs in PinPoint itself.
_TWO_WORD = {"git", "gh", "npx", "docker", "supabase", "cargo", "uv"}

# Runners where the second word is a bare subcommand and the THIRD carries the meaning.
# `command(pnpm run)` would allow `pnpm run db:reset` and `pnpm run e2e:all` along with
# the static checks — the granularity has to sit on the script name.
_THREE_WORD = {("pnpm", "run"), ("npm", "run"), ("yarn", "run")}


def parse_denials(text):
    """Every denied command string in one log, in order, with duplicates kept."""
    return [
        m.group(1).replace('\\"', '"').replace("\\\\", "\\")
        for m in _DENIED.finditer(text)
    ]


def suggest_rule(command):
    """The narrowest `command(...)` rule that would have allowed this invocation.

    Only ever a suggestion. A compound command (`pwd && ls -la`) has no single rule that
    covers it, so the caller sees the raw string and decides.
    """
    try:
        parts = shlex.split(command)
    except ValueError:
        parts = command.split()
    if not parts:
        return None
    head = parts[0]
    if (
        len(parts) > 2
        and (head, parts[1]) in _THREE_WORD
        and not parts[2].startswith("-")
    ):
        return f"command({head} {parts[1]} {parts[2]})"
    if head in _TWO_WORD and len(parts) > 1 and not parts[1].startswith("-"):
        return f"command({head} {parts[1]})"
    return f"command({head})"


def is_compound(command):
    """True if the string chains several commands, so no one rule covers it."""
    return any(token in command for token in ("&&", "||", ";", "|", "$(", "`"))


def recent_logs(count):
    logs = sorted(
        LOG_DIR.glob("cli-*.log"), key=lambda p: p.stat().st_mtime, reverse=True
    )
    return logs[:count]


def collect(count):
    findings = []
    for log in recent_logs(count):
        try:
            text = log.read_text(errors="replace")
        except OSError:
            continue
        for command in parse_denials(text):
            findings.append(
                {
                    "log": log.name,
                    "command": command,
                    "rule": suggest_rule(command),
                    "compound": is_compound(command),
                }
            )
    return findings


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--runs", type=int, default=1)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--all", action="store_true")
    args = parser.parse_args(argv)

    if not LOG_DIR.is_dir():
        print(f"no agy logs at {LOG_DIR}", file=sys.stderr)
        return 1

    findings = collect(args.runs)
    if not findings:
        print(f"No denied tool calls in the last {args.runs} agy run(s).")
        return 0

    if args.json:
        seen = {f["rule"] for f in findings if f["rule"] and not f["compound"]}
        print(json.dumps(sorted(seen), indent=2))
        return 0

    print(f"Denied tool calls across the last {args.runs} agy run(s):\n")
    shown = set()
    for finding in findings:
        # `--all` bypasses deduplication entirely rather than merely widening the key.
        # Keying on (rule, command) still collapsed repeated *identical* denials, which
        # are the signal worth seeing — agy retrying the same refused command across a
        # run is what tells you it is stuck on that command rather than exploring.
        # `parse_denials` keeps duplicates in order for exactly this reason.
        if not args.all:
            key = finding["rule"]
            if key in shown:
                continue
            shown.add(key)
        print(f"  {finding['command']}")
        if finding["compound"]:
            print(
                "      compound — no single rule covers it; allow each part separately"
            )
        else:
            print(f"      candidate: {finding['rule']}")
    print(
        "\nAdd the ones agy legitimately needs to permissions.allow in\n"
        f"  {Path.home() / '.gemini/antigravity-cli/settings.json'}\n"
        "Deciding is the point: a denial says what agy wanted, not that it should have it."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

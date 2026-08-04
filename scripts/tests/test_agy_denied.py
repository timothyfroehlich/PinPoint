"""Tests for scripts/workflow/agy_denied.py — the agy permission feedback loop.

agy's allow-list cannot be derived by reasoning about it: headless denials are silent,
and across successive runs of the same prompt agy reached for `pwd && ls -la`, then
`git branch -a; git worktree list`, then `find`, then `python3 -c`. This script reads
back what it actually wanted so the list is built from evidence.

The tests that matter are about RULE GRANULARITY. A suggestion that is too coarse is
worse than no suggestion, because it looks authoritative: `command(pnpm run)` reads as
"let it run the checks" and also grants `pnpm run db:reset`, and `command(git)` reads as
"let it read history" and also grants `git push` — into a linked worktree whose .git
points at the real repository.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "workflow"))

from agy_denied import (  # noqa: E402
    is_compound,
    parse_denials,
    suggest_rule,
)

LOG_LINE = (
    "ERROR: logging before google.Init: E0802 14:44:57.605650     611 "
    "permission_manager.go:900] permission check failed: permission check failed for "
    'command "{cmd}": user denied permission to run command:'
)


class TestParseDenials:
    def test_extracts_the_refused_command(self):
        assert parse_denials(LOG_LINE.format(cmd="git checkout abc123")) == [
            "git checkout abc123"
        ]

    def test_finds_every_denial_in_a_log(self):
        text = "\n".join(
            LOG_LINE.format(cmd=c)
            for c in ("find /home -name x", "python3 -c 1", "rm -rf /")
        )
        assert len(parse_denials(text)) == 3

    def test_a_log_with_no_denials_yields_nothing(self):
        assert parse_denials("INFO: everything was fine\nINFO: still fine") == []

    def test_escaped_quotes_inside_the_command_survive(self):
        text = LOG_LINE.format(cmd=r"rg \"CORE-\" AGENTS.md")
        assert parse_denials(text) == ['rg "CORE-" AGENTS.md']


class TestRuleGranularity:
    """Each of these is a rule that would over-grant if written one word shorter."""

    @pytest.mark.parametrize(
        ("command", "expected"),
        [
            # `command(git)` would also grant push/reset/checkout.
            ("git log --oneline -20", "command(git log)"),
            ("git blame src/a.ts", "command(git blame)"),
            ("git push origin main", "command(git push)"),
            # `command(pnpm run)` would also grant db:reset and e2e:all.
            ("pnpm run check:python", "command(pnpm run check:python)"),
            ("pnpm run db:reset", "command(pnpm run db:reset)"),
            ("npm run build", "command(npm run build)"),
            # Single-word tools need no further narrowing.
            ("rg CORE- AGENTS.md", "command(rg)"),
            ("pwd", "command(pwd)"),
        ],
    )
    def test_suggested_rule_is_as_narrow_as_the_command_allows(self, command, expected):
        assert suggest_rule(command) == expected

    def test_a_dangerous_and_a_safe_invocation_never_share_a_rule(self):
        # The whole point: allowing one must not silently allow the other.
        assert suggest_rule("pnpm run check") != suggest_rule("pnpm run db:reset")
        assert suggest_rule("git log") != suggest_rule("git push")

    def test_a_flag_in_second_position_does_not_become_the_rule(self):
        assert suggest_rule("git --no-pager log") == "command(git)"

    def test_empty_command_has_no_rule(self):
        assert suggest_rule("") is None

    def test_unbalanced_quotes_do_not_raise(self):
        assert suggest_rule('rg "unterminated') is not None


class TestCompoundDetection:
    """A chained command has no single rule, and saying otherwise would mislead."""

    @pytest.mark.parametrize(
        "command",
        [
            "pwd && ls -la",
            "git branch -a; git worktree list",
            "cat x | wc -l",
            "echo $(pwd)",
        ],
    )
    def test_chains_are_flagged(self, command):
        assert is_compound(command)

    @pytest.mark.parametrize(
        "command", ["git log --oneline", "rg foo src/", "pnpm run check"]
    )
    def test_plain_invocations_are_not(self, command):
        assert not is_compound(command)

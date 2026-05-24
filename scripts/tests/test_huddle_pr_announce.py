"""Unit tests for scripts/hooks/huddle-pr-announce.sh."""

import json
import os
import stat
import subprocess
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

HOOK_PATH = Path(__file__).parent.parent / "hooks" / "huddle-pr-announce.sh"


@contextmanager
def fake_gh_on_path(script_body: str) -> Iterator[str]:
    """Yield a PATH string with a temp dir holding a fake `gh` executable prepended.

    `script_body` is the bash body of the stub (after the shebang). Use it to
    simulate `gh pr view ... --jq .title` returning a title or failing, without a
    network call. The real `gh` is shadowed only for the duration of the context.
    """
    with tempfile.TemporaryDirectory() as tmp:
        gh_stub = Path(tmp) / "gh"
        gh_stub.write_text(f"#!/usr/bin/env bash\n{script_body}\n")
        gh_stub.chmod(
            gh_stub.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH
        )
        yield f"{tmp}{os.pathsep}{os.environ.get('PATH', '')}"


def run_hook(
    stdin_data: dict,
    env_modifications: dict | None = None,
) -> tuple[int, str, str]:
    """Run the hook with the given stdin payload and return (rc, stdout, stderr)."""
    env = os.environ.copy()
    # HUDDLE_DRY_RUN=1 makes the hook print the would-post text instead of calling bd.
    env["HUDDLE_DRY_RUN"] = "1"
    if env_modifications:
        env.update(env_modifications)

    process = subprocess.Popen(
        ["bash", str(HOOK_PATH)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        text=True,
    )
    stdout, stderr = process.communicate(input=json.dumps(stdin_data))
    return process.returncode, stdout, stderr


# ---------------------------------------------------------------------------
# Helpers: synthetic stdin payloads
# ---------------------------------------------------------------------------


def _bash_pr_create_payload(
    command: str = "gh pr create --title 'feat: something (PP-abc1)' --body '...'",
    pr_url: str = "https://github.com/timothyfroehlich/PinPoint/pull/42",
    pr_title: str | None = None,
) -> dict:
    """PostToolUse payload for a successful `gh pr create` Bash invocation."""
    return {
        "session_id": "test-session-123",
        "transcript_path": "/tmp/sessions/test-session-123.jsonl",
        "cwd": "/tmp/project",
        "hook_event_name": "PostToolUse",
        "tool_name": "Bash",
        "tool_input": {"command": command},
        "tool_response": {
            "output": f"https://github.com/timothyfroehlich/PinPoint/pull/42\n{pr_url}"
        },
    }


def _mcp_create_pr_payload(
    pr_number: int = 99,
    pr_url: str = "https://github.com/timothyfroehlich/PinPoint/pull/99",
    pr_title: str = "feat(huddle): auto-post notices (PP-uq5i)",
) -> dict:
    """PostToolUse payload for a successful mcp__github__create_pull_request call."""
    return {
        "session_id": "test-session-456",
        "transcript_path": "/tmp/sessions/test-session-456.jsonl",
        "cwd": "/tmp/project",
        "hook_event_name": "PostToolUse",
        "tool_name": "mcp__github__create_pull_request",
        "tool_input": {
            "owner": "timothyfroehlich",
            "repo": "PinPoint",
            "title": pr_title,
            "body": "Description here.",
            "head": "feat/huddle-PP-uq5i",
            "base": "main",
        },
        "tool_response": {
            "number": pr_number,
            "html_url": pr_url,
            "title": pr_title,
        },
    }


def _non_pr_bash_payload(command: str = "git status") -> dict:
    """PostToolUse payload for a non-PR-create Bash call."""
    return {
        "session_id": "test-session-789",
        "transcript_path": "/tmp/sessions/test-session-789.jsonl",
        "cwd": "/tmp/project",
        "hook_event_name": "PostToolUse",
        "tool_name": "Bash",
        "tool_input": {"command": command},
        "tool_response": {"output": "On branch main\n"},
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestBashPrCreatePayload:
    def test_parses_pr_number(self) -> None:
        payload = _bash_pr_create_payload()
        rc, stdout, stderr = run_hook(payload)
        assert rc == 0, f"Hook exited {rc}; stderr={stderr!r}"
        assert "PR #42" in stdout, f"Expected 'PR #42' in stdout, got: {stdout!r}"

    def test_parses_bead_id_from_command(self) -> None:
        payload = _bash_pr_create_payload(
            command="gh pr create --title 'feat: do a thing (PP-abc1)' --body '...'",
        )
        rc, stdout, _ = run_hook(payload)
        assert rc == 0
        # Without HUDDLE_PR_TITLE_OVERRIDE the Bash path has no title; PR number
        # must appear but bead/title parts are absent. Just confirm no crash.
        assert "PR #42" in stdout

    def test_output_contains_sign_off(self) -> None:
        payload = _bash_pr_create_payload()
        rc, stdout, _ = run_hook(payload)
        assert rc == 0
        assert "—huddle-auto" in stdout or "—" in stdout

    def test_custom_huddle_name(self) -> None:
        payload = _bash_pr_create_payload()
        rc, stdout, _ = run_hook(
            payload, env_modifications={"HUDDLE_NAME": "Claude-TestAgent"}
        )
        assert rc == 0
        assert "—Claude-TestAgent" in stdout


class TestBashPrCreateWithTitleOverride:
    """Tests for the enriched Bash path using HUDDLE_PR_TITLE_OVERRIDE.

    HUDDLE_PR_TITLE_OVERRIDE injects a PR title without making a network call,
    so these tests are dry-run-safe while verifying the enriched announcement.
    """

    def test_enriched_output_contains_title_and_bead(self) -> None:
        """Bash path with title override produces title + bead in announcement."""
        payload = _bash_pr_create_payload()
        rc, stdout, stderr = run_hook(
            payload,
            env_modifications={"HUDDLE_PR_TITLE_OVERRIDE": "some fix (PP-abc.1)"},
        )
        assert rc == 0, f"Hook exited {rc}; stderr={stderr!r}"
        assert "PR #42" in stdout, f"Expected 'PR #42' in stdout, got: {stdout!r}"
        assert "PP-abc.1" in stdout, f"Expected 'PP-abc.1' in stdout, got: {stdout!r}"
        assert "some fix" in stdout, f"Expected title in stdout, got: {stdout!r}"

    def test_enriched_output_format(self) -> None:
        """Full format: 'Opened PR #N (PP-xxx): <title>. —huddle-auto'."""
        payload = _bash_pr_create_payload()
        rc, stdout, _ = run_hook(
            payload,
            env_modifications={"HUDDLE_PR_TITLE_OVERRIDE": "some fix (PP-abc.1)"},
        )
        assert rc == 0
        assert (
            stdout.strip()
            == "Opened PR #42 (PP-abc.1): some fix (PP-abc.1). —huddle-auto"
        )

    def test_title_without_bead_id(self) -> None:
        """Title override with no bead ID still produces title part."""
        payload = _bash_pr_create_payload()
        rc, stdout, _ = run_hook(
            payload,
            env_modifications={"HUDDLE_PR_TITLE_OVERRIDE": "plain title no bead"},
        )
        assert rc == 0
        assert "PR #42" in stdout
        assert "plain title no bead" in stdout
        assert "PP-" not in stdout

    def test_no_override_falls_back_to_bare(self) -> None:
        """Without override and in dry-run mode, output is the bare PR number message."""
        payload = _bash_pr_create_payload()
        rc, stdout, _ = run_hook(payload)
        assert rc == 0
        # Bare format: no title colon-separator, no bead ID
        assert stdout.strip() == "Opened PR #42. —huddle-auto"


class TestBashPrCreateRealGhFetch:
    """Exercise the production `gh pr view` title-fetch branch with a fake `gh`.

    HUDDLE_FORCE_TITLE_FETCH=1 lets the fetch branch run even under dry-run, so a
    stub `gh` on PATH stands in for the real CLI — verifying the actual invocation
    and fail-open behavior without any network call.
    """

    def test_fetches_title_from_gh(self) -> None:
        """A successful `gh pr view --jq .title` produces an enriched announcement."""
        payload = _bash_pr_create_payload()
        # Stub returns the title (as `gh ... --jq .title` would, i.e. unwrapped).
        with fake_gh_on_path("echo 'some fix (PP-abc.1)'") as path:
            rc, stdout, stderr = run_hook(
                payload,
                env_modifications={"HUDDLE_FORCE_TITLE_FETCH": "1", "PATH": path},
            )
        assert rc == 0, f"Hook exited {rc}; stderr={stderr!r}"
        assert (
            stdout.strip()
            == "Opened PR #42 (PP-abc.1): some fix (PP-abc.1). —huddle-auto"
        )

    def test_gh_failure_falls_back_to_bare(self) -> None:
        """If `gh` exits non-zero, the hook fails open to the bare message."""
        payload = _bash_pr_create_payload()
        with fake_gh_on_path("echo 'gh: not authenticated' >&2; exit 1") as path:
            rc, stdout, stderr = run_hook(
                payload,
                env_modifications={"HUDDLE_FORCE_TITLE_FETCH": "1", "PATH": path},
            )
        assert rc == 0, f"Hook exited {rc}; stderr={stderr!r}"
        assert stdout.strip() == "Opened PR #42. —huddle-auto"

    def test_gh_invoked_with_expected_args(self) -> None:
        """The fetch passes the parsed PR number and the title JSON/jq flags."""
        payload = _bash_pr_create_payload()
        # The hook discards gh's stderr (2>/dev/null), so the stub records its argv
        # to a file named by GH_ARGV_FILE instead.
        with tempfile.TemporaryDirectory() as argv_dir:
            argv_file = Path(argv_dir) / "argv.txt"
            stub = 'printf "%s\\n" "$*" > "$GH_ARGV_FILE"; echo "t (PP-xyz.2)"'
            with fake_gh_on_path(stub) as path:
                rc, stdout, _ = run_hook(
                    payload,
                    env_modifications={
                        "HUDDLE_FORCE_TITLE_FETCH": "1",
                        "PATH": path,
                        "GH_ARGV_FILE": str(argv_file),
                    },
                )
            assert rc == 0
            recorded = argv_file.read_text().strip()
        # gh was called as: pr view 42 --json title --jq .title
        assert recorded == "pr view 42 --json title --jq .title", (
            f"Unexpected gh argv: {recorded!r}"
        )
        assert "PP-xyz.2" in stdout


class TestMcpCreatePrPayload:
    def test_parses_pr_number(self) -> None:
        payload = _mcp_create_pr_payload(pr_number=99)
        rc, stdout, stderr = run_hook(payload)
        assert rc == 0, f"Hook exited {rc}; stderr={stderr!r}"
        assert "PR #99" in stdout, f"Expected 'PR #99' in stdout, got: {stdout!r}"

    def test_parses_pr_title(self) -> None:
        payload = _mcp_create_pr_payload(
            pr_number=99,
            pr_title="feat(huddle): auto-post notices (PP-uq5i)",
        )
        rc, stdout, _ = run_hook(payload)
        assert rc == 0
        assert "auto-post notices" in stdout

    def test_parses_bead_id_from_title(self) -> None:
        payload = _mcp_create_pr_payload(
            pr_number=99,
            pr_title="feat(huddle): auto-post (PP-uq5i)",
        )
        rc, stdout, _ = run_hook(payload)
        assert rc == 0
        assert "PP-uq5i" in stdout

    def test_output_contains_sign_off(self) -> None:
        payload = _mcp_create_pr_payload()
        rc, stdout, _ = run_hook(payload)
        assert rc == 0
        assert "—" in stdout

    def test_custom_huddle_name(self) -> None:
        payload = _mcp_create_pr_payload()
        rc, stdout, _ = run_hook(
            payload, env_modifications={"HUDDLE_NAME": "Antigravity-HuddleFix"}
        )
        assert rc == 0
        assert "—Antigravity-HuddleFix" in stdout


class TestEarlyExit:
    def test_non_pr_bash_produces_no_output(self) -> None:
        payload = _non_pr_bash_payload("git status")
        rc, stdout, stderr = run_hook(payload)
        assert rc == 0, f"Hook failed: stderr={stderr!r}"
        assert stdout == "", f"Expected empty stdout for non-PR-create, got: {stdout!r}"

    def test_pnpm_bash_produces_no_output(self) -> None:
        payload = _non_pr_bash_payload("pnpm run check")
        rc, stdout, _ = run_hook(payload)
        assert rc == 0
        assert stdout == ""

    def test_gh_pr_view_bash_produces_no_output(self) -> None:
        payload = _non_pr_bash_payload("gh pr view 42 --json title")
        rc, stdout, _ = run_hook(payload)
        assert rc == 0
        assert stdout == ""

    def test_bash_pr_create_no_url_in_output_produces_no_output(self) -> None:
        """If gh pr create Bash call's output has no pull URL, no post."""
        payload = {
            "session_id": "test-session",
            "transcript_path": "/tmp/sessions/s.jsonl",
            "cwd": "/tmp/project",
            "hook_event_name": "PostToolUse",
            "tool_name": "Bash",
            "tool_input": {"command": "gh pr create --title 'feat: x'"},
            "tool_response": {"output": "error: something went wrong\n"},
        }
        rc, stdout, _ = run_hook(payload)
        assert rc == 0
        assert stdout == ""

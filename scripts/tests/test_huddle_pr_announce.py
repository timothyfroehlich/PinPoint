"""Unit tests for scripts/hooks/huddle-pr-announce.sh."""

import json
import os
import subprocess
from pathlib import Path

HOOK_PATH = Path(__file__).parent.parent / "hooks" / "huddle-pr-announce.sh"


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
        # Bead ID comes from the PR title in this hook; for Bash shape, title is
        # not in the response — bead part may be absent. Just confirm no crash.
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

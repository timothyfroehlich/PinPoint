"""Unit tests for the WorktreeCreate hook script."""

import json
import os
import subprocess
from pathlib import Path

import pytest

HOOK_PATH = Path(__file__).parent.parent.parent / ".claude/hooks/worktree-create.sh"

# Default SHA the mock git returns for `rev-parse FETCH_HEAD` when a fetch "succeeds".
MOCK_FETCH_SHA = "feedfacecafe0000000000000000000000000000"


@pytest.fixture
def mock_git(tmp_path: Path):
    # Create a dummy git that logs every call and branches on the subcommand so the
    # hook's fetch → rev-parse → worktree-add sequence can be exercised (PP-2cpf):
    #   * `fetch`     — exit code from $MOCK_GIT_FETCH_EXIT (default 0 = success).
    #   * `rev-parse` — print $MOCK_GIT_FETCH_SHA (default MOCK_FETCH_SHA) as FETCH_HEAD.
    #   * anything else (e.g. `worktree add`) — exit 0.
    # Global options like `-C <path>` are skipped when detecting the subcommand.
    git_bin_dir = tmp_path / "bin"
    git_bin_dir.mkdir()
    git_script = git_bin_dir / "git"
    calls_log = tmp_path / "git_calls.txt"

    git_script.write_text(f"""#!/bin/bash
echo "$@" >> {calls_log}
sub=""
skip_next=0
for arg in "$@"; do
  if [ "$skip_next" = "1" ]; then skip_next=0; continue; fi
  case "$arg" in
    -C) skip_next=1 ;;
    -*) : ;;
    *) sub="$arg"; break ;;
  esac
done
case "$sub" in
  fetch) exit ${{MOCK_GIT_FETCH_EXIT:-0}} ;;
  rev-parse) echo "${{MOCK_GIT_FETCH_SHA:-{MOCK_FETCH_SHA}}}"; exit 0 ;;
  *) exit 0 ;;
esac
""")
    git_script.chmod(0o755)

    return {
        "bin_dir": git_bin_dir,
        "log_path": calls_log,
    }


def _worktree_add_call(calls: list[str]) -> str:
    """Return the single `worktree add` call from the recorded git invocations."""
    matches = [c for c in calls if "worktree add" in c]
    assert len(matches) == 1, f"expected exactly one worktree-add call, got: {calls}"
    return matches[0]


def run_hook_raw(
    stdin_raw: str, tmp_path: Path, env_modifications: dict | None = None
) -> tuple[int, str, str]:
    env = os.environ.copy()
    # Isolate HOME and XDG_CONFIG_HOME to prevent test flakiness and interference
    # with developer's config lock file in ~/.config/pinpoint
    fake_home = tmp_path / "fake_home"
    fake_home.mkdir(parents=True, exist_ok=True)
    env["HOME"] = str(fake_home)
    env["XDG_CONFIG_HOME"] = str(fake_home / ".config")

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
    stdout, stderr = process.communicate(input=stdin_raw)
    return process.returncode, stdout, stderr


def run_hook(
    stdin_data: dict, tmp_path: Path, env_modifications: dict | None = None
) -> tuple[int, str, str]:
    return run_hook_raw(json.dumps(stdin_data), tmp_path, env_modifications)


def test_hook_empirical_shape(mock_git: dict, tmp_path: Path) -> None:
    stdin_data = {
        "session_id": "test-session",
        "transcript_path": "test-path",
        "cwd": str(tmp_path),
        "hook_event_name": "WorktreeCreate",
        "name": "agent-emp-test",
    }

    env_mods = {"PATH": f"{mock_git['bin_dir']}:{os.environ['PATH']}"}

    return_code, stdout, stderr = run_hook(stdin_data, tmp_path, env_mods)

    assert return_code == 0, f"Hook failed with stderr: {stderr}"

    assert mock_git["log_path"].exists()
    calls = mock_git["log_path"].read_text().splitlines()

    expected_branch = "worktree-agent-emp-test"
    expected_path = str(tmp_path / ".claude/worktrees/agent-emp-test")
    add_call = _worktree_add_call(calls)
    assert (
        f"-C {tmp_path} worktree add {expected_path} -b {expected_branch}" in add_call
    )


def test_hook_documented_shape(mock_git: dict, tmp_path: Path) -> None:
    stdin_data = {
        "session_id": "test-session",
        "transcript_path": "test-path",
        "cwd": str(tmp_path),
        "hook_event_name": "WorktreeCreate",
        "worktree_id": "agent-doc-test",
        "worktree_path": str(tmp_path / "custom-path"),
    }

    env_mods = {"PATH": f"{mock_git['bin_dir']}:{os.environ['PATH']}"}

    return_code, stdout, stderr = run_hook(stdin_data, tmp_path, env_mods)

    assert return_code == 0, f"Hook failed with stderr: {stderr}"

    assert mock_git["log_path"].exists()
    calls = mock_git["log_path"].read_text().splitlines()

    expected_branch = "worktree-agent-doc-test"
    expected_path = str(tmp_path / "custom-path")
    add_call = _worktree_add_call(calls)
    assert (
        f"-C {tmp_path} worktree add {expected_path} -b {expected_branch}" in add_call
    )


def test_hook_branches_off_fetched_origin_main(mock_git: dict, tmp_path: Path) -> None:
    """On a successful fetch, the worktree branches off the fetched origin/main SHA."""
    stdin_data = {
        "session_id": "test-session",
        "transcript_path": "test-path",
        "cwd": str(tmp_path),
        "hook_event_name": "WorktreeCreate",
        "name": "agent-fresh",
    }

    env_mods = {
        "PATH": f"{mock_git['bin_dir']}:{os.environ['PATH']}",
        "MOCK_GIT_FETCH_EXIT": "0",
        "MOCK_GIT_FETCH_SHA": MOCK_FETCH_SHA,
    }

    return_code, stdout, stderr = run_hook(stdin_data, tmp_path, env_mods)

    assert return_code == 0, f"Hook failed with stderr: {stderr}"

    calls = mock_git["log_path"].read_text().splitlines()
    # The hook fetched origin/main before creating the worktree...
    assert any("fetch --quiet origin main" in c for c in calls), calls
    # ...and used the fetched SHA as the branch base, not the (stale) root HEAD.
    add_call = _worktree_add_call(calls)
    assert add_call.endswith(f"-b worktree-agent-fresh {MOCK_FETCH_SHA}"), add_call


def test_hook_falls_back_to_head_when_fetch_fails(
    mock_git: dict, tmp_path: Path
) -> None:
    """Offline (fetch fails) still creates the worktree, branching off HEAD."""
    stdin_data = {
        "session_id": "test-session",
        "transcript_path": "test-path",
        "cwd": str(tmp_path),
        "hook_event_name": "WorktreeCreate",
        "name": "agent-offline",
    }

    env_mods = {
        "PATH": f"{mock_git['bin_dir']}:{os.environ['PATH']}",
        "MOCK_GIT_FETCH_EXIT": "1",  # simulate no network
    }

    return_code, stdout, stderr = run_hook(stdin_data, tmp_path, env_mods)

    assert return_code == 0, f"Hook failed with stderr: {stderr}"

    calls = mock_git["log_path"].read_text().splitlines()
    add_call = _worktree_add_call(calls)
    assert add_call.endswith("-b worktree-agent-offline HEAD"), add_call


def test_hook_missing_required_fields(mock_git: dict, tmp_path: Path) -> None:
    stdin_data = {
        "session_id": "test-session",
        "transcript_path": "test-path",
        "cwd": str(tmp_path),
        "hook_event_name": "WorktreeCreate",
    }

    env_mods = {"PATH": f"{mock_git['bin_dir']}:{os.environ['PATH']}"}

    return_code, stdout, stderr = run_hook(stdin_data, tmp_path, env_mods)

    assert return_code != 0
    assert "missing cwd, worktree_id, or name" in stderr


def test_hook_malformed_json(mock_git: dict, tmp_path: Path) -> None:
    env_mods = {"PATH": f"{mock_git['bin_dir']}:{os.environ['PATH']}"}
    return_code, stdout, stderr = run_hook_raw("not valid json", tmp_path, env_mods)

    assert return_code != 0
    assert "invalid JSON" in stderr

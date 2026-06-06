"""Unit tests for the WorktreeCreate hook script."""

import json
import os
import subprocess
from pathlib import Path

import pytest

HOOK_PATH = Path(__file__).parent.parent.parent / ".claude/hooks/worktree-create.sh"


@pytest.fixture
def mock_git(tmp_path: Path):
    # Create a dummy git executable that records calls to a file
    git_bin_dir = tmp_path / "bin"
    git_bin_dir.mkdir()
    git_script = git_bin_dir / "git"
    calls_log = tmp_path / "git_calls.txt"

    # Write dummy git script
    git_script.write_text(f"""#!/bin/bash
# Simply log the arguments and exit 0
echo "$@" >> {calls_log}
""")
    git_script.chmod(0o755)

    return {
        "bin_dir": git_bin_dir,
        "log_path": calls_log,
    }


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
    assert len(calls) == 1

    expected_branch = "worktree-agent-emp-test"
    expected_path = str(tmp_path / ".claude/worktrees/agent-emp-test")
    assert (
        f"-C {tmp_path} worktree add {expected_path} -b {expected_branch}" in calls[0]
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
    assert len(calls) == 1

    expected_branch = "worktree-agent-doc-test"
    expected_path = str(tmp_path / "custom-path")
    assert (
        f"-C {tmp_path} worktree add {expected_path} -b {expected_branch}" in calls[0]
    )


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

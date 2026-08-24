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


def test_hook_fails_closed_when_worktree_add_fails(
    mock_git: dict, tmp_path: Path
) -> None:
    """When git worktree add fails, hook must fail closed, run cleanup, and delete branch."""
    # Create mock worktree_cleanup.py in tmp_path/scripts
    scripts_dir = tmp_path / "scripts"
    scripts_dir.mkdir()
    cleanup_log = tmp_path / "cleanup_calls.txt"
    cleanup_script = scripts_dir / "worktree_cleanup.py"
    cleanup_script.write_text(f"""#!/usr/bin/env python3
import sys
from pathlib import Path
Path("{cleanup_log}").write_text(" ".join(sys.argv[1:]))
""")

    # Configure mock git to create target directory and branch before failing on post-checkout
    branch_marker = tmp_path / "branch_created.marker"
    git_script = mock_git["bin_dir"] / "git"
    git_script.write_text(f"""#!/bin/bash
echo "$@" >> {mock_git["log_path"]}
sub=""
skip_next=0
target=""
for arg in "$@"; do
  if [ "$skip_next" = "1" ]; then skip_next=0; continue; fi
  case "$arg" in
    -C|-b) skip_next=1 ;;
    -*) : ;;
    add) : ;;
    *)
      if [ -z "$sub" ]; then
        sub="$arg"
      elif [ -z "$target" ]; then
        target="$arg"
      fi
      ;;
  esac
done
case "$sub" in
  fetch) exit 0 ;;
  rev-parse)
    case "$*" in
      *refs/heads*)
        if [ -f "{branch_marker}" ]; then
          exit 0
        fi
        exit 1
        ;;
    esac
    echo "{MOCK_FETCH_SHA}"
    exit 0
    ;;
  worktree)
    if [ -n "$target" ]; then
      mkdir -p "$target"
    fi
    touch "{branch_marker}"
    echo "fatal: post-checkout hook failed" >&2
    exit 1
    ;;
  *) exit 0 ;;
esac
""")

    stdin_data = {
        "session_id": "test-session",
        "transcript_path": "test-path",
        "cwd": str(tmp_path),
        "hook_event_name": "WorktreeCreate",
        "name": "agent-setup-fail",
    }

    env_mods = {"PATH": f"{mock_git['bin_dir']}:{os.environ['PATH']}"}

    return_code, stdout, stderr = run_hook(stdin_data, tmp_path, env_mods)

    assert return_code != 0
    assert stdout.strip() == ""  # Must NOT print the worktree path on stdout
    assert "permanent error (not retrying)" in stderr
    assert "fatal: post-checkout hook failed" in stderr

    # Verify worktree_cleanup.py was invoked
    assert cleanup_log.exists()
    assert ".claude/worktrees/agent-setup-fail" in cleanup_log.read_text()

    # Verify git branch -D was invoked
    calls = mock_git["log_path"].read_text().splitlines()
    assert any("branch -D worktree-agent-setup-fail" in c for c in calls)


def test_hook_does_not_delete_preexisting_branch_on_add_failure(
    mock_git: dict, tmp_path: Path
) -> None:
    """When a branch existed before, rollback must not delete it."""
    git_script = mock_git["bin_dir"] / "git"
    git_script.write_text(f"""#!/bin/bash
echo "$@" >> {mock_git["log_path"]}
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
  fetch) exit 0 ;;
  rev-parse)
    # Return 0 for verifying branch exists
    echo "existing-sha"
    exit 0
    ;;
  worktree)
    echo "fatal: a branch named 'worktree-agent-existing' already exists" >&2
    exit 1
    ;;
  *) exit 0 ;;
esac
""")

    stdin_data = {
        "session_id": "test-session",
        "transcript_path": "test-path",
        "cwd": str(tmp_path),
        "hook_event_name": "WorktreeCreate",
        "name": "agent-existing",
    }

    env_mods = {"PATH": f"{mock_git['bin_dir']}:{os.environ['PATH']}"}

    return_code, stdout, stderr = run_hook(stdin_data, tmp_path, env_mods)

    assert return_code != 0
    assert "permanent error (not retrying)" in stderr

    calls = mock_git["log_path"].read_text().splitlines()
    # Must NOT run git branch -D because branch existed before
    assert not any("branch -D" in c for c in calls)


def test_hook_cleans_up_failed_worktree_in_preexisting_empty_dir(
    mock_git: dict, tmp_path: Path
) -> None:
    """Pre-existing empty directory is not a pre-existing worktree registration; rollback must clean it up."""
    empty_target = tmp_path / ".claude" / "worktrees" / "agent-empty-dir"
    empty_target.mkdir(parents=True)

    scripts_dir = tmp_path / "scripts"
    scripts_dir.mkdir(exist_ok=True)
    cleanup_log = tmp_path / "cleanup_calls_empty_dir.txt"
    cleanup_script = scripts_dir / "worktree_cleanup.py"
    cleanup_script.write_text(f"""#!/usr/bin/env python3
import sys
from pathlib import Path
Path("{cleanup_log}").write_text(" ".join(sys.argv[1:]))
""")

    branch_marker = tmp_path / "branch_created_empty_dir.marker"
    git_script = mock_git["bin_dir"] / "git"
    git_script.write_text(f"""#!/bin/bash
echo "$@" >> {mock_git["log_path"]}
sub=""
skip_next=0
target=""
for arg in "$@"; do
  if [ "$skip_next" = "1" ]; then skip_next=0; continue; fi
  case "$arg" in
    -C|-b) skip_next=1 ;;
    -*) : ;;
    add) : ;;
    *)
      if [ -z "$sub" ]; then
        sub="$arg"
      elif [ -z "$target" ]; then
        target="$arg"
      fi
      ;;
  esac
done
case "$sub" in
  fetch) exit 0 ;;
  rev-parse)
    case "$*" in
      *refs/heads*)
        if [ -f "{branch_marker}" ]; then
          exit 0
        fi
        exit 1
        ;;
    esac
    echo "{MOCK_FETCH_SHA}"
    exit 0
    ;;
  worktree)
    touch "{branch_marker}"
    echo "fatal: post-checkout hook failed" >&2
    exit 1
    ;;
  *) exit 0 ;;
esac
""")

    stdin_data = {
        "session_id": "test-session",
        "transcript_path": "test-path",
        "cwd": str(tmp_path),
        "hook_event_name": "WorktreeCreate",
        "name": "agent-empty-dir",
    }

    env_mods = {"PATH": f"{mock_git['bin_dir']}:{os.environ['PATH']}"}

    return_code, stdout, stderr = run_hook(stdin_data, tmp_path, env_mods)

    assert return_code != 0
    assert "permanent error (not retrying)" in stderr

    # Verify worktree_cleanup.py was invoked
    assert cleanup_log.exists()
    assert ".claude/worktrees/agent-empty-dir" in cleanup_log.read_text()

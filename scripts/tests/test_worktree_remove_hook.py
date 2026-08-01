"""Unit tests for the WorktreeRemove hook script.

The regression these lock down is PP-omz3's *reachability*: the hook used to
`exit 0` on its own `[ ! -d "$WORKTREE_PATH" ]` pre-check, so `worktree_cleanup.py`
was never consulted for a missing path — the exact case where the slot manifest
entry and the git worktree registration can outlive the directory. Fixing the
script alone would have been inert on this path.

The hook still exits 0 itself (a failing WorktreeRemove hook would wedge Claude
Code's own teardown), so what has to hold is: the script gets invoked, and its
exit code reaches stderr instead of being flattened to "cleanup failed".

`git`, `bd`, and the cleanup script itself are all replaced with stubs on PATH;
nothing here touches real worktrees, real beads, or Docker.
"""

import json
import os
import subprocess
from pathlib import Path

import pytest

HOOK_PATH = Path(__file__).parent.parent.parent / ".claude/hooks/worktree-remove.sh"


@pytest.fixture
def hook_env(tmp_path: Path):
    """Stub PATH + a fake main worktree holding a fake worktree_cleanup.py."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    main_wt = tmp_path / "main"
    (main_wt / "scripts").mkdir(parents=True)

    # `git worktree list --porcelain | head -1` is how the hook locates the main
    # worktree; everything else the hook might ask git for is a no-op.
    git_stub = bin_dir / "git"
    git_stub.write_text(f'#!/bin/bash\necho "worktree {main_wt}"\nexit 0\n')
    git_stub.chmod(0o755)

    # A real `bd dolt push` would touch the actual beads database.
    bd_stub = bin_dir / "bd"
    bd_stub.write_text("#!/bin/bash\nexit 0\n")
    bd_stub.chmod(0o755)

    cleanup_log = tmp_path / "cleanup_calls.txt"
    cleanup = main_wt / "scripts" / "worktree_cleanup.py"
    cleanup.write_text(
        "import os, sys\n"
        f"open({str(cleanup_log)!r}, 'a').write(' '.join(sys.argv[1:]) + '\\n')\n"
        "sys.exit(int(os.environ.get('MOCK_CLEANUP_EXIT', '0')))\n"
    )

    def _run(
        worktree_path: object, cleanup_exit: int = 0
    ) -> subprocess.CompletedProcess:
        env = {
            **os.environ,
            "PATH": f"{bin_dir}{os.pathsep}{os.environ['PATH']}",
            "MOCK_CLEANUP_EXIT": str(cleanup_exit),
        }
        return subprocess.run(
            ["bash", str(HOOK_PATH)],
            input=json.dumps({"worktree_path": worktree_path}),
            capture_output=True,
            text=True,
            env=env,
        )

    def _calls() -> list[str]:
        if not cleanup_log.exists():
            return []
        return [line for line in cleanup_log.read_text().splitlines() if line]

    return _run, _calls


class TestMissingPathStillReachesTheScript:
    def test_nonexistent_path_is_handed_to_the_cleanup_script(
        self, hook_env, tmp_path: Path
    ) -> None:
        """PP-omz3: the hook must not decide "missing means nothing to do" itself."""
        run, calls = hook_env
        gone = tmp_path / "never-existed"

        result = run(str(gone))

        assert result.returncode == 0
        assert calls() == [str(gone)]
        assert "checking for leaks" in result.stderr

    def test_stale_target_exit_code_is_reported_not_flattened(
        self, hook_env, tmp_path: Path
    ) -> None:
        run, _calls = hook_env

        result = run(str(tmp_path / "never-existed"), cleanup_exit=3)

        assert result.returncode == 0  # never wedge Claude Code's teardown
        assert "exited 3" in result.stderr
        assert "INCOMPLETE" in result.stderr

    def test_docker_unknown_exit_code_is_reported(
        self, hook_env, tmp_path: Path
    ) -> None:
        run, _calls = hook_env
        worktree = tmp_path / "agent-alpha"
        worktree.mkdir()

        result = run(str(worktree), cleanup_exit=4)

        assert result.returncode == 0
        assert "exited 4" in result.stderr
        assert "INCOMPLETE" in result.stderr


class TestNormalPaths:
    def test_successful_cleanup_is_quiet(self, hook_env, tmp_path: Path) -> None:
        run, calls = hook_env
        worktree = tmp_path / "agent-alpha"
        worktree.mkdir()

        result = run(str(worktree))

        assert result.returncode == 0
        assert calls() == [str(worktree)]
        assert "INCOMPLETE" not in result.stderr
        assert "checking for leaks" not in result.stderr

    @pytest.mark.parametrize("bad_path", [None, ""])
    def test_missing_worktree_path_in_payload_skips_cleanup(
        self, hook_env, bad_path: object
    ) -> None:
        """No path at all is the one case where doing nothing is right."""
        run, calls = hook_env

        result = run(bad_path)

        assert result.returncode == 0
        assert calls() == []
        assert "Missing or null worktree_path" in result.stderr

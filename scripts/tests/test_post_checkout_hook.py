"""Regression tests for the Husky post-checkout bootstrap seam."""

import os
import subprocess
from pathlib import Path

import pytest

HOOK_PATH = Path(__file__).parent.parent.parent / ".husky" / "post-checkout"
ZERO_SHA = "0" * 40
HEAD_SHA = "ce94995ee0e88904d5c4e1660619c6c047cc6b6c"


@pytest.fixture
def untrusted_mise_worktree(tmp_path: Path) -> dict[str, Path | dict[str, str]]:
    home = tmp_path / "home"
    worktree = tmp_path / "linked-worktree"
    main_worktree = tmp_path / "main-worktree"
    bin_dir = tmp_path / "bin"
    global_bin_dir = home / ".local" / "share" / "mise" / "installs" / "beads"

    for directory in (
        home,
        worktree,
        main_worktree / "scripts",
        bin_dir,
        global_bin_dir,
    ):
        directory.mkdir(parents=True)

    (worktree / ".git").write_text("gitdir: ../main-worktree/.git/worktrees/test\n")
    (worktree / "mise.toml").write_text('[tools]\nnode = "24.16.0"\n')
    (worktree / "supabase").mkdir()
    (worktree / "supabase" / "config.toml.template").write_text("")

    beads_log = tmp_path / "beads.log"
    setup_log = tmp_path / "setup.log"
    mise_log = tmp_path / "mise.log"

    # This is the direct binary selected from the trusted user-global config.
    global_bd = global_bin_dir / "bd"
    global_bd.write_text(
        f'''#!/bin/sh
printf '%s\n' "$*" > "{beads_log}"
'''
    )

    # The PATH entry models a mise shim in an untrusted project. Any regression
    # back to invoking bare `bd` fails with the same class of error as mise.
    shim_bd = bin_dir / "bd"
    shim_bd.write_text(
        """#!/bin/sh
echo 'mise ERROR Config files in the worktree are not trusted' >&2
exit 1
"""
    )

    mise = bin_dir / "mise"
    mise.write_text(
        f'''#!/bin/sh
printf '%s\n' "$*" > "{mise_log}"
if [ "$1" = "-C" ] && [ "$2" = "{home}" ] && [ "$3" = "which" ] && [ "$4" = "bd" ]; then
  printf '%s\n' "{global_bd}"
  exit 0
fi
echo 'mise ERROR untrusted project config was parsed' >&2
exit 1
'''
    )

    git = bin_dir / "git"
    git.write_text(
        f'''#!/bin/sh
if [ "$1" = "worktree" ] && [ "$2" = "list" ]; then
  printf 'worktree %s\n' "{main_worktree}"
  exit 0
fi
if [ "$1" = "symbolic-ref" ]; then
  printf 'test-branch\n'
  exit 0
fi
exit 0
'''
    )

    timeout = bin_dir / "timeout"
    timeout.write_text(
        """#!/bin/sh
shift
exec "$@"
"""
    )

    setup = main_worktree / "scripts" / "worktree_setup.py"
    setup.write_text(
        f'''from pathlib import Path
Path("{setup_log}").write_text("ran")
'''
    )

    for executable in (global_bd, shim_bd, mise, git, timeout):
        executable.chmod(0o755)

    env = os.environ.copy()
    env.update(
        {
            "HOME": str(home),
            "PATH": f"{bin_dir}:{env['PATH']}",
        }
    )

    return {
        "worktree": worktree,
        "beads_log": beads_log,
        "setup_log": setup_log,
        "mise_log": mise_log,
        "env": env,
    }


def test_post_checkout_uses_global_bd_without_trusting_project_config(
    untrusted_mise_worktree: dict[str, Path | dict[str, str]],
) -> None:
    worktree = untrusted_mise_worktree["worktree"]
    env = untrusted_mise_worktree["env"]
    assert isinstance(worktree, Path)
    assert isinstance(env, dict)

    result = subprocess.run(
        ["sh", str(HOOK_PATH), ZERO_SHA, HEAD_SHA, "1"],
        cwd=worktree,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert untrusted_mise_worktree["beads_log"].read_text().strip() == (
        f"hooks run post-checkout {ZERO_SHA} {HEAD_SHA} 1"
    )
    assert untrusted_mise_worktree["setup_log"].read_text() == "ran"
    assert untrusted_mise_worktree["mise_log"].read_text().strip() == (
        f"-C {env['HOME']} which bd"
    )


def test_normal_project_bd_command_remains_fail_closed(
    untrusted_mise_worktree: dict[str, Path | dict[str, str]],
) -> None:
    worktree = untrusted_mise_worktree["worktree"]
    env = untrusted_mise_worktree["env"]
    assert isinstance(worktree, Path)
    assert isinstance(env, dict)

    result = subprocess.run(
        ["bd", "version"],
        cwd=worktree,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode != 0
    assert "not trusted" in result.stderr

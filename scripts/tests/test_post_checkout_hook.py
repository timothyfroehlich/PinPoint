"""Regression tests for the Husky post-checkout bootstrap seam."""

import json
import os
import shutil
import subprocess
import tomllib
from pathlib import Path

import pytest

HOOK_PATH = Path(__file__).parent.parent.parent / ".husky" / "post-checkout"
ZERO_SHA = "0" * 40
HEAD_SHA = "ce94995ee0e88904d5c4e1660619c6c047cc6b6c"
REPO_ROOT = HOOK_PATH.parent.parent


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


def test_real_untrusted_dependency_empty_worktree_uses_project_pins(
    tmp_path: Path,
) -> None:
    """Exercise the real hook and setup with mise trust state isolated."""
    mise_path_raw = shutil.which("mise")
    assert mise_path_raw is not None, "mise is required for the bootstrap regression"
    mise_path = Path(mise_path_raw).resolve()

    project_mise = tomllib.loads((REPO_ROOT / "mise.toml").read_text())
    node_version = project_mise["tools"]["node"]
    assert isinstance(node_version, str)

    project_package = json.loads((REPO_ROOT / "package.json").read_text())
    package_manager = project_package["packageManager"]
    assert isinstance(package_manager, str)
    pnpm_version = package_manager.removeprefix("pnpm@").split("+", 1)[0]

    node_where = subprocess.run(
        [str(mise_path), "--no-config", "where", f"node@{node_version}"],
        capture_output=True,
        text=True,
        check=True,
    )
    pnpm_where = subprocess.run(
        [str(mise_path), "--no-config", "where", f"pnpm@{pnpm_version}"],
        capture_output=True,
        text=True,
        check=True,
    )
    mise_data_dir = Path(node_where.stdout.strip()).parents[2]
    assert Path(pnpm_where.stdout.strip()).parents[2] == mise_data_dir

    main_worktree = tmp_path / "main"
    linked_worktree = tmp_path / "linked"
    home = tmp_path / "home"
    config_dir = tmp_path / "mise-config"
    state_dir = tmp_path / "mise-state"
    cache_dir = tmp_path / "mise-cache"
    bin_dir = tmp_path / "bin"
    for directory in (main_worktree, home, config_dir, state_dir, cache_dir, bin_dir):
        directory.mkdir(parents=True)

    mismatched_pnpm_version = "11.0.0"
    (config_dir / "config.toml").write_text(
        "[tools]\n"
        f'pnpm = "{mismatched_pnpm_version}"\n'
        "[settings]\n"
        "not_found_auto_install = false\n"
        "not_found_system_fallback = false\n"
    )

    global_tool_log = tmp_path / "global-tool.log"
    (bin_dir / "node").write_text(
        f"#!/bin/sh\nprintf 'node %s\\n' \"$*\" >> '{global_tool_log}'\n"
        "echo 'global node must not run' >&2\nexit 91\n"
    )
    (bin_dir / "pnpm").write_text(
        f"#!/bin/sh\nprintf 'pnpm %s\\n' \"$*\" >> '{global_tool_log}'\n"
        f'if [ "$1" = "--version" ]; then echo \'{mismatched_pnpm_version}\'; exit 0; fi\n'
        "echo 'global pnpm must not install dependencies' >&2\nexit 92\n"
    )
    beads_log = tmp_path / "beads.log"
    (bin_dir / "bd").write_text(f"#!/bin/sh\nprintf '%s\\n' \"$*\" > '{beads_log}'\n")
    for executable in (bin_dir / "node", bin_dir / "pnpm", bin_dir / "bd"):
        executable.chmod(0o755)

    (main_worktree / ".husky").mkdir()
    (main_worktree / "scripts").mkdir()
    (main_worktree / "supabase").mkdir()
    shutil.copy2(HOOK_PATH, main_worktree / ".husky" / "post-checkout")
    shutil.copy2(
        REPO_ROOT / "scripts" / "worktree_setup.py",
        main_worktree / "scripts" / "worktree_setup.py",
    )
    shutil.copy2(REPO_ROOT / "mise.toml", main_worktree / "mise.toml")
    (main_worktree / "package.json").write_text(
        json.dumps(
            {
                "name": "bootstrap-repro",
                "packageManager": package_manager,
                "dependencies": {"fixture-dep": "file:fixture-dep"},
            }
        )
        + "\n"
    )
    (main_worktree / "fixture-dep").mkdir()
    (main_worktree / "fixture-dep" / "package.json").write_text(
        '{"name":"fixture-dep","version":"1.0.0"}\n'
    )
    (main_worktree / "pnpm-lock.yaml").write_text(
        "lockfileVersion: '9.0'\n"
        "settings:\n"
        "  autoInstallPeers: true\n"
        "  excludeLinksFromLockfile: false\n"
        "importers:\n"
        "  .:\n"
        "    dependencies:\n"
        "      fixture-dep:\n"
        "        specifier: file:fixture-dep\n"
        "        version: file:fixture-dep\n"
        "packages:\n"
        "  fixture-dep@file:fixture-dep:\n"
        "    resolution: {directory: fixture-dep, type: directory}\n"
        "snapshots:\n"
        "  fixture-dep@file:fixture-dep: {}\n"
    )
    (main_worktree / "supabase" / "config.toml.template").write_text(
        'project_id = "pinpoint"\n[api]\nport = 54321\n'
    )

    base_path = os.environ["PATH"]
    git_env = {
        "HOME": str(home),
        "HUSKY": "0",
        "LANG": os.environ.get("LANG", "C"),
        "PATH": base_path,
        "TMPDIR": os.environ.get("TMPDIR", str(tmp_path)),
    }
    subprocess.run(
        ["git", "init", "-b", "main"], cwd=main_worktree, env=git_env, check=True
    )
    subprocess.run(
        ["git", "config", "user.email", "bootstrap@test.invalid"],
        cwd=main_worktree,
        env=git_env,
        check=True,
    )
    subprocess.run(
        ["git", "config", "user.name", "Bootstrap Test"],
        cwd=main_worktree,
        env=git_env,
        check=True,
    )
    subprocess.run(["git", "add", "."], cwd=main_worktree, env=git_env, check=True)
    subprocess.run(
        ["git", "commit", "-m", "test fixture"],
        cwd=main_worktree,
        env=git_env,
        check=True,
    )
    subprocess.run(
        ["git", "worktree", "add", "-b", "bootstrap-test", str(linked_worktree)],
        cwd=main_worktree,
        env=git_env,
        check=True,
    )

    env = {
        "HOME": str(home),
        "LANG": os.environ.get("LANG", "C"),
        "MISE_CONFIG_DIR": str(config_dir),
        "MISE_STATE_DIR": str(state_dir),
        "MISE_CACHE_DIR": str(cache_dir),
        "MISE_DATA_DIR": str(mise_data_dir),
        "MISE_NOT_FOUND_AUTO_INSTALL": "false",
        "MISE_NOT_FOUND_SYSTEM_FALLBACK": "false",
        "MISE_PARANOID": "true",
        "PATH": f"{bin_dir}:{mise_path.parent}:{base_path}",
        "PINPOINT_WORKTREE_INSTALL_TIMEOUT": "30",
        "TMPDIR": os.environ.get("TMPDIR", str(tmp_path)),
    }

    trust_probe = subprocess.run(
        [str(mise_path), "-C", str(linked_worktree), "exec", "--", "node", "--version"],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert trust_probe.returncode != 0
    assert "not trusted" in trust_probe.stderr
    assert not (linked_worktree / "node_modules").exists()

    head = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=linked_worktree,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()

    bad_package = json.loads((linked_worktree / "package.json").read_text())
    bad_package["packageManager"] = f"pnpm@{pnpm_version}+sha512." + "0" * 128
    (linked_worktree / "package.json").write_text(json.dumps(bad_package) + "\n")
    rejected = subprocess.run(
        ["sh", ".husky/post-checkout", ZERO_SHA, head, "1"],
        cwd=linked_worktree,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert rejected.returncode != 0
    assert "failure_class=toolchain-config" in rejected.stderr
    assert "do not match the trusted main worktree" in rejected.stderr
    assert not (linked_worktree / "node_modules").exists()
    assert not global_tool_log.exists(), global_tool_log.read_text()

    shutil.copy2(main_worktree / "package.json", linked_worktree / "package.json")
    result = subprocess.run(
        ["sh", ".husky/post-checkout", ZERO_SHA, head, "1"],
        cwd=linked_worktree,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert "worktree_setup: status=ready" in result.stderr
    assert (linked_worktree / "node_modules" / ".modules.yaml").is_file()
    assert (
        beads_log.read_text().strip() == f"hooks run post-checkout {ZERO_SHA} {head} 1"
    )
    assert not global_tool_log.exists(), global_tool_log.read_text()

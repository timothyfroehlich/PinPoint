"""The Mac remote default must never become a silent local fallback."""

import os
import subprocess
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).parent.parent


def executable(path: Path, body: str) -> None:
    path.write_text(f"#!/usr/bin/env bash\nset -euo pipefail\n{body}\n")
    path.chmod(0o755)


def run_guard(
    tmp_path: Path, backend: str, remote_exit: int = 0, owner_exit: int = 0
) -> tuple[int, str]:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "calls"
    executable(
        bin_dir / "python3",
        'if [[ "$*" == *assert-local-stack.py* ]]; then\n'
        f"  printf 'owner:%s\\n' \"$*\" >> {calls}\n"
        f"  exit {owner_exit}\n"
        "fi\n"
        f"printf 'remote:%s\\n' \"$*\" >> {calls}\nexit {remote_exit}",
    )
    executable(bin_dir / "supabase", "exit 0")
    executable(bin_dir / "curl", f"printf 'local:%s\\n' \"$*\" >> {calls}")
    env = os.environ.copy()
    env["PATH"] = f"{bin_dir}{os.pathsep}{env['PATH']}"
    env["PINPOINT_SUPABASE_BACKEND"] = backend
    env.pop("CI", None)
    result = subprocess.run(
        ["bash", str(SCRIPTS / "ensure-supabase.sh")],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    return result.returncode, calls.read_text() if calls.exists() else ""


def test_remote_mode_only_invokes_owned_helper(tmp_path: Path) -> None:
    code, calls = run_guard(tmp_path, "remote")

    assert code == 0
    assert calls == "remote:scripts/remote-supabase.py start\n"


def test_remote_failure_never_tries_local_stack(tmp_path: Path) -> None:
    code, calls = run_guard(tmp_path, "remote", remote_exit=3)

    assert code == 3
    assert calls == "remote:scripts/remote-supabase.py start\n"


def test_local_opt_in_only_probes_local_health(tmp_path: Path) -> None:
    code, calls = run_guard(tmp_path, "local")

    assert code == 0
    assert calls.startswith("owner:scripts/assert-local-stack.py --require-api\nlocal:")
    assert "remote:" not in calls


def test_local_opt_in_rejects_unowned_endpoint_before_health_probe(
    tmp_path: Path,
) -> None:
    code, calls = run_guard(tmp_path, "local", owner_exit=2)

    assert code == 1
    assert calls == "owner:scripts/assert-local-stack.py --require-api\n"


@pytest.mark.parametrize("ci_flag", [None, "true"])
def test_remote_mode_cannot_run_destructive_local_restart(
    tmp_path: Path, ci_flag: str | None
) -> None:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "calls"
    executable(bin_dir / "supabase", f"printf '%s\\n' \"$*\" >> {calls}")
    env = os.environ.copy()
    env["PATH"] = f"{bin_dir}{os.pathsep}{env['PATH']}"
    env["PINPOINT_SUPABASE_BACKEND"] = "remote"
    if ci_flag is None:
        env.pop("CI", None)
    else:
        env["CI"] = ci_flag

    result = subprocess.run(
        ["bash", str(SCRIPTS / "restart-local-supabase.sh")],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 1
    assert "local-only" in result.stderr
    assert not calls.exists()


def run_database_guard(
    *,
    bootstrap_marker: bool = False,
    allow_bootstrap: bool = False,
    ci_flag: str | None = None,
) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PINPOINT_SUPABASE_BACKEND"] = "remote"
    if bootstrap_marker:
        env["PINPOINT_REMOTE_SUPABASE_BOOTSTRAP"] = "1"
    else:
        env.pop("PINPOINT_REMOTE_SUPABASE_BOOTSTRAP", None)
    if ci_flag is None:
        env.pop("CI", None)
    else:
        env["CI"] = ci_flag
    option = ", true" if allow_bootstrap else ""
    return subprocess.run(
        [
            "node",
            "--input-type=module",
            "-e",
            "import { assertLocalDatabase } from './scripts/assert-local-db.mjs'; "
            f"assertLocalDatabase('postgres://postgres@localhost:54322/postgres'{option})",
        ],
        cwd=SCRIPTS.parent,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_remote_mode_blocks_destructive_database_scripts() -> None:
    result = run_database_guard()

    assert result.returncode == 2
    assert "local-only" in result.stderr


def test_remote_fresh_bootstrap_can_use_destructive_seed() -> None:
    result = run_database_guard(bootstrap_marker=True, allow_bootstrap=True)

    assert result.returncode == 0


def test_bootstrap_marker_does_not_authorize_other_reset_scripts() -> None:
    result = run_database_guard(bootstrap_marker=True)

    assert result.returncode == 2


def test_fresh_bootstrap_child_authorizes_only_seed_scripts() -> None:
    env = os.environ.copy()
    env["PINPOINT_SUPABASE_BACKEND"] = "remote"
    env["PINPOINT_REMOTE_SUPABASE_BOOTSTRAP"] = "1"
    env["PINPOINT_REMOTE_SUPABASE_SEED_CHILD"] = "1"

    def run(script_name: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                "node",
                "--input-type=module",
                "-e",
                "const { assertLocalDatabase } = await import('./scripts/assert-local-db.mjs'); "
                "assertLocalDatabase('postgres://postgres@localhost:54322/postgres')",
                script_name,
            ],
            cwd=SCRIPTS.parent,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

    assert run("seed-collections.mjs").returncode == 0
    assert run("reset-to-empty.mjs").returncode == 2


def test_ci_flag_does_not_waive_remote_database_guard() -> None:
    result = run_database_guard(ci_flag="true")

    assert result.returncode == 2


def test_local_selector_without_owned_container_cannot_reset() -> None:
    env = os.environ.copy()
    env["PINPOINT_SUPABASE_BACKEND"] = "local"
    env.pop("PINPOINT_REMOTE_SUPABASE_BOOTSTRAP", None)
    result = subprocess.run(
        [
            "node",
            "--input-type=module",
            "-e",
            "import { assertLocalDatabase } from './scripts/assert-local-db.mjs'; "
            "assertLocalDatabase('postgres://postgres@localhost:54322/postgres')",
        ],
        cwd=SCRIPTS.parent,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 2
    assert "not proved to be this worktree's local Supabase" in result.stderr

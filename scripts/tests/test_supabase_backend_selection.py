"""The Mac remote default must never become a silent local fallback."""

import os
import subprocess
from pathlib import Path

SCRIPTS = Path(__file__).parent.parent


def executable(path: Path, body: str) -> None:
    path.write_text(f"#!/usr/bin/env bash\nset -euo pipefail\n{body}\n")
    path.chmod(0o755)


def run_guard(tmp_path: Path, backend: str, remote_exit: int = 0) -> tuple[int, str]:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "calls"
    executable(
        bin_dir / "python3",
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
    assert calls.startswith("local:")
    assert "remote:" not in calls


def test_remote_mode_cannot_run_destructive_local_restart(tmp_path: Path) -> None:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "calls"
    executable(bin_dir / "supabase", f"printf '%s\\n' \"$*\" >> {calls}")
    env = os.environ.copy()
    env["PATH"] = f"{bin_dir}{os.pathsep}{env['PATH']}"
    env["PINPOINT_SUPABASE_BACKEND"] = "remote"

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
    *, bootstrap_marker: bool = False, allow_bootstrap: bool = False
) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PINPOINT_SUPABASE_BACKEND"] = "remote"
    if bootstrap_marker:
        env["PINPOINT_REMOTE_SUPABASE_BOOTSTRAP"] = "1"
    else:
        env.pop("PINPOINT_REMOTE_SUPABASE_BOOTSTRAP", None)
    env.pop("CI", None)
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

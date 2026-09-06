"""Regression tests for the compact local-service status contract."""

import os
import subprocess
from pathlib import Path

SCRIPT_PATH = Path(__file__).parent.parent / "dev-status.sh"


def _write_executable(path: Path, body: str) -> None:
    path.write_text(f"#!/usr/bin/env bash\nset -euo pipefail\n{body}")
    path.chmod(0o755)


def _run_status(
    tmp_path: Path,
    *args: str,
    mode: str = "healthy",
    postgres_url: bool = True,
) -> subprocess.CompletedProcess[str]:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()

    _write_executable(
        bin_dir / "curl",
        f"""
if [[ "$STUB_MODE" == down ]]; then
  exit 1
fi
if [[ "$*" == *"/auth/v1/health"* ]]; then
  count_file="{tmp_path}/supabase-count"
  threshold=2
else
  count_file="{tmp_path}/next-count"
  threshold=3
fi
count=0
[[ -f "$count_file" ]] && read -r count <"$count_file"
count=$((count + 1))
printf '%s\n' "$count" >"$count_file"
[[ "$STUB_MODE" == healthy || "$count" -ge "$threshold" ]]
""",
    )
    _write_executable(
        bin_dir / "pg_isready",
        f"""
[[ "$STUB_MODE" == down ]] && exit 1
count_file="{tmp_path}/postgres-count"
count=0
[[ -f "$count_file" ]] && read -r count <"$count_file"
count=$((count + 1))
printf '%s\n' "$count" >"$count_file"
[[ "$STUB_MODE" == healthy || "$count" -ge 4 ]]
""",
    )
    _write_executable(bin_dir / "sleep", "exit 0\n")

    env_lines = [
        "PORT=3210",
        "NEXT_PUBLIC_SUPABASE_URL=http://localhost:56421",
    ]
    if postgres_url:
        env_lines.append(
            "POSTGRES_URL_NON_POOLING="
            "postgresql://postgres:postgres@localhost:56422/postgres"
        )
    (tmp_path / ".env.local").write_text("\n".join(env_lines) + "\n")

    env = os.environ.copy()
    env["PATH"] = f"{bin_dir}{os.pathsep}{env['PATH']}"
    env["STUB_MODE"] = mode
    return subprocess.run(
        ["bash", str(SCRIPT_PATH), *args],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        check=False,
        timeout=5,
    )


def test_single_check_is_one_compact_success_line(tmp_path: Path) -> None:
    result = _run_status(tmp_path)

    assert result.returncode == 0, result.stdout + result.stderr
    assert result.stdout == (
        "PASS: dev status — Next.js=up; Supabase API=up; Postgres=up\n"
    )


def test_single_check_is_one_actionable_failure_line(tmp_path: Path) -> None:
    result = _run_status(tmp_path, mode="down")

    assert result.returncode == 1
    assert result.stdout.count("\n") == 1
    assert result.stdout.startswith("FAIL: dev status — ")
    assert "Next.js=down (start: pnpm run dev)" in result.stdout
    assert "Supabase API=down (start: supabase start)" in result.stdout
    assert "Postgres=down (check POSTGRES_URL)" in result.stdout


def test_human_mode_retains_per_service_output(tmp_path: Path) -> None:
    result = _run_status(tmp_path, "--verbose")

    assert result.returncode == 0
    assert "✅ Next.js        http://localhost:3210" in result.stdout
    assert "✅ Supabase API   http://localhost:56421" in result.stdout
    assert "✅ Postgres" in result.stdout


def test_wait_mode_emits_transitions_once_and_no_unchanged_progress(
    tmp_path: Path,
) -> None:
    result = _run_status(tmp_path, "--wait", "--timeout=5", mode="transition")

    assert result.returncode == 0, result.stdout + result.stderr
    assert result.stdout.count("READY: Next.js") == 1
    assert result.stdout.count("READY: Supabase API") == 1
    assert result.stdout.count("READY: Postgres") == 1
    assert "WAIT:" not in result.stdout
    assert result.stdout.splitlines()[-1].startswith(
        "PASS: all configured dev services ready ["
    )


def test_wait_timeout_is_one_terminal_failure(tmp_path: Path) -> None:
    result = _run_status(tmp_path, "--wait", "--timeout=0", mode="down")

    assert result.returncode == 1
    assert result.stdout.count("\n") == 1
    assert result.stdout.startswith("FAIL: dev status timeout after 0s — ")
    assert "READY:" not in result.stdout


def test_skipped_postgres_probe_is_explicit(tmp_path: Path) -> None:
    result = _run_status(tmp_path, "--wait", "--timeout=5", postgres_url=False)

    assert result.returncode == 0
    assert "SKIP: Postgres — POSTGRES_URL not set" in result.stdout
    assert result.stdout.splitlines()[-1].startswith(
        "PASS: all configured dev services ready ["
    )


def test_unknown_option_is_a_usage_error(tmp_path: Path) -> None:
    result = _run_status(tmp_path, "--surprise")

    assert result.returncode == 2
    assert "Usage:" in result.stderr

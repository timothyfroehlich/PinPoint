"""Regression coverage for preflight readiness and targeted integration setup."""

import json
import os
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parents[2]
READINESS_SCRIPT = REPO_ROOT / "scripts" / "workflow" / "preflight-readiness.sh"
INTEGRATION_SCRIPT = REPO_ROOT / "scripts" / "workflow" / "integration-test.sh"
MIGRATE_HINT = "Run: pnpm supabase:start && pnpm run db:migrate"


def _write_executable(path: Path, body: str) -> None:
    path.write_text(f"#!/bin/bash\nset -euo pipefail\n{body}")
    path.chmod(0o755)


ENV_LOCAL = (
    "POSTGRES_URL=postgresql://postgres:postgres@localhost:61234/postgres\n"
    'NEXT_PUBLIC_SUPABASE_URL="http://localhost:61233"\n'
    # Valid dotenv, invalid bash: readiness must not source the file.
    "EMAIL_FROM=PinPoint <noreply@example.com>\n"
)


def _run_readiness(
    tmp_path: Path,
    mode: str,
    *,
    env_local: str | None = ENV_LOCAL,
    exported: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _write_executable(bin_dir / "pg_isready", '[[ "$STUB_MODE" != db_down ]]\n')
    _write_executable(bin_dir / "curl", '[[ "$STUB_MODE" != auth_down ]]\n')
    _write_executable(
        bin_dir / "psql",
        """
case "$STUB_MODE" in
  unmigrated) echo 'relation does not exist' >&2; exit 1 ;;
  behind) echo 1 ;;
  *) echo 2 ;;
esac
""",
    )
    journal = tmp_path / "drizzle" / "meta" / "_journal.json"
    journal.parent.mkdir(parents=True)
    journal.write_text(json.dumps({"entries": [{"tag": "0000_a"}, {"tag": "0001_b"}]}))
    if env_local is not None:
        (tmp_path / ".env.local").write_text(env_local)
    env = os.environ.copy()
    env.pop("POSTGRES_URL", None)
    env.pop("NEXT_PUBLIC_SUPABASE_URL", None)
    env.update(exported or {})
    env["PATH"] = f"{bin_dir}{os.pathsep}{env['PATH']}"
    env["STUB_MODE"] = mode
    return subprocess.run(
        ["/bin/bash", str(READINESS_SCRIPT)],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        check=False,
        timeout=15,
    )


def test_ready_stack_emits_one_success_line(tmp_path: Path) -> None:
    result = _run_readiness(tmp_path, "ready")

    assert result.returncode == 0, result.stderr
    assert result.stderr == ""
    assert (
        result.stdout
        == "PASS: preflight readiness — Postgres ready at localhost:61234\n"
    )


@pytest.mark.parametrize(
    ("mode", "problem"),
    [
        ("db_down", "Postgres is not answering at localhost:61234"),
        ("auth_down", "Supabase Auth is not answering at http://localhost:61233"),
        ("unmigrated", "0 of 2 migrations applied at localhost:61234"),
        ("behind", "1 of 2 migrations applied at localhost:61234"),
    ],
)
def test_unready_stack_fails_with_one_actionable_line(
    tmp_path: Path, mode: str, problem: str
) -> None:
    result = _run_readiness(tmp_path, mode)

    assert result.returncode == 1
    assert result.stdout == ""
    assert result.stderr.splitlines() == [
        f"FAIL: preflight readiness — {problem}. {MIGRATE_HINT}"
    ]


def test_missing_env_file_points_at_worktree_setup(tmp_path: Path) -> None:
    result = _run_readiness(tmp_path, "ready", env_local=None)

    assert result.returncode == 1
    assert result.stderr.splitlines() == [
        "FAIL: preflight readiness — .env.local is missing. "
        "Run: python3 scripts/worktree_setup.py"
    ]


def test_missing_key_points_at_worktree_setup(tmp_path: Path) -> None:
    result = _run_readiness(
        tmp_path, "ready", env_local="NEXT_PUBLIC_SUPABASE_URL=http://x\n"
    )

    assert result.returncode == 1
    assert result.stderr.splitlines() == [
        "FAIL: preflight readiness — .env.local lacks POSTGRES_URL or "
        "NEXT_PUBLIC_SUPABASE_URL. Run: python3 scripts/worktree_setup.py"
    ]


def test_exported_value_wins_over_env_local(tmp_path: Path) -> None:
    result = _run_readiness(
        tmp_path,
        "ready",
        exported={"POSTGRES_URL": "postgresql://u:p@db.example:5433/postgres"},
    )

    assert result.returncode == 0, result.stderr
    assert (
        result.stdout
        == "PASS: preflight readiness — Postgres ready at db.example:5433\n"
    )


def _run_targeted_integration(
    tmp_path: Path, *, ensure_schema_succeeds: bool = True, args: list[str]
) -> tuple[subprocess.CompletedProcess[str], Path]:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "calls"
    ensure_exit = 0 if ensure_schema_succeeds else 9
    _write_executable(
        bin_dir / "pnpm",
        f"""
printf 'pnpm %s\\n' "$*" >>"{calls}"
if [[ "$*" == "run test:ensure-schema" ]]; then
  mkdir -p src/test/setup
  touch src/test/setup/schema.sql
  exit {ensure_exit}
fi
exit 70
""",
    )
    _write_executable(
        bin_dir / "bash",
        f"""
[[ -f src/test/setup/schema.sql ]]
printf 'bash %s\\n' "$*" >>"{calls}"
""",
    )
    env = os.environ.copy()
    env["PATH"] = f"{bin_dir}{os.pathsep}{env['PATH']}"
    result = subprocess.run(
        ["/bin/bash", str(INTEGRATION_SCRIPT), *args],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        check=False,
        timeout=15,
    )
    return result, calls


def test_targeted_integration_generates_missing_schema_before_vitest(
    tmp_path: Path,
) -> None:
    result, calls = _run_targeted_integration(
        tmp_path,
        args=["--require-target", "src/test/integration/example.test.ts"],
    )

    assert result.returncode == 0, result.stdout + result.stderr
    assert calls.read_text().splitlines() == [
        "pnpm run test:ensure-schema",
        "bash scripts/workflow/heavy-run.sh vitest run --project integration "
        "--max-workers=2 src/test/integration/example.test.ts",
    ]


def test_targeted_integration_stops_when_schema_generation_fails(
    tmp_path: Path,
) -> None:
    result, calls = _run_targeted_integration(
        tmp_path,
        ensure_schema_succeeds=False,
        args=["--require-target", "src/test/integration/example.test.ts"],
    )

    assert result.returncode == 9
    assert calls.read_text().splitlines() == ["pnpm run test:ensure-schema"]


def test_targeted_integration_requires_an_explicit_test_path(tmp_path: Path) -> None:
    result, calls = _run_targeted_integration(
        tmp_path,
        args=["--require-target"],
    )

    assert result.returncode == 64
    assert not calls.exists()
    assert "pnpm run test:integration:target -- <test-path>" in result.stderr


def test_targeted_integration_rejects_options_without_a_test_path(
    tmp_path: Path,
) -> None:
    result, calls = _run_targeted_integration(
        tmp_path,
        args=["--require-target", "--silent"],
    )

    assert result.returncode == 64
    assert not calls.exists()
    assert "pnpm run test:integration:target -- <test-path>" in result.stderr


def test_targeted_integration_rejects_path_like_option_operands(
    tmp_path: Path,
) -> None:
    result, calls = _run_targeted_integration(
        tmp_path,
        args=[
            "--require-target",
            "--exclude",
            "src/test/integration/example.test.ts",
        ],
    )

    assert result.returncode == 64
    assert not calls.exists()
    assert "pnpm run test:integration:target -- <test-path>" in result.stderr

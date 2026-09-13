"""Regression coverage for preflight readiness and targeted integration setup."""

import json
import os
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).parents[2]
READINESS_SCRIPT = REPO_ROOT / "scripts" / "workflow" / "preflight-readiness.sh"
INTEGRATION_SCRIPT = REPO_ROOT / "scripts" / "workflow" / "integration-test.sh"


def _write_executable(path: Path, body: str) -> None:
    path.write_text(f"#!/bin/bash\nset -euo pipefail\n{body}")
    path.chmod(0o755)


def _run_readiness(
    tmp_path: Path, mode: str, *args: str
) -> subprocess.CompletedProcess[str]:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _write_executable(
        bin_dir / "pg_isready",
        '[[ "$STUB_MODE" == "unreachable" ]] && exit 1\nexit 0\n',
    )
    _write_executable(
        bin_dir / "psql",
        """
if [[ "$STUB_MODE" == "uninitialized" ]]; then
  printf 'f\\n'
elif [[ "$*" == *"WITH expected"* ]]; then
  case "$STUB_MODE" in
    missing) printf 'behind\\n' ;;
    unexpected) printf 'diverged\\n' ;;
    tagged)
      if [[ "$*" == *"0076_add-mcp-oauth-support"* && "$*" == *"a.hash = e.tag"* ]]; then
        printf 'ready\\n'
      else
        printf 'behind\\n'
      fi
      ;;
    *) printf 'ready\\n' ;;
  esac
elif [[ "$STUB_MODE" == "tagged" && "$*" != *"to_regclass"* ]]; then
  printf 'f\\n'
else
  printf 't\\n'
fi
""",
    )
    (tmp_path / ".env.local").write_text(
        "POSTGRES_URL=postgresql://postgres:postgres@localhost:61234/postgres\n"
    )
    env = os.environ.copy()
    env["PATH"] = f"{bin_dir}{os.pathsep}{env['PATH']}"
    env["STUB_MODE"] = mode
    return subprocess.run(
        ["/bin/bash", str(READINESS_SCRIPT), *args],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        check=False,
        timeout=5,
    )


def test_unreachable_database_fails_fast_with_port_and_one_remediation(
    tmp_path: Path,
) -> None:
    result = _run_readiness(tmp_path, "unreachable")

    assert result.returncode == 1
    assert result.stdout == ""
    assert result.stderr.splitlines() == [
        "FAIL: preflight readiness — Postgres is unavailable at localhost:61234",
        "Run: supabase start && pnpm run db:migrate",
    ]


def test_uninitialized_database_fails_fast_with_port_and_one_remediation(
    tmp_path: Path,
) -> None:
    result = _run_readiness(tmp_path, "uninitialized")

    assert result.returncode == 1
    assert result.stdout == ""
    assert result.stderr.splitlines() == [
        "FAIL: preflight readiness — Postgres at localhost:61234 is not migrated",
        "Run: supabase start && pnpm run db:migrate",
    ]


def test_database_missing_current_migration_hash_fails_fast(
    tmp_path: Path,
) -> None:
    result = _run_readiness(tmp_path, "missing")

    assert result.returncode == 1
    assert result.stdout == ""
    assert result.stderr.splitlines() == [
        "FAIL: preflight readiness — Postgres at localhost:61234 is not migrated",
        "Run: supabase start && pnpm run db:migrate",
    ]


def test_database_with_unexpected_migration_requires_local_reset(
    tmp_path: Path,
) -> None:
    result = _run_readiness(tmp_path, "unexpected")

    assert result.returncode == 1
    assert result.stdout == ""
    assert result.stderr.splitlines() == [
        "FAIL: preflight readiness — Postgres at localhost:61234 has a divergent migration history",
        "Run: pnpm run db:reset",
    ]


def test_recovery_script_tag_marker_is_accepted(tmp_path: Path) -> None:
    result = _run_readiness(tmp_path, "tagged")

    assert result.returncode == 0
    assert result.stderr == ""
    assert result.stdout == (
        "PASS: preflight readiness — Postgres ready at localhost:61234\n"
    )


def test_initialized_database_emits_one_success_line(tmp_path: Path) -> None:
    result = _run_readiness(tmp_path, "ready")

    assert result.returncode == 0
    assert result.stderr == ""
    assert result.stdout == (
        "PASS: preflight readiness — Postgres ready at localhost:61234\n"
    )


def test_quiet_success_supports_the_locked_pre_semaphore_probe(tmp_path: Path) -> None:
    result = _run_readiness(tmp_path, "ready", "--quiet-success")

    assert result.returncode == 0
    assert result.stdout == ""
    assert result.stderr == ""


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
        timeout=5,
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


def test_package_scripts_put_readiness_first_and_share_integration_setup() -> None:
    scripts = json.loads((REPO_ROOT / "package.json").read_text())["scripts"]

    assert scripts["preflight:readiness"] == (
        "bash scripts/workflow/preflight-readiness.sh"
    )
    preflight = scripts["preflight:_run"]
    assert preflight.startswith("pnpm run preflight:readiness && ")
    for phase in (
        "check:prototype-clean",
        "typecheck",
        "test:human",
        "db:fast-reset",
        "build",
        "test:integration",
        "test:integration:supabase",
        "smoke",
    ):
        assert phase in preflight
    assert preflight.index("preflight:readiness") < preflight.index(
        "check:prototype-clean"
    )
    assert preflight.index("check:prototype-clean") < preflight.index("db:fast-reset")

    assert scripts["test:integration:target"] == (
        "bash scripts/workflow/integration-test.sh --require-target"
    )
    assert scripts["test:integration"].startswith(
        "bash scripts/workflow/integration-test.sh "
    )

    locked = (REPO_ROOT / "scripts/workflow/preflight-locked.sh").read_text()
    readiness_at = locked.index("preflight-readiness.sh --quiet-success")
    parallel_home_at = locked.index("export PARALLEL_HOME=")
    semaphore_at = locked.index("exec sem ")
    assert readiness_at < semaphore_at
    assert parallel_home_at < semaphore_at


def test_locked_preflight_uses_writable_shared_semaphore_state(
    tmp_path: Path,
) -> None:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _write_executable(bin_dir / "pg_isready", "exit 0\n")
    _write_executable(
        bin_dir / "psql",
        "[[ \"$*\" == *\"WITH expected\"* ]] && printf 'ready\\n' || printf 't\\n'\n",
    )
    _write_executable(
        bin_dir / "sem",
        """
if [[ ${1:-} == "--version" ]]; then
  echo "GNU parallel fake"
  exit 0
fi
printf '%s\n' "$PARALLEL_HOME"
""",
    )
    state_root = tmp_path / "state"
    env = os.environ.copy()
    env["PATH"] = f"{bin_dir}{os.pathsep}{env['PATH']}"
    env["XDG_STATE_HOME"] = str(state_root)
    env["POSTGRES_URL"] = "postgresql://postgres:postgres@localhost:61234/postgres"
    script = REPO_ROOT / "scripts" / "workflow" / "preflight-locked.sh"

    result = subprocess.run(
        ["/bin/bash", str(script)],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
        timeout=5,
    )

    expected = state_root / "pinpoint" / "parallel"
    assert result.returncode == 0, result.stdout + result.stderr
    assert result.stdout == f"{expected}\n"
    assert expected.is_dir()


def test_agent_docs_name_bootstrap_and_targeted_entrypoints() -> None:
    agents = (REPO_ROOT / "AGENTS.md").read_text()
    testing = (REPO_ROOT / "src" / "test" / "README.md").read_text()

    for content in (agents, testing):
        assert "supabase start && pnpm run db:migrate" in content
        assert "pnpm run test:integration:target --" in content
        assert "bare Vitest command" in content

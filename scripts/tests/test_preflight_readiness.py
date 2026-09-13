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
    tmp_path: Path,
    mode: str,
    *args: str,
    database_url_override: str | None = None,
    non_pooling_url_override: str | None = None,
    supabase_url_override: str | None = None,
    dotenv_extra: str = "",
) -> subprocess.CompletedProcess[str]:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _write_executable(
        bin_dir / "pg_isready",
        '[[ "$STUB_MODE" == "unreachable" ]] && exit 1\nexit 0\n',
    )
    _write_executable(
        bin_dir / "curl",
        '[[ "$STUB_MODE" == "api_unreachable" ]] && exit 1\nexit 0\n',
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
    wrong_timestamp)
      if [[ "$*" == *"a.created_at = e.created_at"* ]]; then
        printf 'diverged\\n'
      else
        printf 'ready\\n'
      fi
      ;;
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
        "POSTGRES_URL_NON_POOLING=postgresql://postgres:postgres@localhost:61234/postgres\n"
        "NEXT_PUBLIC_SUPABASE_URL=http://localhost:61233\n"
        f"{dotenv_extra}"
    )
    env = os.environ.copy()
    env["PATH"] = f"{bin_dir}{os.pathsep}{env['PATH']}"
    env["STUB_MODE"] = mode
    if database_url_override is not None:
        env["POSTGRES_URL"] = database_url_override
    if non_pooling_url_override is not None:
        env["POSTGRES_URL_NON_POOLING"] = non_pooling_url_override
    if supabase_url_override is not None:
        env["NEXT_PUBLIC_SUPABASE_URL"] = supabase_url_override
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


def test_unavailable_supabase_api_fails_before_schema_inspection(
    tmp_path: Path,
) -> None:
    result = _run_readiness(tmp_path, "api_unreachable")

    assert result.returncode == 1
    assert result.stdout == ""
    assert result.stderr.splitlines() == [
        "FAIL: preflight readiness — Supabase Auth is unavailable at localhost:61233",
        "Run: supabase start && pnpm run db:migrate",
    ]


def test_dotenv_values_are_parsed_without_shell_execution(tmp_path: Path) -> None:
    marker = tmp_path / "dotenv-command-ran"
    result = _run_readiness(
        tmp_path,
        "ready",
        dotenv_extra=f"CUSTOM=$(touch {marker})\n",
    )

    assert result.returncode == 0
    assert not marker.exists()


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


def test_hash_record_with_wrong_journal_timestamp_requires_local_reset(
    tmp_path: Path,
) -> None:
    result = _run_readiness(tmp_path, "wrong_timestamp")

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


def test_explicit_database_url_overrides_dotenv_target(tmp_path: Path) -> None:
    result = _run_readiness(
        tmp_path,
        "ready",
        database_url_override=(
            "postgresql://postgres:postgres@localhost:62345/postgres"
        ),
        non_pooling_url_override=(
            "postgresql://postgres:postgres@localhost:62345/postgres"
        ),
        supabase_url_override="http://localhost:62344",
    )

    assert result.returncode == 0
    assert result.stderr == ""
    assert result.stdout == (
        "PASS: preflight readiness — Postgres ready at localhost:62345\n"
    )


def test_explicit_empty_database_url_is_not_replaced_from_dotenv(
    tmp_path: Path,
) -> None:
    result = _run_readiness(
        tmp_path,
        "ready",
        database_url_override="",
    )

    assert result.returncode == 1
    assert result.stdout == ""
    assert result.stderr.splitlines() == [
        "FAIL: preflight readiness — POSTGRES_URL is explicitly empty",
        "Run: unset POSTGRES_URL POSTGRES_URL_NON_POOLING NEXT_PUBLIC_SUPABASE_URL",
    ]


def test_explicit_database_override_requires_matching_non_pooling_url(
    tmp_path: Path,
) -> None:
    result = _run_readiness(
        tmp_path,
        "ready",
        database_url_override=(
            "postgresql://postgres:postgres@localhost:62345/postgres"
        ),
        non_pooling_url_override=(
            "postgresql://postgres:postgres@localhost:61234/postgres"
        ),
    )

    assert result.returncode == 1
    assert result.stdout == ""
    assert result.stderr.splitlines() == [
        "FAIL: preflight readiness — local stack overrides must be defined together and match",
        "Run: unset POSTGRES_URL POSTGRES_URL_NON_POOLING NEXT_PUBLIC_SUPABASE_URL",
    ]


def test_non_pooling_only_override_is_preserved_and_rejected(
    tmp_path: Path,
) -> None:
    result = _run_readiness(
        tmp_path,
        "ready",
        non_pooling_url_override=(
            "postgresql://postgres:postgres@localhost:62345/postgres"
        ),
    )

    assert result.returncode == 1
    assert result.stdout == ""
    assert result.stderr.splitlines() == [
        "FAIL: preflight readiness — local stack overrides must be defined together and match",
        "Run: unset POSTGRES_URL POSTGRES_URL_NON_POOLING NEXT_PUBLIC_SUPABASE_URL",
    ]


def test_database_overrides_without_supabase_endpoint_are_rejected(
    tmp_path: Path,
) -> None:
    database_url = "postgresql://postgres:postgres@localhost:62345/postgres"
    result = _run_readiness(
        tmp_path,
        "ready",
        database_url_override=database_url,
        non_pooling_url_override=database_url,
    )

    assert result.returncode == 1
    assert result.stdout == ""
    assert result.stderr.splitlines() == [
        "FAIL: preflight readiness — local stack overrides must be defined together and match",
        "Run: unset POSTGRES_URL POSTGRES_URL_NON_POOLING NEXT_PUBLIC_SUPABASE_URL",
    ]


def test_stack_override_requires_adjacent_api_and_database_ports(
    tmp_path: Path,
) -> None:
    database_url = "postgresql://postgres:postgres@localhost:62345/postgres"
    result = _run_readiness(
        tmp_path,
        "ready",
        database_url_override=database_url,
        non_pooling_url_override=database_url,
        supabase_url_override="http://localhost:61233",
    )

    assert result.returncode == 1
    assert result.stdout == ""
    assert result.stderr.splitlines() == [
        "FAIL: preflight readiness — local stack overrides do not identify one worktree stack",
        "Run: unset POSTGRES_URL POSTGRES_URL_NON_POOLING NEXT_PUBLIC_SUPABASE_URL",
    ]


def test_stack_override_requires_http_supabase_origin(tmp_path: Path) -> None:
    database_url = "postgresql://postgres:postgres@localhost:62345/postgres"
    result = _run_readiness(
        tmp_path,
        "ready",
        database_url_override=database_url,
        non_pooling_url_override=database_url,
        supabase_url_override="https://localhost:62344",
    )

    assert result.returncode == 1
    assert result.stdout == ""
    assert result.stderr.splitlines() == [
        "FAIL: preflight readiness — local stack overrides do not identify one worktree stack",
        "Run: unset POSTGRES_URL POSTGRES_URL_NON_POOLING NEXT_PUBLIC_SUPABASE_URL",
    ]


def test_stack_override_requires_generated_postgres_database(tmp_path: Path) -> None:
    database_url = "postgresql://postgres:postgres@localhost:62345/otherdb"
    result = _run_readiness(
        tmp_path,
        "ready",
        database_url_override=database_url,
        non_pooling_url_override=database_url,
        supabase_url_override="http://localhost:62344",
    )

    assert result.returncode == 1
    assert result.stdout == ""
    assert result.stderr.splitlines() == [
        "FAIL: preflight readiness — local stack overrides do not identify one worktree stack",
        "Run: unset POSTGRES_URL POSTGRES_URL_NON_POOLING NEXT_PUBLIC_SUPABASE_URL",
    ]


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
    _write_executable(bin_dir / "curl", "exit 0\n")
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
    env["POSTGRES_URL_NON_POOLING"] = env["POSTGRES_URL"]
    env["NEXT_PUBLIC_SUPABASE_URL"] = "http://localhost:61233"
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

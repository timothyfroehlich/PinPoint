"""Regression tests for scripts/dev-status.sh.

The script owns the decision about whether the worktree-local services are healthy.
These tests drive the real Bash entry point while replacing its external commands
with deterministic fakes, so they exercise the status logic without requiring a
running Next.js or Supabase stack.
"""

import os
import subprocess
from pathlib import Path

SCRIPT_PATH = Path(__file__).parent.parent / "dev-status.sh"


def _write_executable(path: Path, body: str) -> None:
    path.write_text(f"#!/usr/bin/env bash\n{body}")
    path.chmod(0o755)


def _run_status(
    tmp_path: Path, *, supabase_api_up: bool
) -> subprocess.CompletedProcess:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()

    curl_calls = tmp_path / "curl-calls"
    postgres_calls = tmp_path / "postgres-calls"
    supabase_calls = tmp_path / "supabase-calls"

    _write_executable(
        bin_dir / "supabase",
        f"""printf '%s\\n' "$*" >> "{supabase_calls}"
cat <<'EOF'
Stopped services: [supabase_imgproxy_pinpoint]
API URL: http://localhost:56421
DB URL: postgresql://postgres:postgres@localhost:56422/postgres
EOF
""",
    )
    _write_executable(
        bin_dir / "curl",
        f"""printf '%s\\n' "$*" >> "{curl_calls}"
case "$*" in
  *'/auth/v1/health'*) exit {0 if supabase_api_up else 1} ;;
  *) exit 0 ;;
esac
""",
    )
    _write_executable(
        bin_dir / "pg_isready",
        f'printf \'%s\\n\' "$*" >> "{postgres_calls}"\nexit 0\n',
    )

    (tmp_path / ".env.local").write_text(
        "PORT=3210\n"
        "NEXT_PUBLIC_SUPABASE_URL=http://localhost:56421\n"
        "POSTGRES_URL_NON_POOLING=postgresql://postgres:postgres@localhost:56422/postgres\n"
    )

    env = os.environ.copy()
    env["PATH"] = f"{bin_dir}{os.pathsep}{env['PATH']}"
    return subprocess.run(
        ["bash", str(SCRIPT_PATH)],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_healthy_worktree_uses_configured_endpoints_not_cli_text(
    tmp_path: Path,
) -> None:
    result = _run_status(tmp_path, supabase_api_up=True)

    assert result.returncode == 0, result.stdout + result.stderr
    assert "✅ Supabase API   http://localhost:56421" in result.stdout
    assert "Supabase is not started" not in result.stdout
    curl_calls = (tmp_path / "curl-calls").read_text()
    assert "http://localhost:3210" in curl_calls
    assert "http://localhost:56421/auth/v1/health" in curl_calls
    assert "localhost:54321" not in curl_calls
    assert "localhost:56422" in (tmp_path / "postgres-calls").read_text()
    assert not (tmp_path / "supabase-calls").exists()


def test_unavailable_worktree_api_fails_clearly(tmp_path: Path) -> None:
    result = _run_status(tmp_path, supabase_api_up=False)

    assert result.returncode == 1
    assert "❌ Supabase API   http://localhost:56421" in result.stdout
    assert "Supabase is not started" not in result.stdout

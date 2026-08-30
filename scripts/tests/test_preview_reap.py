"""Regression tests for the preview reaper's Supabase JSON boundary."""

import os
import stat
import subprocess
from pathlib import Path

SCRIPT = Path(__file__).parent.parent / "workflow" / "preview" / "preview-reap.sh"


def _run_reaper(
    tmp_path: Path,
    *,
    stdout: str,
    stderr: str = "",
    exit_code: int = 0,
) -> subprocess.CompletedProcess[str]:
    supabase = tmp_path / "supabase"
    supabase.write_text(
        "#!/usr/bin/env bash\n"
        'printf "%s" "$STUB_SUPABASE_STDOUT"\n'
        'printf "%s" "$STUB_SUPABASE_STDERR" >&2\n'
        'exit "$STUB_SUPABASE_EXIT_CODE"\n',
        encoding="utf-8",
    )
    supabase.chmod(supabase.stat().st_mode | stat.S_IEXEC)

    env = os.environ.copy()
    env.update(
        {
            "PATH": f"{tmp_path}{os.pathsep}{env['PATH']}",
            "GITHUB_REPOSITORY": "example/repo",
            "STUB_SUPABASE_EXIT_CODE": str(exit_code),
            "STUB_SUPABASE_STDERR": stderr,
            "STUB_SUPABASE_STDOUT": stdout,
            "SUPABASE_PROJECT_ID": "test-project-ref",
        }
    )
    return subprocess.run(
        ["bash", str(SCRIPT)],
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )


def test_valid_json_is_not_corrupted_by_stderr_chatter(tmp_path: Path) -> None:
    notice = (
        "A new version of Supabase CLI is available: "
        "v2.116.0 (currently installed v2.115.0)\n"
    )

    result = _run_reaper(
        tmp_path,
        stdout='[{"name":"manual-safe-branch"}]\n',
        stderr=notice,
    )

    assert result.returncode == 0, result.stderr
    assert "Total preview branches: 1" in result.stdout
    assert "SKIP (not a pr-<N> branch): manual-safe-branch" in result.stdout
    assert "Reap complete." in result.stdout
    assert notice.strip() in result.stderr


def test_malformed_branch_list_fails_before_evaluation(tmp_path: Path) -> None:
    result = _run_reaper(tmp_path, stdout="not-json\n")

    assert result.returncode != 0
    assert "Supabase branch listing was not a valid JSON array" in result.stderr
    assert "Total preview branches:" not in result.stdout
    assert "DESTROY" not in result.stdout


def test_branch_list_command_failure_surfaces_stderr(tmp_path: Path) -> None:
    result = _run_reaper(
        tmp_path,
        stdout="partial response\n",
        stderr="management API unavailable\n",
        exit_code=1,
    )

    assert result.returncode == 1
    assert "ERROR: failed to list Supabase branches" in result.stderr
    assert "partial response" in result.stderr
    assert "management API unavailable" in result.stderr
    assert "DESTROY" not in result.stdout

"""Tests for honest, bounded orchestration snapshot failures."""

import shutil
import subprocess
from pathlib import Path

SCRIPT_PATH = Path(__file__).parent.parent / "workflow" / "orchestration-status.sh"


def _run_pr_snapshot(
    tmp_path: Path,
    producer: str,
    *args: str,
) -> subprocess.CompletedProcess[str]:
    workflow = tmp_path / "scripts" / "workflow"
    workflow.mkdir(parents=True)
    script = workflow / "orchestration-status.sh"
    shutil.copy2(SCRIPT_PATH, script)

    dashboard = workflow / "pr-dashboard.sh"
    dashboard.write_text(f"#!/usr/bin/env bash\nset -euo pipefail\n{producer}")
    dashboard.chmod(0o755)

    return subprocess.run(
        ["bash", str(script), "--prs-only", *args],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
        timeout=5,
    )


def test_empty_dashboard_is_a_success_not_an_error(tmp_path: Path) -> None:
    result = _run_pr_snapshot(tmp_path, "echo 'No open PRs found.'\n")

    assert result.returncode == 0
    assert "No open PRs found." in result.stdout
    assert "ERROR:" not in result.stdout


def test_producer_failure_is_nonzero_and_reports_bounded_sanitized_cause(
    tmp_path: Path,
) -> None:
    secret = "ghp_abcdefghijklmnopqrstuvwxyz123456"
    result = _run_pr_snapshot(
        tmp_path,
        "echo 'partial misleading table'\n"
        f"echo 'fatal: token={secret} request refused' >&2\n"
        "exit 7\n",
    )

    assert result.returncode == 1
    assert "partial misleading table" not in result.stdout
    error = next(
        line for line in result.stdout.splitlines() if line.startswith("ERROR:")
    )
    assert error.startswith("ERROR: PR dashboard unavailable (exit 7): fatal: ")
    assert "[REDACTED]" in error
    assert secret not in result.stdout
    assert len(error) <= 290


def test_failure_without_stderr_says_no_diagnostic(tmp_path: Path) -> None:
    result = _run_pr_snapshot(tmp_path, "exit 4\n")

    assert result.returncode == 1
    assert (
        "ERROR: PR dashboard unavailable (exit 4): no diagnostic emitted"
        in result.stdout
    )


def test_verbose_mode_streams_the_producer_diagnostic(tmp_path: Path) -> None:
    result = _run_pr_snapshot(
        tmp_path,
        "echo 'full troubleshooting detail' >&2\nexit 3\n",
        "--verbose",
    )

    assert result.returncode == 1
    assert "full troubleshooting detail" in result.stderr
    assert "ERROR: PR dashboard unavailable (exit 3)" in result.stdout
    assert "no diagnostic emitted" not in result.stdout


def test_worktree_section_passes_only_the_expected_arguments(tmp_path: Path) -> None:
    scripts = tmp_path / "scripts"
    workflow = scripts / "workflow"
    workflow.mkdir(parents=True)
    script = workflow / "orchestration-status.sh"
    shutil.copy2(SCRIPT_PATH, script)
    (scripts / "worktree_reap.py").write_text(
        "import sys\nprint('ARGS=' + '|'.join(sys.argv[1:]), file=sys.stderr)\n"
    )

    result = subprocess.run(
        ["bash", str(script), "--worktrees-only"],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
        timeout=5,
    )

    assert result.returncode == 0, result.stdout + result.stderr
    assert result.stdout.count("ARGS=") == 1
    assert "ARGS=--repo-dir|" in result.stdout
    assert result.stderr == ""
    assert "|+|" not in result.stdout

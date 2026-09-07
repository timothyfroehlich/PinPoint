"""Contract tests for the isolated full-plus-smoke E2E runner (PP-wvhl)."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).parents[2]
RUNNER = REPO_ROOT / "scripts" / "workflow" / "e2e-all-isolated.sh"


def _run_with_fake_pnpm(
    tmp_path: Path, *, fail_config: str = ""
) -> subprocess.CompletedProcess[str]:
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    fake_pnpm = fake_bin / "pnpm"
    fake_pnpm.write_text(
        """#!/usr/bin/env bash
printf '%s\\n' "$*" >>"$E2E_CALL_LOG"
if [[ -n ${E2E_FAIL_CONFIG:-} && $* == *"$E2E_FAIL_CONFIG"* ]]; then
  printf 'synthetic playwright failure\\n' >&2
  exit 7
fi
printf '3 passed\\n'
"""
    )
    fake_pnpm.chmod(0o755)

    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}{os.pathsep}{env['PATH']}"
    env["E2E_CALL_LOG"] = str(tmp_path / "calls.log")
    env["E2E_FAIL_CONFIG"] = fail_config
    return subprocess.run(
        ["bash", str(RUNNER)],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def _calls(tmp_path: Path) -> list[str]:
    return (tmp_path / "calls.log").read_text().splitlines()


def test_runs_full_then_smoke_with_separate_chromium_invocations(
    tmp_path: Path,
) -> None:
    result = _run_with_fake_pnpm(tmp_path)

    assert result.returncode == 0
    assert _calls(tmp_path) == [
        "exec playwright test --config=playwright.config.full.ts --project=chromium",
        "exec playwright test --config=playwright.config.smoke.ts --project=chromium",
    ]
    assert "All E2E suites passed" in result.stdout


def test_stops_after_first_failed_suite_and_preserves_exit_code(tmp_path: Path) -> None:
    result = _run_with_fake_pnpm(tmp_path, fail_config="playwright.config.full.ts")

    assert result.returncode == 7
    assert _calls(tmp_path) == [
        "exec playwright test --config=playwright.config.full.ts --project=chromium"
    ]
    assert "[full] suite failed (exit 7)" in result.stdout
    assert "synthetic playwright failure" in result.stderr

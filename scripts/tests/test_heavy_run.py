"""Behavior coverage for heavy-run.sh, the shell entry to the agent memory budget.

The admission logic itself is covered in test_agent_budget.py; these tests pin
the wrapper's contract: a required kind, then the command run with its
arguments and exit code intact.
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parents[2]
HEAVY_RUN = REPO_ROOT / "scripts" / "workflow" / "heavy-run.sh"
PRINT_ARGV = "import json, sys; print(json.dumps(sys.argv[1:])); sys.exit(7)"
TRICKY_ARGS = ["--project=Mobile Chrome", "it's", "$HOME"]
EXPECTED_STDOUT = '["--project=Mobile Chrome", "it\'s", "$HOME"]\n'


def _env(tmp_path: Path, **extra: str) -> dict[str, str]:
    env = os.environ.copy()
    for name in ("CI", "PINPOINT_AGENT_BUDGET_HELD"):
        env.pop(name, None)
    env.update(XDG_STATE_HOME=str(tmp_path / "state"), **extra)
    return env


@pytest.mark.parametrize(
    "mode",
    [{"PINPOINT_AGENT_BUDGET": "on"}, {"CI": "1"}],
    ids=["budget-enforced", "ci-passthrough"],
)
def test_arguments_and_exit_code_survive(tmp_path: Path, mode: dict[str, str]) -> None:
    result = subprocess.run(
        [
            "/bin/bash",
            str(HEAVY_RUN),
            "unit",
            sys.executable,
            "-c",
            PRINT_ARGV,
            *TRICKY_ARGS,
        ],
        env=_env(tmp_path, **mode),
        capture_output=True,
        text=True,
        check=False,
        timeout=15,
    )

    assert result.returncode == 7, result.stderr
    assert result.stdout == EXPECTED_STDOUT


def test_a_kind_is_required(tmp_path: Path) -> None:
    result = subprocess.run(
        ["/bin/bash", str(HEAVY_RUN), "true"],
        env=_env(tmp_path),
        capture_output=True,
        text=True,
        check=False,
        timeout=15,
    )

    assert result.returncode == 64
    assert "Usage" in result.stderr

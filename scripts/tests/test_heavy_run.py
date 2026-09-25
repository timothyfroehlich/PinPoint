"""Behavior coverage for heavy-run.sh's host-wide admission wrapper."""

import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parents[2]
HEAVY_RUN = REPO_ROOT / "scripts" / "workflow" / "heavy-run.sh"
PRINT_ARGV = "import json, sys; print(json.dumps(sys.argv[1:])); sys.exit(7)"
TRICKY_ARGS = ["--project=Mobile Chrome", "it's", "$HOME"]
EXPECTED_STDOUT = '["--project=Mobile Chrome", "it\'s", "$HOME"]\n'


def _run(env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["/bin/bash", str(HEAVY_RUN), sys.executable, "-c", PRINT_ARGV, *TRICKY_ARGS],
        env=env,
        capture_output=True,
        text=True,
        check=False,
        timeout=15,
    )


def test_runs_command_directly_when_sem_is_absent(tmp_path: Path) -> None:
    empty_bin = tmp_path / "bin"
    empty_bin.mkdir()

    result = _run({"PATH": str(empty_bin), "HOME": str(tmp_path)})

    assert result.returncode == 7, result.stderr
    assert result.stdout == EXPECTED_STDOUT


def test_arguments_and_exit_code_survive_sem_shell_reparse(tmp_path: Path) -> None:
    # GNU sem re-parses its command string through a shell; mimic exactly that.
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    fake_sem = fake_bin / "sem"
    fake_sem.write_text(
        "#!/bin/bash\n"
        '[[ $1 == --version ]] && { echo "GNU parallel fake"; exit 0; }\n'
        'exec bash -c "${@: -1}"\n'
    )
    fake_sem.chmod(0o755)
    env = os.environ.copy()
    env.pop("CI", None)
    env["PATH"] = f"{fake_bin}{os.pathsep}{env['PATH']}"
    env["XDG_STATE_HOME"] = str(tmp_path / "state")

    result = _run(env)

    assert result.returncode == 7, result.stderr
    assert result.stdout == EXPECTED_STDOUT
    assert (tmp_path / "state" / "pinpoint" / "parallel").is_dir()

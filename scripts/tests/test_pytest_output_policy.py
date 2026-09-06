"""Regression tests for pytest's failure-output security policy (PP-my61)."""

import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
PYTEST_CONFIG = REPO_ROOT / "pytest.ini"


def test_default_failure_output_hides_environment_locals(tmp_path: Path) -> None:
    """Default tracebacks keep diagnostics useful without serializing secrets."""
    sentinel = "synthetic-pytest-secret-must-not-appear"
    failing_test = tmp_path / "test_intentional_failure.py"
    failing_test.write_text(
        """\
import os
import sys


def test_intentional_failure():
    environment = os.environ.copy()
    print("public stdout diagnostic")
    print("public stderr diagnostic", file=sys.stderr)
    assert False, "intentional policy-test failure"
""",
        encoding="utf-8",
    )

    child_env = {
        "HOME": str(tmp_path),
        "PATH": os.environ.get("PATH", ""),
        "LANG": os.environ.get("LANG", "C.UTF-8"),
        "PINPOINT_PYTEST_SENTINEL": sentinel,
        "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1",
    }
    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-c",
            str(PYTEST_CONFIG),
            str(failing_test),
        ],
        cwd=REPO_ROOT,
        env=child_env,
        capture_output=True,
        text=True,
        check=False,
    )
    output = completed.stdout + completed.stderr

    assert completed.returncode == 1
    assert sentinel not in output
    assert "test_intentional_failure" in output
    assert "assert False" in output
    assert "public stdout diagnostic" in output
    assert "public stderr diagnostic" in output

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = PROJECT_ROOT / "scripts/audit/no-hardcoded-role-checks.sh"
pytestmark = pytest.mark.skipif(
    shutil.which("rg") is None,
    reason="role-audit regression tests require the script's ripgrep prerequisite",
)


def run_audit(tmp_path: Path, source: str) -> subprocess.CompletedProcess[str]:
    src = tmp_path / "src"
    src.mkdir()
    (src / "example.ts").write_text(source)
    return subprocess.run(
        ["bash", str(SCRIPT)],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
    )


def test_detects_arbitrary_identifiers_and_property_access(tmp_path: Path) -> None:
    result = run_audit(
        tmp_path,
        'if (accessLevel === "admin" || currentUser.role !== "guest") {}\n',
    )

    assert result.returncode == 1
    assert 'accessLevel === "admin"' in result.stderr


def test_ignores_role_comparisons_on_pure_comment_lines(tmp_path: Path) -> None:
    result = run_audit(
        tmp_path,
        """// accessLevel === \"admin\"
/* currentUser.role !== \"guest\" */
/**
 * role === \"technician\"
 */
export const harmless = true;
""",
    )

    assert result.returncode == 0
    assert result.stderr == ""


def test_accepts_an_adjacent_allow_marker(tmp_path: Path) -> None:
    result = run_audit(
        tmp_path,
        """// permissions-audit-allow: display-only label
if (viewer.role === \"member\") {}
""",
    )

    assert result.returncode == 0
    assert result.stderr == ""

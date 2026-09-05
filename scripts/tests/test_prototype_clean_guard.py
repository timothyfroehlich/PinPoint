"""Regression tests for the prototype-mode cleanup guard."""

import json
import subprocess
from pathlib import Path

GUARD_PATH = Path(__file__).parent.parent / "hooks/prototype-clean-guard.sh"
REPO_ROOT = Path(__file__).parents[2]


def _run_guard(repo_root: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["bash", str(GUARD_PATH), str(repo_root)],
        capture_output=True,
        text=True,
        check=False,
    )


def _prototype_root(repo_root: Path) -> Path:
    return repo_root / "src/app/(dev)/prototype"


def test_clean_tree_without_prototype_directory_passes(tmp_path: Path) -> None:
    result = _run_guard(tmp_path)

    assert result.returncode == 0, result.stderr


def test_layout_only_state_passes(tmp_path: Path) -> None:
    prototype_root = _prototype_root(tmp_path)
    prototype_root.mkdir(parents=True)
    (prototype_root / "layout.tsx").write_text("export default null;\n")

    result = _run_guard(tmp_path)

    assert result.returncode == 0, result.stderr


def test_active_marker_fails(tmp_path: Path) -> None:
    (tmp_path / ".prototype-mode").write_text("# Prototype mode\n")

    result = _run_guard(tmp_path)

    assert result.returncode == 1
    assert ".prototype-mode" in result.stderr
    assert "local-only" in result.stderr


def test_disposable_route_fails(tmp_path: Path) -> None:
    route = _prototype_root(tmp_path) / "region-alerts"
    route.mkdir(parents=True)
    (route / "page.tsx").write_text("export default null;\n")

    result = _run_guard(tmp_path)

    assert result.returncode == 1
    assert "region-alerts" in result.stderr
    assert "local-only" in result.stderr


def test_disposable_file_next_to_layout_fails(tmp_path: Path) -> None:
    prototype_root = _prototype_root(tmp_path)
    prototype_root.mkdir(parents=True)
    (prototype_root / "layout.tsx").write_text("export default null;\n")
    (prototype_root / "fixture.ts").write_text("export const fixture = {};\n")

    result = _run_guard(tmp_path)

    assert result.returncode == 1
    assert "fixture.ts" in result.stderr


def test_both_preflight_paths_run_the_cleanup_guard() -> None:
    package = json.loads((REPO_ROOT / "package.json").read_text())
    locked_script = (REPO_ROOT / "scripts/workflow/preflight-locked.sh").read_text()

    assert "bash scripts/hooks/prototype-clean-guard.sh" in locked_script
    assert package["scripts"]["preflight:unlocked"].startswith(
        "pnpm run check:prototype-clean && "
    )

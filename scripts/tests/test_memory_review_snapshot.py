"""Unit tests for the memory-review snapshotter.

The Claude memory store has no history and no undo, so this script is the only
way back from a bad review pass. These tests pin the two properties that matter:
every store is copied byte-for-byte, and retention pruning never deletes the
snapshot just taken.
"""

import ast
import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent.parent / "memory_review" / "snapshot_stores.py"


@pytest.fixture
def machine(tmp_path: Path) -> dict[str, Path]:
    home = tmp_path / "home" / "someone"
    claude = home / ".claude"
    store = claude / "projects" / "-home-someone-Code-PinPoint" / "memory"
    store.mkdir(parents=True)
    (store / "one.md").write_text("---\nname: one\n---\nalpha\n", encoding="utf-8")
    (store / "MEMORY.md").write_text("- [One](one.md)\n", encoding="utf-8")
    return {"home": home, "claude": claude, "dest": tmp_path / "snapshots"}


def _invoke(machine: dict[str, Path], *extra: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--home",
            str(machine["home"]),
            "--claude-dir",
            str(machine["claude"]),
            "--dest-root",
            str(machine["dest"]),
            *extra,
        ],
        capture_output=True,
        text=True,
    )


def _run(machine: dict[str, Path], *extra: str) -> dict:
    proc = _invoke(machine, *extra)
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


def test_copies_every_file_byte_for_byte(machine):
    receipt = _run(machine, "--stamp", "20260728-120000")
    copied = Path(receipt["snapshot_dir"]) / "-home-someone-Code-PinPoint" / "memory"
    assert (copied / "one.md").read_text(encoding="utf-8") == (
        "---\nname: one\n---\nalpha\n"
    )
    assert (copied / "MEMORY.md").read_text(encoding="utf-8") == "- [One](one.md)\n"
    assert receipt["stores"][0]["files"] == 2


def test_snapshot_dir_is_named_for_the_stamp(machine):
    receipt = _run(machine, "--stamp", "20260728-120000")
    assert Path(receipt["snapshot_dir"]).name == "20260728-120000"


def test_refuses_to_overwrite_an_existing_snapshot(machine):
    _run(machine, "--stamp", "20260728-120000")
    proc = _invoke(machine, "--stamp", "20260728-120000")
    assert proc.returncode != 0
    assert "already exists" in proc.stderr


def test_pruning_keeps_the_newest_and_never_the_current(machine):
    for stamp in ("20260701-000000", "20260702-000000", "20260703-000000"):
        _run(machine, "--stamp", stamp)
    receipt = _run(machine, "--stamp", "20260704-000000", "--keep", "2")
    remaining = sorted(p.name for p in machine["dest"].iterdir())
    assert remaining == ["20260703-000000", "20260704-000000"]
    assert receipt["pruned"] == ["20260701-000000", "20260702-000000"]
    assert Path(receipt["snapshot_dir"]).is_dir(), (
        "must never prune the snapshot it just took"
    )


def test_keep_zero_disables_pruning(machine):
    _run(machine, "--stamp", "20260701-000000")
    receipt = _run(machine, "--stamp", "20260702-000000", "--keep", "0")
    assert receipt["pruned"] == []
    assert len(list(machine["dest"].iterdir())) == 2


def test_snapshots_worktree_scoped_stores_too(machine):
    """A memory written by a worktree session is otherwise unrecoverable, which
    makes it exactly the thing a safety net should cover."""
    wt = (
        machine["claude"]
        / "projects"
        / "-home-someone-Code-PinPoint--claude-worktrees-agent-abc"
        / "memory"
    )
    wt.mkdir(parents=True)
    (wt / "orphan.md").write_text("---\nname: orphan\n---\n", encoding="utf-8")
    receipt = _run(machine, "--stamp", "20260728-130000")
    assert any("worktrees" in s["slug"] for s in receipt["stores"])


def test_imports_only_dependency_free_stdlib():
    tree = ast.parse(SCRIPT.read_text(encoding="utf-8"))
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            imported.add(node.module.split(".")[0])

    allowed = {"__future__", "argparse", "datetime", "json", "shutil", "sys", "pathlib"}
    assert imported <= allowed, f"unexpected imports: {sorted(imported - allowed)}"
    assert "subprocess" not in imported

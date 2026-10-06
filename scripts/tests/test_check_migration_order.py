"""Tests for scripts/check_migration_order.py — gate for Drizzle journal order."""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from check_migration_order import (  # noqa: E402
    check_against_base,
    check_tree,
    main,
)


def write_tree(root: Path, migrations: list[tuple[str, int]]) -> Path:
    """Write a drizzle/ folder holding (tag, when) migrations with a valid snapshot chain."""
    drizzle = root / "drizzle"
    (drizzle / "meta").mkdir(parents=True)
    entries = []
    previous_id = "00000000-0000-0000-0000-000000000000"
    for idx, (tag, when) in enumerate(migrations):
        entries.append(
            {"idx": idx, "version": "7", "when": when, "tag": tag, "breakpoints": True}
        )
        (drizzle / f"{tag}.sql").write_text(f"-- {tag}\n")
        snapshot_id = f"id-{tag}"
        (drizzle / "meta" / f"{tag[:4]}_snapshot.json").write_text(
            json.dumps({"id": snapshot_id, "prevId": previous_id})
        )
        previous_id = snapshot_id
    (drizzle / "meta" / "_journal.json").write_text(
        json.dumps({"version": "7", "dialect": "postgresql", "entries": entries})
    )
    return drizzle


def rewrite_entries(drizzle: Path, edit) -> None:
    journal_path = drizzle / "meta" / "_journal.json"
    journal = json.loads(journal_path.read_text())
    edit(journal["entries"])
    journal_path.write_text(json.dumps(journal))


BASE = [("0000_init", 1000), ("0001_users", 2000)]


def test_current_repo_passes():
    """The live journal passes (single live-repo test)."""
    root = Path(__file__).resolve().parents[2]
    assert check_tree(root / "drizzle") == []


def test_ordered_tree_passes(tmp_path: Path):
    assert check_tree(write_tree(tmp_path, BASE)) == []


def test_hand_renumbered_migration_with_older_when_fails(tmp_path: Path):
    """The silent-skip case: 0002 renamed from an earlier 0001 keeps its older when."""
    drizzle = write_tree(tmp_path, [*BASE, ("0002_tags", 1500)])
    errors = check_tree(drizzle)
    assert len(errors) == 1
    assert "0002_tags" in errors[0] and "skip" in errors[0]


def test_equal_when_fails(tmp_path: Path):
    drizzle = write_tree(tmp_path, [*BASE, ("0002_tags", 2000)])
    assert any("not later" in e for e in check_tree(drizzle))


def test_grandfathered_entry_is_allowed_but_does_not_lower_the_bar(tmp_path: Path):
    """0012 may be older than 0011; 0013 must still be newer than 0011."""
    later = 1738972800000 + 1000
    migrations = [(f"{i:04d}_m{i}", later + i) for i in range(12)]
    migrations.append(("0012_fix_rls_user_metadata", 1738972800000))
    migrations.append(("0013_after", later + 5))
    errors = check_tree(write_tree(tmp_path, migrations))
    assert len(errors) == 1
    assert errors[0].startswith("0013_after")


def test_grandfathered_entry_with_a_changed_when_fails(tmp_path: Path):
    migrations = [(f"{i:04d}_m{i}", 1738972800000 + 1000 + i) for i in range(12)]
    migrations.append(("0012_fix_rls_user_metadata", 1))
    errors = check_tree(write_tree(tmp_path, migrations))
    assert any(e.startswith("0012_fix_rls_user_metadata") for e in errors)


def test_number_that_does_not_match_idx_fails(tmp_path: Path):
    drizzle = write_tree(tmp_path, [*BASE, ("0002_tags", 3000)])
    (drizzle / "0002_tags.sql").rename(drizzle / "0003_tags.sql")
    (drizzle / "meta" / "0002_snapshot.json").rename(
        drizzle / "meta" / "0003_snapshot.json"
    )
    rewrite_entries(drizzle, lambda entries: entries[2].update(tag="0003_tags"))
    errors = check_tree(drizzle)
    assert any("does not match idx 2" in e for e in errors)


def test_idx_gap_fails(tmp_path: Path):
    drizzle = write_tree(tmp_path, BASE)
    rewrite_entries(drizzle, lambda entries: entries[1].update(idx=2))
    assert any("idx is 2, expected 1" in e for e in check_tree(drizzle))


def test_missing_and_orphaned_files_fail(tmp_path: Path):
    drizzle = write_tree(tmp_path, BASE)
    (drizzle / "0001_users.sql").unlink()
    (drizzle / "0002_stray.sql").write_text("-- stray\n")
    (drizzle / "meta" / "0002_snapshot.json").write_text(
        json.dumps({"id": "x", "prevId": "y"})
    )
    errors = check_tree(drizzle)
    assert any("missing drizzle/0001_users.sql" in e for e in errors)
    assert any("0002_stray.sql is not in the journal" in e for e in errors)
    assert any("0002_snapshot.json is not in the journal" in e for e in errors)


def test_broken_snapshot_chain_fails(tmp_path: Path):
    drizzle = write_tree(tmp_path, BASE)
    (drizzle / "meta" / "0001_snapshot.json").write_text(
        json.dumps({"id": "id-0001", "prevId": "someone-else"})
    )
    assert any("prevId" in e for e in check_tree(drizzle))


def test_branch_appending_after_base_passes(tmp_path: Path):
    base = write_tree(tmp_path / "base", BASE)
    head = write_tree(tmp_path / "head", [*BASE, ("0002_tags", 3000)])
    assert check_against_base(head, base) == []


def test_branch_that_renumbers_a_base_migration_fails(tmp_path: Path):
    base = write_tree(tmp_path / "base", [*BASE, ("0002_tags", 3000)])
    head = write_tree(
        tmp_path / "head", [*BASE, ("0002_mine", 4000), ("0003_tags", 5000)]
    )
    errors = check_against_base(head, base)
    assert any("journal entry 2" in e for e in errors)


def test_editing_an_applied_migration_fails(tmp_path: Path):
    base = write_tree(tmp_path / "base", BASE)
    head = write_tree(tmp_path / "head", BASE)
    (head / "0001_users.sql").write_text("-- edited\n")
    errors = check_against_base(head, base)
    assert errors == [
        "drizzle/0001_users.sql differs from the base branch. Production never "
        "re-runs an applied migration; put the change in a new one"
    ]


def test_editing_a_base_snapshot_fails(tmp_path: Path):
    base = write_tree(tmp_path / "base", BASE)
    head = write_tree(tmp_path / "head", BASE)
    (head / "meta" / "0001_snapshot.json").write_text(
        json.dumps({"id": "id-0001_users", "prevId": "id-0000_init", "tables": {}})
    )
    errors = check_against_base(head, base)
    assert any("0001_snapshot.json differs" in e for e in errors)


def test_branch_behind_base_fails(tmp_path: Path):
    base = write_tree(tmp_path / "base", [*BASE, ("0002_tags", 3000)])
    head = write_tree(tmp_path / "head", BASE)
    assert any("missing here" in e for e in check_against_base(head, base))


def test_main_exit_codes(tmp_path: Path, capsys):
    root = tmp_path / "repo"
    write_tree(root, BASE)
    assert main(["--root", str(root)]) == 0

    base_root = tmp_path / "base"
    shutil.copytree(root / "drizzle", base_root / "drizzle")
    (root / "drizzle" / "0001_users.sql").write_text("-- edited\n")
    assert main(["--root", str(root), "--base-dir", str(base_root)]) == 1
    assert "Migration order check failed" in capsys.readouterr().err

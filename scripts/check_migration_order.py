#!/usr/bin/env python3
"""Gate: the Drizzle journal is in an order production will actually apply.

drizzle-orm's Postgres migrator does not match migrations by name. It reads the
newest `created_at` in `drizzle.__drizzle_migrations` and applies only the journal
entries whose `when` is later (drizzle-orm pg-core/dialect.js `migrate`). A
migration whose `when` is older than one already applied is skipped in production
and nothing records the skip. CI's `test-migrations` job applies every migration
to an empty database, so it never sees this.

The usual way to get there: two branches each generate migration N, one merges,
and the other is renumbered to N+1 by hand while keeping its original, older
`when`. Regenerating with `pnpm run db:generate` (or
`bash scripts/db-renumber-migration.sh`) writes a fresh `when`.

Checks on the working tree:
- journal `idx` values run 0..n-1 and each tag's numeric prefix equals its `idx`
- each `when` is later than every earlier entry's `when`
- every entry has `drizzle/<tag>.sql` and `drizzle/meta/<NNNN>_snapshot.json`,
  and no migration SQL or snapshot exists outside the journal
- each snapshot's `prevId` is the previous snapshot's `id`

With `--base-dir <dir>` (a directory holding the base branch's `drizzle/`):
- the base journal is an unchanged prefix of this one (no renumbering or
  re-timestamping of migrations that may already be applied)
- the base migrations' SQL is byte-identical; production never re-runs an
  applied migration, so an edit to one has no effect there
- the base migrations' snapshots are byte-identical; the next generate diffs
  against them
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

TAG_PATTERN = re.compile(r"^(\d{4})_[A-Za-z0-9_-]+$")

# Entries whose `when` predates an earlier entry. 0012 was hand-written with a
# placeholder timestamp (2025-02-08) after 0011 (2026-02-06). Prod's policies
# show its fix in effect (no RLS policy reads user_metadata, checked 2026-10-06),
# so the entry is grandfathered rather than rewritten.
# Pinned to the exact (tag, when), so a later edit to that entry is still caught.
GRANDFATHERED_WHEN = frozenset({("0012_fix_rls_user_metadata", 1738972800000)})


def load_entries(drizzle_dir: Path) -> list[dict[str, object]]:
    journal = json.loads((drizzle_dir / "meta" / "_journal.json").read_text())
    entries = journal.get("entries")
    if not isinstance(entries, list):
        raise ValueError(f"{drizzle_dir}/meta/_journal.json has no entries list")
    return entries


def check_tree(drizzle_dir: Path) -> list[str]:
    """Check the journal, SQL files and snapshot chain in one drizzle/ folder."""
    errors: list[str] = []
    entries = load_entries(drizzle_dir)
    newest_when = -1
    newest_tag = ""
    tags: set[str] = set()
    prefixes: set[str] = set()

    for position, entry in enumerate(entries):
        tag = str(entry.get("tag", ""))
        idx = entry.get("idx")
        when = entry.get("when")
        tags.add(tag)

        if idx != position:
            errors.append(f"{tag}: idx is {idx}, expected {position}")

        match = TAG_PATTERN.match(tag)
        if match is None:
            errors.append(f"{tag}: tag does not start with a 4-digit number")
        else:
            prefixes.add(match.group(1))
            if int(match.group(1)) != position:
                errors.append(
                    f"{tag}: file number {match.group(1)} does not match idx {position}"
                )

        if not isinstance(when, int):
            errors.append(f"{tag}: when is not an integer timestamp")
        elif when <= newest_when and (tag, when) not in GRANDFATHERED_WHEN:
            errors.append(
                f"{tag}: when {when} is not later than {newest_tag} ({newest_when}); "
                "production would skip it. Regenerate the migration "
                "(bash scripts/db-renumber-migration.sh) instead of renaming it"
            )
        if isinstance(when, int) and when > newest_when:
            newest_when = when
            newest_tag = tag

        if not (drizzle_dir / f"{tag}.sql").is_file():
            errors.append(f"{tag}: missing drizzle/{tag}.sql")
        if (
            match
            and not (drizzle_dir / "meta" / f"{match.group(1)}_snapshot.json").is_file()
        ):
            errors.append(f"{tag}: missing drizzle/meta/{match.group(1)}_snapshot.json")

    for sql in sorted(drizzle_dir.glob("*.sql")):
        if sql.stem not in tags:
            errors.append(f"drizzle/{sql.name} is not in the journal")

    snapshots = sorted((drizzle_dir / "meta").glob("*_snapshot.json"))
    previous_id: object = None
    for snapshot_path in snapshots:
        number = snapshot_path.name.split("_", 1)[0]
        if number not in prefixes:
            errors.append(f"drizzle/meta/{snapshot_path.name} is not in the journal")
            continue
        snapshot = json.loads(snapshot_path.read_text())
        if previous_id is not None and snapshot.get("prevId") != previous_id:
            errors.append(
                f"drizzle/meta/{snapshot_path.name}: prevId does not match the "
                "previous snapshot's id"
            )
        previous_id = snapshot.get("id")

    return errors


def check_against_base(drizzle_dir: Path, base_drizzle_dir: Path) -> list[str]:
    """Check that the base branch's migrations are an untouched prefix of ours."""
    errors: list[str] = []
    entries = load_entries(drizzle_dir)
    base_entries = load_entries(base_drizzle_dir)

    for position, base_entry in enumerate(base_entries):
        base_tag = base_entry.get("tag")
        if position >= len(entries):
            errors.append(f"{base_tag}: on the base branch but missing here")
            continue
        entry = entries[position]
        for field in ("idx", "tag", "when"):
            if entry.get(field) != base_entry.get(field):
                errors.append(
                    f"journal entry {position}: {field} is {entry.get(field)!r} here "
                    f"but {base_entry.get(field)!r} on the base branch. Migrations on "
                    "the base branch may already be applied; renumber this branch's "
                    "migrations after them instead"
                )
        sql = drizzle_dir / f"{base_tag}.sql"
        base_sql = base_drizzle_dir / f"{base_tag}.sql"
        if (
            sql.is_file()
            and base_sql.is_file()
            and sql.read_bytes() != base_sql.read_bytes()
        ):
            errors.append(
                f"drizzle/{base_tag}.sql differs from the base branch. Production "
                "never re-runs an applied migration; put the change in a new one"
            )
        number = str(base_tag)[:4]
        snapshot = drizzle_dir / "meta" / f"{number}_snapshot.json"
        base_snapshot = base_drizzle_dir / "meta" / f"{number}_snapshot.json"
        if (
            snapshot.is_file()
            and base_snapshot.is_file()
            and snapshot.read_bytes() != base_snapshot.read_bytes()
        ):
            errors.append(
                f"drizzle/meta/{number}_snapshot.json differs from the base branch. "
                "Take the base branch's drizzle/meta and regenerate your migration"
            )

    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument(
        "--root",
        type=Path,
        default=None,
        help="Repository root (default: auto-detected)",
    )
    parser.add_argument(
        "--base-dir",
        type=Path,
        default=None,
        help="Directory holding the base branch's drizzle/ folder",
    )
    args = parser.parse_args(argv)

    # scripts/ sits directly under the repository root.
    root = args.root or Path(__file__).resolve().parents[1]
    drizzle_dir = root / "drizzle"
    errors = check_tree(drizzle_dir)
    if args.base_dir is not None:
        errors += check_against_base(drizzle_dir, args.base_dir / "drizzle")

    if errors:
        print("Migration order check failed:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Snapshot this machine's Claude auto-memory stores before a review applies changes.

The memory store has no version history and no undo, so this is the only way back
if a review pass deletes something it should not have. One-way by design: Claude
never reads these snapshots and nothing merges them back - restoring is a
deliberate human copy.

Standard library only and no subprocess, for the same reason as collect_stores.py:

    ssh bazzite 'python3 - --dest-root $HOME/.pinpoint/memory-snapshots' \
        < scripts/memory_review/snapshot_stores.py
"""

from __future__ import annotations

import argparse
import datetime
import json
import re
import shutil
import sys
from pathlib import Path

DEFAULT_KEEP = 10
STAMP_FORMAT = "%Y%m%d-%H%M%S"
# Only directories matching the stamp shape are ours to delete. Humans are
# expected to restore by hand out of this root, so anything else they leave here
# must be outside the deletion pool.
SNAPSHOT_NAME_RE = re.compile(r"^\d{8}-\d{6}$")


def find_stores(claude_dir: Path) -> list[Path]:
    """Every slug directory that actually holds a memory store.

    Worktree-slug stores are included deliberately: a memory written by a
    worktree session is otherwise invisible and unrecoverable, which makes it
    exactly the thing a snapshot should protect.
    """
    projects = claude_dir / "projects"
    if not projects.is_dir():
        return []
    return sorted(
        p / "memory" for p in sorted(projects.iterdir()) if (p / "memory").is_dir()
    )


def copy_store(store: Path, snapshot_dir: Path) -> dict:
    target = snapshot_dir / store.parent.name / store.name
    shutil.copytree(store, target)
    files = [p for p in target.rglob("*") if p.is_file()]
    return {
        "slug": store.parent.name,
        "files": len(files),
        "bytes": sum(p.stat().st_size for p in files),
    }


def prune(dest_root: Path, keep: int, current: Path) -> list[str]:
    """Drop the oldest snapshots beyond `keep`. `keep <= 0` disables pruning.

    `current` is excluded unconditionally - pruning must never delete the
    snapshot this run just took, no matter what `keep` is set to.

    Only stamp-shaped directories are candidates. Without that filter a stray
    `restored/` left here by hand is recursively deletable, and because digits
    sort before letters it would survive while a genuine oldest snapshot was
    destroyed in its place - a silently wrong retention window.
    """
    if keep <= 0:
        return []
    existing = sorted(
        p
        for p in dest_root.iterdir()
        if p.is_dir() and p != current and SNAPSHOT_NAME_RE.match(p.name)
    )
    doomed = existing[: max(0, len(existing) - (keep - 1))]
    for path in doomed:
        shutil.rmtree(path)
    return [p.name for p in doomed]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Snapshot this machine's Claude memory stores."
    )
    parser.add_argument(
        "--dest-root",
        default=None,
        help="snapshot root (default ~/.pinpoint/memory-snapshots)",
    )
    parser.add_argument(
        "--stamp", default=None, help="snapshot directory name (default: UTC timestamp)"
    )
    parser.add_argument(
        "--keep",
        type=int,
        default=DEFAULT_KEEP,
        help="snapshots to retain; 0 disables pruning",
    )
    parser.add_argument("--home", default=None, help="override the home directory")
    parser.add_argument("--claude-dir", default=None, help="override ~/.claude")
    args = parser.parse_args(argv)

    home = Path(args.home) if args.home else Path.home()
    claude_dir = Path(args.claude_dir) if args.claude_dir else home / ".claude"
    dest_root = (
        Path(args.dest_root)
        if args.dest_root
        else home / ".pinpoint" / "memory-snapshots"
    )
    stamp = args.stamp or datetime.datetime.now(datetime.timezone.utc).strftime(
        STAMP_FORMAT
    )

    snapshot_dir = dest_root / stamp
    if snapshot_dir.exists():
        print(
            f"snapshot {snapshot_dir} already exists - refusing to overwrite",
            file=sys.stderr,
        )
        return 1

    dest_root.mkdir(parents=True, exist_ok=True)
    snapshot_dir.mkdir()
    stores = [copy_store(store, snapshot_dir) for store in find_stores(claude_dir)]

    receipt = {
        "schema_version": 1,
        "snapshot_dir": str(snapshot_dir),
        "stores": stores,
        "pruned": prune(dest_root, args.keep, snapshot_dir),
    }
    json.dump(receipt, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

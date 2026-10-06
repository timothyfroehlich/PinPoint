"""Tests for scripts/db-renumber-migration.sh against a temp repo mid-merge.

A stub `pnpm` on PATH stands in for `pnpm exec drizzle-kit generate`: it appends
the next journal entry with a current `when`, writes a chained snapshot, and
writes $FAKE_GENERATED as the migration SQL (an empty file means "no schema
changes", which sends the script to its `--custom` fallback).
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

pytestmark = pytest.mark.integration

SCRIPTS = Path(__file__).resolve().parent.parent
GIT_ENV = {
    "GIT_AUTHOR_NAME": "Test",
    "GIT_AUTHOR_EMAIL": "test@example.com",
    "GIT_COMMITTER_NAME": "Test",
    "GIT_COMMITTER_EMAIL": "test@example.com",
}

FAKE_PNPM = r"""#!/usr/bin/env bash
set -euo pipefail
[[ $1 == exec && $2 == drizzle-kit && $3 == generate ]] || exit 99
shift 3
name="" custom=0
while [[ $# -gt 0 ]]; do
  case $1 in
    --name) name=$2; shift 2 ;;
    --custom) custom=1; shift ;;
    *) shift ;;
  esac
done
journal=drizzle/meta/_journal.json
n=$(jq '.entries | length' "$journal")
if [[ $custom -eq 0 && ! -s $FAKE_GENERATED ]]; then
  echo "No schema changes, nothing to migrate"
  exit 0
fi
tag=$(printf '%04d_%s' "$n" "$name")
prev=$(jq -r .id "drizzle/meta/$(printf '%04d' $((n - 1)))_snapshot.json")
when=$(($(date +%s) * 1000))
jq --arg tag "$tag" --argjson idx "$n" --argjson when "$when" \
  '.entries += [{idx: $idx, version: "7", when: $when, tag: $tag, breakpoints: true}]' \
  "$journal" > "$journal.tmp"
mv "$journal.tmp" "$journal"
printf '{"id":"id-%s","prevId":"%s"}' "$tag" "$prev" > "drizzle/meta/$(printf '%04d' "$n")_snapshot.json"
if [[ $custom -eq 1 ]]; then
  echo "-- Custom SQL migration file, put your code below! --" > "drizzle/$tag.sql"
else
  cp "$FAKE_GENERATED" "drizzle/$tag.sql"
fi
"""

INIT = ("0000_init", 1000, "CREATE TABLE a (id int);\n")
THEIRS = ("0001_theirs", 3000, "CREATE TABLE b (id int);\n")
GENERATED = 'ALTER TABLE "a" ADD COLUMN "note" text;'
REVIEWED = (
    'ALTER TABLE "a" ADD COLUMN "note" text;--> statement-breakpoint\n'
    'UPDATE "a" SET "note" = \'x\';\n'
)


def git(repo: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args],
        cwd=repo,
        capture_output=True,
        text=True,
        env={**os.environ, **GIT_ENV},
        check=check,
    )


def write_migrations(repo: Path, migrations: list[tuple[str, int, str]]) -> None:
    drizzle = repo / "drizzle"
    (drizzle / "meta").mkdir(parents=True, exist_ok=True)
    entries = []
    previous = "00000000-0000-0000-0000-000000000000"
    for idx, (tag, when, sql) in enumerate(migrations):
        entries.append(
            {"idx": idx, "version": "7", "when": when, "tag": tag, "breakpoints": True}
        )
        (drizzle / f"{tag}.sql").write_text(sql)
        (drizzle / "meta" / f"{tag[:4]}_snapshot.json").write_text(
            json.dumps({"id": f"id-{tag}", "prevId": previous})
        )
        previous = f"id-{tag}"
    (drizzle / "meta" / "_journal.json").write_text(
        json.dumps({"version": "7", "dialect": "postgresql", "entries": entries})
    )


def mid_merge_repo(
    tmp_path: Path, reviewed_sql: str = REVIEWED, app_conflict: bool = False
) -> Path:
    """Branch adds 0001_mine, main adds 0001_theirs, and `git merge main` has stopped."""
    repo = tmp_path / "repo"
    (repo / "scripts").mkdir(parents=True)
    for name in (
        "db-renumber-migration.sh",
        "migration_statements.py",
        "check_migration_order.py",
    ):
        shutil.copy(SCRIPTS / name, repo / "scripts" / name)
    (repo / "package.json").write_text("{}\n")
    (repo / "app.txt").write_text("app\n")
    write_migrations(repo, [INIT])
    git(repo, "init", "-q", "-b", "main")
    git(repo, "add", "-A")
    git(repo, "commit", "-qm", "initial")

    git(repo, "checkout", "-qb", "feat")
    write_migrations(repo, [INIT, ("0001_mine", 2000, reviewed_sql)])
    if app_conflict:
        (repo / "app.txt").write_text("branch\n")
    git(repo, "add", "-A")
    git(repo, "commit", "-qm", "feature migration")

    git(repo, "checkout", "-q", "main")
    write_migrations(repo, [INIT, THEIRS])
    if app_conflict:
        (repo / "app.txt").write_text("main\n")
    git(repo, "add", "-A")
    git(repo, "commit", "-qm", "main migration")

    git(repo, "checkout", "-q", "feat")
    git(repo, "merge", "-q", "--no-ff", "main", check=False)
    assert (repo / ".git" / "MERGE_HEAD").exists()
    return repo


def run_script(
    repo: Path, tmp_path: Path, generated: str
) -> subprocess.CompletedProcess:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir(exist_ok=True)
    pnpm = bin_dir / "pnpm"
    pnpm.write_text(FAKE_PNPM)
    pnpm.chmod(0o755)
    fake_generated = tmp_path / "generated.sql"
    fake_generated.write_text(generated)
    return subprocess.run(
        ["bash", "scripts/db-renumber-migration.sh"],
        cwd=repo,
        capture_output=True,
        text=True,
        env={
            **os.environ,
            **GIT_ENV,
            "PATH": f"{bin_dir}{os.pathsep}{os.environ['PATH']}",
            "FAKE_GENERATED": str(fake_generated),
        },
        check=False,
    )


def test_renumbers_and_keeps_reviewed_sql_byte_for_byte(tmp_path: Path):
    repo = mid_merge_repo(tmp_path)
    result = run_script(repo, tmp_path, GENERATED)

    assert result.returncode == 0, result.stderr
    assert "Renumbered 0001_mine -> 0002_mine" in result.stdout
    assert 'UPDATE "a" SET "note" = \'x\';' in result.stdout
    staged = git(
        repo, "diff", "--cached", "-M", "--name-status", "--", "drizzle"
    ).stdout
    assert "R100\tdrizzle/0001_mine.sql\tdrizzle/0002_mine.sql" in staged
    assert (repo / "drizzle" / "0002_mine.sql").read_text() == REVIEWED
    tags = [
        e["tag"]
        for e in json.loads((repo / "drizzle/meta/_journal.json").read_text())[
            "entries"
        ]
    ]
    assert tags == ["0000_init", "0001_theirs", "0002_mine"]
    git(repo, "commit", "-q", "--no-edit")
    assert git(repo, "rev-list", "--merges", "-n1", "HEAD").stdout.strip()


def test_stops_on_extra_generated_statements_and_leaves_merge_abortable(
    tmp_path: Path,
):
    repo = mid_merge_repo(tmp_path)
    drift = GENERATED + '--> statement-breakpoint\nALTER TABLE "b" DROP COLUMN "x";'
    result = run_script(repo, tmp_path, drift)

    assert result.returncode == 1
    assert 'ALTER TABLE "b" DROP COLUMN "x";' in result.stderr
    assert "git merge --abort" in result.stderr
    assert git(repo, "merge", "--abort", check=False).returncode == 0
    assert git(repo, "status", "--porcelain").stdout == ""


def test_custom_fallback_when_drizzle_generates_nothing(tmp_path: Path):
    hand_written = 'UPDATE "a" SET "id" = 1;\n'
    repo = mid_merge_repo(tmp_path, reviewed_sql=hand_written)
    result = run_script(repo, tmp_path, "")

    assert result.returncode == 0, result.stderr
    assert (repo / "drizzle" / "0002_mine.sql").read_text() == hand_written


def test_refuses_while_a_conflict_outside_drizzle_is_unresolved(tmp_path: Path):
    repo = mid_merge_repo(tmp_path, app_conflict=True)
    result = run_script(repo, tmp_path, GENERATED)

    assert result.returncode == 1
    assert "resolve and stage these conflicts first" in result.stderr
    assert "app.txt" in result.stderr
    # drizzle/ is untouched: the journal conflict is still there.
    unmerged = git(repo, "diff", "--name-only", "--diff-filter=U").stdout
    assert "drizzle/meta/_journal.json" in unmerged


def test_refuses_without_a_merge_in_progress(tmp_path: Path):
    repo = mid_merge_repo(tmp_path)
    git(repo, "merge", "--abort")
    result = run_script(repo, tmp_path, GENERATED)

    assert result.returncode == 1
    assert "no merge in progress" in result.stderr

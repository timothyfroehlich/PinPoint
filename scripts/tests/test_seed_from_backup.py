"""Tests for the backup auto-discovery block in scripts/seed-from-backup.sh.

The regression under test (PP-euhg): discovery used `find -printf '%T@ %p\\n'`,
a GNU findutils extension. On macOS's BSD find the flag is an error, the
`2>/dev/null` swallowed it, and the empty result was reported as **"No backup
files found"** — so the script blamed the directory for a failure in its own
lookup, and `pnpm run db:seed:from-prod` with no argument was dead on the
primary dev machine while looking merely unlucky.

Discovery now globs `pinpoint_prod_<YYYYmmdd_HHMMSS>.sql` and takes the greatest
name. Because those names sort lexicographically in timestamp order, that needs
no `stat()` and no `find(1)` extension, so GNU and BSD userlands agree without
branching on OS.

Two tests carry the weight:

- `test_selects_newest_by_filename_not_mtime` fails on Linux if anyone reinstates
  an mtime-ordered lookup (`find -printf '%T@'`, `ls -t`, `stat`), which is the
  only class of change that could reintroduce the macOS-only break.
- `test_ignores_names_without_a_timestamp` pins the precondition that makes
  name-ordering valid at all: the glob must match only the timestamped shape.

The rest pin the four now-distinct failure reports.

Every test answers "n" at the confirmation prompt, so the script aborts before
it can reach a database, and runs with cwd set to a scratch dir so the
`.env.local` lookup could not find a real connection string even if it did.
"""

import os
import subprocess
from pathlib import Path

import pytest

SCRIPT_PATH = Path(__file__).parent.parent / "seed-from-backup.sh"


def run_discovery(
    home: Path, cwd: Path, *args: str
) -> subprocess.CompletedProcess[str]:
    """Run the script with $HOME pointed at a scratch dir, declining the prompt."""
    env = dict(os.environ, HOME=str(home))
    return subprocess.run(
        ["bash", str(SCRIPT_PATH), *args],
        input="n\n",
        capture_output=True,
        text=True,
        env=env,
        cwd=str(cwd),
        timeout=30,
    )


def make_backup_dir(home: Path) -> Path:
    backup_dir = home / ".pinpoint" / "db-backups"
    backup_dir.mkdir(parents=True)
    return backup_dir


def test_reports_missing_directory_distinctly(tmp_path: Path) -> None:
    """A directory that does not exist is its own diagnosis, not 'no backups'."""
    home = tmp_path / "home"
    home.mkdir()

    result = run_discovery(home, tmp_path)

    assert result.returncode == 1
    assert "Backup directory does not exist" in result.stdout
    assert "No backup files found" not in result.stdout


def test_reports_empty_directory_as_empty(tmp_path: Path) -> None:
    """A readable directory holding no dumps really is empty — say so."""
    home = tmp_path / "home"
    home.mkdir()
    backup_dir = make_backup_dir(home)
    (backup_dir / "notes.txt").write_text("not a dump")

    result = run_discovery(home, tmp_path)

    assert result.returncode == 1
    assert "No backup files found" in result.stdout
    assert "lookup failed" not in result.stdout


@pytest.mark.skipif(
    os.geteuid() == 0, reason="root ignores directory permissions, so the glob succeeds"
)
def test_unlistable_directory_is_a_lookup_failure_not_emptiness(tmp_path: Path) -> None:
    """The PP-euhg failure mode in its remaining form: the glob comes back empty
    because the lookup could not run, and that must not read as 'no backups'."""
    home = tmp_path / "home"
    home.mkdir()
    backup_dir = make_backup_dir(home)
    (backup_dir / "pinpoint_prod_20260101_000000.sql").write_text("")
    backup_dir.chmod(0o000)
    try:
        result = run_discovery(home, tmp_path)
    finally:
        backup_dir.chmod(0o755)

    assert result.returncode == 1
    assert "Backup lookup failed" in result.stdout
    assert "No backup files found" not in result.stdout


def test_selects_newest_by_filename_not_mtime(tmp_path: Path) -> None:
    """Newest == greatest filename. mtimes are set to contradict the names, so an
    mtime-ordered lookup (find -printf / ls -t / stat) picks a different file."""
    home = tmp_path / "home"
    home.mkdir()
    backup_dir = make_backup_dir(home)

    # Name order: 20260101 < 20260615 < 20260731. mtime order is the reverse, so
    # mtime-newest is 20260101 — the file a stat-based lookup would choose.
    names_oldest_first = [
        "pinpoint_prod_20260101_010101.sql",
        "pinpoint_prod_20260615_120000.sql",
        "pinpoint_prod_20260731_235959.sql",
    ]
    for index, name in enumerate(reversed(names_oldest_first)):
        path = backup_dir / name
        path.write_text("")
        os.utime(path, (1_700_000_000 + index * 60, 1_700_000_000 + index * 60))

    result = run_discovery(home, tmp_path)

    assert "Found 3 backup(s)" in result.stdout
    assert str(backup_dir / "pinpoint_prod_20260731_235959.sql") in result.stdout
    assert "pinpoint_prod_20260101_010101.sql" not in result.stdout


def test_ignores_names_without_a_timestamp(tmp_path: Path) -> None:
    """'Greatest name == newest' only holds for the timestamped shape, so the
    glob must not match hand-named dumps. `pinpoint_prod_manual.sql` sorts above
    every timestamp and would otherwise hijack the selection."""
    home = tmp_path / "home"
    home.mkdir()
    backup_dir = make_backup_dir(home)
    (backup_dir / "pinpoint_prod_20260102_000000.sql").write_text("")
    (backup_dir / "pinpoint_prod_manual.sql").write_text("")
    (backup_dir / "pinpoint_prod_20260103.sql").write_text("")  # date, no time

    result = run_discovery(home, tmp_path)

    assert "Found 1 backup(s)" in result.stdout
    assert str(backup_dir / "pinpoint_prod_20260102_000000.sql") in result.stdout
    assert "pinpoint_prod_manual.sql" not in result.stdout


def test_handles_a_home_directory_containing_a_space(tmp_path: Path) -> None:
    """macOS home directories are routinely `/Users/First Last`. The array/glob
    path must carry that through without word-splitting the resolved path."""
    home = tmp_path / "Some User"
    home.mkdir()
    backup_dir = make_backup_dir(home)
    (backup_dir / "pinpoint_prod_20260101_000000.sql").write_text("")
    (backup_dir / "pinpoint_prod_20260102_000000.sql").write_text("")

    result = run_discovery(home, tmp_path)

    assert "Found 2 backup(s)" in result.stdout
    assert str(backup_dir / "pinpoint_prod_20260102_000000.sql") in result.stdout


def test_reports_a_non_directory_path_accurately(tmp_path: Path) -> None:
    """A regular file sitting at the backup path is not a missing directory, and
    'run db:backup to create one' would be bad advice — that would fail too."""
    home = tmp_path / "home"
    (home / ".pinpoint").mkdir(parents=True)
    (home / ".pinpoint" / "db-backups").write_text("not a directory")

    result = run_discovery(home, tmp_path)

    assert result.returncode == 1
    assert "exists but is not a directory" in result.stdout
    assert "does not exist" not in result.stdout


def test_explicit_argument_skips_discovery(tmp_path: Path) -> None:
    """An explicit path is still honoured, and does not consult $HOME at all."""
    home = tmp_path / "home"
    home.mkdir()  # deliberately no backup dir
    explicit = tmp_path / "elsewhere.sql"
    explicit.write_text("")

    result = run_discovery(home, tmp_path, str(explicit))

    assert "No backup file specified" not in result.stdout
    assert str(explicit) in result.stdout

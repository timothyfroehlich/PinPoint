"""Unit tests for the multi-machine helpers in scripts/hooks/huddle-lib.sh.

Covers huddle_sync (throttled, per-machine Dolt push+pull), huddle_discover_root
(fork-proof root discovery), and huddle_reconcile_today (cross-machine duplicate
daily dedup). Each test builds a throwaway git repo (so huddle_state_dir resolves
to <repo>/.agents/huddle), stubs `bd` on PATH to record its invocations and emit
canned JSON, then sources the lib and calls the function under test.
"""

import json
import os
import stat
import subprocess
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest

LIB_PATH = Path(__file__).parent.parent / "hooks" / "huddle-lib.sh"
TODAY = "2026-07-06"

# Stub `bd`: append the full arg list to $BD_LOG, and for read subcommands emit
# the JSON in the file named by the matching env var. Everything else exits 0.
BD_STUB = r"""#!/usr/bin/env bash
printf '%s\n' "$*" >> "$BD_LOG"
case "$1 $2" in
  "dolt push") exit "${BD_PUSH_RC:-0}" ;;
  "dolt pull") exit "${BD_PULL_RC:-0}" ;;
esac
case "$1" in
  list)     [[ -n "${BD_LIST_JSON:-}" ]]     && cat "$BD_LIST_JSON";     exit 0 ;;
  children) [[ -n "${BD_CHILDREN_JSON:-}" ]] && cat "$BD_CHILDREN_JSON"; exit 0 ;;
  show)     [[ -n "${BD_SHOW_JSON:-}" ]]     && cat "$BD_SHOW_JSON";     exit 0 ;;
esac
exit 0
"""


@pytest.fixture
def repo() -> Iterator[Path]:
    """A temp git repo with .agents/huddle/config.json and a stub bd on PATH."""
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        subprocess.run(["git", "init", "-q"], cwd=root, check=True)
        huddle = root / ".agents" / "huddle"
        huddle.mkdir(parents=True)
        (huddle / "config.json").write_text(
            json.dumps({"schema_version": 1, "root_bead_id": "PP-lt12"})
        )
        bindir = root / "bin"
        bindir.mkdir()
        bd = bindir / "bd"
        bd.write_text(BD_STUB)
        bd.chmod(bd.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
        yield root


def run_fn(
    repo: Path, call: str, env_extra: dict[str, str] | None = None
) -> tuple[int, str, str, str]:
    """Source the lib and run `call`. Returns (rc, stdout, stderr, bd_log)."""
    log = repo / "bd.log"
    env = os.environ.copy()
    env["PATH"] = f"{repo / 'bin'}{os.pathsep}{env['PATH']}"
    env["BD_LOG"] = str(log)
    if env_extra:
        env.update(env_extra)
    proc = subprocess.run(
        ["bash", "-c", f"source '{LIB_PATH}'; {call}"],
        cwd=repo,
        env=env,
        capture_output=True,
        text=True,
    )
    bd_log = log.read_text() if log.exists() else ""
    return proc.returncode, proc.stdout, proc.stderr, bd_log


# --- huddle_sync -----------------------------------------------------------


def test_sync_fires_when_marker_missing(repo: Path) -> None:
    rc, _out, _err, log = run_fn(repo, "huddle_sync")
    assert rc == 0
    assert "dolt push" in log
    assert "dolt pull" in log
    # Marker written so the next call within the interval is throttled.
    assert (repo / ".agents" / "huddle" / "last-pull").exists()


def test_sync_throttled_when_marker_fresh(repo: Path) -> None:
    marker = repo / ".agents" / "huddle" / "last-pull"
    # Fresh marker (now) → within the default 180s window → skip entirely.
    rc, _out, _err, log = run_fn(
        repo, "printf '%s' \"$(date +%s)\" > '.agents/huddle/last-pull'; huddle_sync"
    )
    assert rc == 0
    assert "dolt" not in log
    assert marker.exists()


def test_sync_fires_when_marker_stale(repo: Path) -> None:
    # Marker far in the past → past the window → sync.
    rc, _out, _err, log = run_fn(
        repo, "printf '1' > '.agents/huddle/last-pull'; huddle_sync"
    )
    assert rc == 0
    assert "dolt push" in log and "dolt pull" in log


def test_sync_custom_interval_zero_always_fires(repo: Path) -> None:
    rc, _out, _err, log = run_fn(
        repo,
        "printf '%s' \"$(date +%s)\" > '.agents/huddle/last-pull'; huddle_sync",
        {"HUDDLE_SYNC_SECONDS": "0"},
    )
    assert rc == 0
    # Interval 0 → even a just-written marker is not "fresh" → sync fires.
    assert "dolt push" in log


def test_sync_fail_open_when_push_and_pull_error(repo: Path) -> None:
    # Offline simulation: push/pull exit non-zero. huddle_sync must still
    # return 0 (never block a hook) and still write the throttle marker.
    rc, _out, _err, log = run_fn(
        repo, "huddle_sync", {"BD_PUSH_RC": "1", "BD_PULL_RC": "1"}
    )
    assert rc == 0
    assert "dolt push" in log  # it tried
    assert (repo / ".agents" / "huddle" / "last-pull").exists()


# --- huddle_discover_root --------------------------------------------------


def test_discover_root_finds_existing(repo: Path) -> None:
    epics = repo / "epics.json"
    epics.write_text(
        json.dumps(
            [
                {"id": "PP-zz", "title": "Some other epic", "status": "open"},
                {
                    "id": "PP-lt12",
                    "title": "Huddle coordination root",
                    "status": "open",
                },
            ]
        )
    )
    rc, out, _err, _log = run_fn(
        repo, "huddle_discover_root", {"BD_LIST_JSON": str(epics)}
    )
    assert rc == 0
    assert out.strip() == "PP-lt12"


def test_discover_root_lowest_id_wins(repo: Path) -> None:
    epics = repo / "epics.json"
    epics.write_text(
        json.dumps(
            [
                {
                    "id": "PP-lt99",
                    "title": "Huddle coordination root",
                    "status": "open",
                },
                {
                    "id": "PP-lt12",
                    "title": "Huddle coordination root",
                    "status": "open",
                },
            ]
        )
    )
    rc, out, _err, _log = run_fn(
        repo, "huddle_discover_root", {"BD_LIST_JSON": str(epics)}
    )
    assert rc == 0
    assert out.strip() == "PP-lt12"


def test_discover_root_none_returns_nonzero(repo: Path) -> None:
    epics = repo / "epics.json"
    epics.write_text(json.dumps([{"id": "PP-zz", "title": "Other", "status": "open"}]))
    rc, out, _err, _log = run_fn(
        repo, "huddle_discover_root", {"BD_LIST_JSON": str(epics)}
    )
    assert rc != 0
    assert out.strip() == ""


# --- huddle_reconcile_today ------------------------------------------------


def _root_show(today_id: str) -> str:
    notes = {
        "schema_version": 1,
        "today_bead": {"id": today_id, "date": TODAY},
        "monthly_bead": {"id": "PP-m", "month": "2026-07"},
        "recent_dailies": [{"id": today_id, "date": TODAY}],
        "settings": {},
        "last_rotation": "2026-07-06T00:00:00Z",
    }
    return json.dumps([{"id": "PP-lt12", "notes": json.dumps(notes)}])


def test_reconcile_collapses_duplicate_dailies(repo: Path) -> None:
    show = repo / "show.json"
    show.write_text(_root_show("PP-lt12.99"))  # notes point at the HIGHER id
    children = repo / "children.json"
    children.write_text(
        json.dumps(
            [
                {
                    "id": "PP-lt12.99",
                    "title": f"Huddle daily {TODAY}",
                    "status": "open",
                },
                {
                    "id": "PP-lt12.40",
                    "title": f"Huddle daily {TODAY}",
                    "status": "open",
                },
            ]
        )
    )
    rc, _out, _err, log = run_fn(
        repo,
        "huddle_reconcile_today",
        {"BD_SHOW_JSON": str(show), "BD_CHILDREN_JSON": str(children)},
    )
    assert rc == 0
    # Canonical = lowest id (PP-lt12.40). The higher-id dup is closed...
    assert "close PP-lt12.99" in log
    assert "close PP-lt12.40" not in log
    # ...and root notes are re-pointed at the canonical, then pushed.
    assert "update PP-lt12 --notes" in log
    assert "dolt push" in log


def test_reconcile_noop_when_single_daily(repo: Path) -> None:
    show = repo / "show.json"
    show.write_text(_root_show("PP-lt12.40"))
    children = repo / "children.json"
    children.write_text(
        json.dumps(
            [{"id": "PP-lt12.40", "title": f"Huddle daily {TODAY}", "status": "open"}]
        )
    )
    rc, _out, _err, log = run_fn(
        repo,
        "huddle_reconcile_today",
        {"BD_SHOW_JSON": str(show), "BD_CHILDREN_JSON": str(children)},
    )
    assert rc == 0
    # No writes at all in the common case.
    assert "close" not in log
    assert "update" not in log
    assert "dolt push" not in log

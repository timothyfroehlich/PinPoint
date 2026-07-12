"""Unit tests for the SessionStart weekly-chores nag hook.

The hook (`.claude/hooks/session-start-chores-nag.sh`) looks up the recurring
"Weekly Chores" bead BY LABEL via `bd list --label weekly-chore --json`, reads
its `defer_until`, and injects a one-line nudge when that date has passed.

These tests mock `bd` with a fake executable on PATH (same technique as
test_worktree_create_hook.py mocks git) so no real beads DB is touched.
"""

import datetime
import json
import os
import subprocess
from pathlib import Path

import pytest

HOOK_PATH = (
    Path(__file__).parent.parent.parent / ".claude/hooks/session-start-chores-nag.sh"
)


def _iso(dt: datetime.datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


@pytest.fixture
def mock_bd(tmp_path: Path):
    """Install a fake `bd` on PATH that prints a canned JSON array.

    Returns a helper that writes the desired `bd list ... --json` payload.
    """
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    payload_file = tmp_path / "bd_payload.json"

    bd_script = bin_dir / "bd"
    # The hook only ever calls `bd list --label weekly-chore --json`; the fake
    # ignores its args and echoes the payload file (or exits non-zero to
    # simulate a bd failure when the payload file is absent).
    bd_script.write_text(
        f"""#!/usr/bin/env bash
if [[ -f "{payload_file}" ]]; then
  cat "{payload_file}"
  exit 0
fi
exit 1
"""
    )
    bd_script.chmod(0o755)

    def set_beads(beads) -> None:
        payload_file.write_text(json.dumps(beads))

    return {"bin_dir": bin_dir, "set_beads": set_beads, "payload_file": payload_file}


def run_hook(stdin_data: dict, mock_bd: dict, tmp_path: Path) -> tuple[int, str, str]:
    env = os.environ.copy()
    fake_home = tmp_path / "fake_home"
    fake_home.mkdir(parents=True, exist_ok=True)
    env["HOME"] = str(fake_home)
    env["XDG_CONFIG_HOME"] = str(fake_home / ".config")
    # Fake bd wins over any real bd on PATH.
    env["PATH"] = f"{mock_bd['bin_dir']}:{env['PATH']}"

    process = subprocess.Popen(
        ["bash", str(HOOK_PATH)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        text=True,
    )
    stdout, stderr = process.communicate(input=json.dumps(stdin_data))
    return process.returncode, stdout, stderr


def _chore_bead(**overrides) -> dict:
    bead = {
        "id": "PP-test",
        "title": "Weekly Chores",
        "status": "deferred",
        "defer_until": _iso(_now() - datetime.timedelta(days=3)),
    }
    bead.update(overrides)
    return bead


STDIN = {"transcript_path": "/x/y/transcript.jsonl", "hook_event_name": "SessionStart"}


def test_overdue_emits_nag(mock_bd: dict, tmp_path: Path) -> None:
    # 3 days + a margin so floor lands firmly on 3 (not slop-sensitive).
    mock_bd["set_beads"](
        [_chore_bead(defer_until=_iso(_now() - datetime.timedelta(days=3, hours=2)))]
    )
    rc, out, err = run_hook(STDIN, mock_bd, tmp_path)
    assert rc == 0, err
    assert "🧹" in out
    assert "3 days overdue" in out
    assert 'say "let\'s do chores"' in out


def test_overdue_one_day_is_singular(mock_bd: dict, tmp_path: Path) -> None:
    # ~1 day + 5h overdue → floor 1 → singular "1 day".
    mock_bd["set_beads"](
        [_chore_bead(defer_until=_iso(_now() - datetime.timedelta(days=1, hours=5)))]
    )
    rc, out, err = run_hook(STDIN, mock_bd, tmp_path)
    assert rc == 0, err
    assert "1 day overdue" in out
    assert "1 days" not in out


def test_due_today_when_less_than_a_day_over(mock_bd: dict, tmp_path: Path) -> None:
    # Passed the defer date but < 1 full day → "due today", not "0 days overdue".
    mock_bd["set_beads"](
        [_chore_bead(defer_until=_iso(_now() - datetime.timedelta(hours=6)))]
    )
    rc, out, err = run_hook(STDIN, mock_bd, tmp_path)
    assert rc == 0, err
    assert "due today" in out
    assert "overdue" not in out


def test_dormant_future_defer_is_silent(mock_bd: dict, tmp_path: Path) -> None:
    mock_bd["set_beads"](
        [_chore_bead(defer_until=_iso(_now() + datetime.timedelta(days=4)))]
    )
    rc, out, err = run_hook(STDIN, mock_bd, tmp_path)
    assert rc == 0, err
    assert out.strip() == ""


def test_no_defer_until_is_silent(mock_bd: dict, tmp_path: Path) -> None:
    # Freshly created / actively being worked → not armed → no nag.
    bead = _chore_bead(status="open")
    bead.pop("defer_until")
    mock_bd["set_beads"]([bead])
    rc, out, err = run_hook(STDIN, mock_bd, tmp_path)
    assert rc == 0, err
    assert out.strip() == ""


def test_closed_bead_is_silent(mock_bd: dict, tmp_path: Path) -> None:
    mock_bd["set_beads"]([_chore_bead(status="closed")])
    rc, out, err = run_hook(STDIN, mock_bd, tmp_path)
    assert rc == 0, err
    assert out.strip() == ""


def test_no_chore_bead_is_silent(mock_bd: dict, tmp_path: Path) -> None:
    mock_bd["set_beads"]([])
    rc, out, err = run_hook(STDIN, mock_bd, tmp_path)
    assert rc == 0, err
    assert out.strip() == ""


def test_subagent_session_is_silent(mock_bd: dict, tmp_path: Path) -> None:
    mock_bd["set_beads"]([_chore_bead()])  # overdue, but subagent → suppressed
    stdin = {"transcript_path": "/x/subagents/z.jsonl"}
    rc, out, err = run_hook(stdin, mock_bd, tmp_path)
    assert rc == 0, err
    assert out.strip() == ""


def test_bd_failure_fails_open(mock_bd: dict, tmp_path: Path) -> None:
    # No payload file → fake bd exits non-zero → hook must fail open, exit 0, silent.
    mock_bd["payload_file"].unlink(missing_ok=True)
    rc, out, err = run_hook(STDIN, mock_bd, tmp_path)
    assert rc == 0
    assert out.strip() == ""


def test_malformed_json_fails_open(mock_bd: dict, tmp_path: Path) -> None:
    mock_bd["payload_file"].write_text("not valid json")
    rc, out, err = run_hook(STDIN, mock_bd, tmp_path)
    assert rc == 0
    assert out.strip() == ""

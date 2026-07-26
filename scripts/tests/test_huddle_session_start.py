"""Unit tests for scripts/hooks/huddle-session-start.sh.

Regression guard for PP-2m3l: the rotation-needed branch used to `exit 0` right
after printing its notice, which made the identity / registration block below it
unreachable. SessionStart fires exactly once per session, so every session that
started on a new day *before* rotation ran never learned its session_id and never
registered — breaking the huddle self-filter (a session saw its own posts injected
back as if from a peer) and degrading post attribution.

Rotation and registration are independent concerns: a session start with rotation
pending must emit BOTH blocks.

Each test builds a throwaway git repo (so huddle_state_dir resolves to
<repo>/.agents/huddle), stubs `bd` on PATH to serve canned JSON per bead id, pipes
a SessionStart payload on stdin, and asserts on the hook's stdout.
"""

import datetime
import json
import os
import stat
import subprocess
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest

HOOK_PATH = Path(__file__).parent.parent / "hooks" / "huddle-session-start.sh"
ROOT_ID = "PP-lt12"
TODAY_DAILY_ID = "PP-lt12.38"
YESTERDAY_DAILY_ID = "PP-lt12.37"
MONTHLY_ID = "PP-lt12.34"
SESSION_ID = "11111111-2222-3333-4444-555555555555"

TODAY = datetime.date.today().isoformat()
YESTERDAY = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
THIS_MONTH = datetime.date.today().strftime("%Y-%m")

# Stub `bd`: log every invocation, serve `bd show <id>` from
# $BD_SHOW_DIR/<id>.json (exit 1 when absent, matching bd's behaviour for an
# unknown id) and `bd children` from $BD_CHILDREN_JSON. Everything else exits 0.
BD_STUB = r"""#!/usr/bin/env bash
printf '%s\n' "$*" >> "$BD_LOG"
case "$1" in
  show)
    f="${BD_SHOW_DIR:-}/$2.json"
    if [[ -f "$f" ]]; then cat "$f"; exit 0; fi
    exit 1
    ;;
  children)
    [[ -n "${BD_CHILDREN_JSON:-}" ]] && cat "$BD_CHILDREN_JSON"
    exit 0
    ;;
esac
exit 0
"""


def _bead(bead_id: str, title: str, **extra: object) -> list[dict[str, object]]:
    """A `bd show --json` payload: a single-element array."""
    return [{"id": bead_id, "title": title, "status": "open", **extra}]


def _root_notes(today_bead_id: str, today_bead_date: str) -> str:
    """The root bead's `notes` field — itself a stringified JSON blob."""
    return json.dumps(
        {
            "schema_version": 1,
            "today_bead": {"id": today_bead_id, "date": today_bead_date},
            "monthly_bead": {"id": MONTHLY_ID, "month": THIS_MONTH},
            "settings": {"n_dailies_to_inject": 5, "day_boundary_tz": "local"},
        }
    )


@pytest.fixture
def repo() -> Iterator[Path]:
    """A temp git repo with huddle config, a stub bd on PATH, and canned beads.

    Defaults to the *up-to-date* world (root notes point at today's daily). Tests
    that need the rotation-pending world call `set_rotation_pending`.
    """
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        subprocess.run(["git", "init", "-q"], cwd=root, check=True)

        huddle = root / ".agents" / "huddle"
        huddle.mkdir(parents=True)
        (huddle / "config.json").write_text(
            json.dumps({"schema_version": 1, "root_bead_id": ROOT_ID})
        )

        # Server mode: makes huddle_sync a no-op so no test touches the network.
        beads = root / ".beads"
        beads.mkdir()
        (beads / "metadata.json").write_text(
            json.dumps({"database": "dolt", "backend": "dolt", "dolt_mode": "server"})
        )

        bindir = root / "bin"
        bindir.mkdir()
        bd = bindir / "bd"
        bd.write_text(BD_STUB)
        bd.chmod(bd.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)

        shows = root / "shows"
        shows.mkdir()
        _write_up_to_date_beads(root)
        yield root


def _write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload))


def _write_up_to_date_beads(repo: Path) -> None:
    shows = repo / "shows"
    _write_json(
        shows / f"{ROOT_ID}.json",
        _bead(
            ROOT_ID,
            "Huddle coordination root",
            notes=_root_notes(TODAY_DAILY_ID, TODAY),
        ),
    )
    _write_json(
        shows / f"{TODAY_DAILY_ID}.json",
        _bead(TODAY_DAILY_ID, f"Huddle daily {TODAY}", description="Today so far."),
    )
    _write_json(
        shows / f"{MONTHLY_ID}.json",
        _bead(MONTHLY_ID, f"Huddle monthly {THIS_MONTH}", description="Month so far."),
    )
    _write_json(
        repo / "children.json",
        [{"id": TODAY_DAILY_ID, "title": f"Huddle daily {TODAY}", "status": "open"}],
    )


def set_rotation_pending(repo: Path) -> None:
    """Rewrite the canned beads so the root still points at yesterday's daily."""
    shows = repo / "shows"
    _write_json(
        shows / f"{ROOT_ID}.json",
        _bead(
            ROOT_ID,
            "Huddle coordination root",
            notes=_root_notes(YESTERDAY_DAILY_ID, YESTERDAY),
        ),
    )
    (shows / f"{TODAY_DAILY_ID}.json").unlink()
    _write_json(
        shows / f"{YESTERDAY_DAILY_ID}.json",
        _bead(
            YESTERDAY_DAILY_ID,
            f"Huddle daily {YESTERDAY}",
            description="Yesterday's digest.",
        ),
    )
    _write_json(
        repo / "children.json",
        [
            {
                "id": YESTERDAY_DAILY_ID,
                "title": f"Huddle daily {YESTERDAY}",
                "status": "open",
            }
        ],
    )


def register(repo: Path, name: str, session_id: str = SESSION_ID) -> None:
    (repo / ".agents" / "huddle" / "session-names.json").write_text(
        json.dumps({session_id: name})
    )


def run_hook(
    repo: Path,
    session_id: str = SESSION_ID,
    source: str = "startup",
    transcript_path: str = "/tmp/transcripts/abc.jsonl",
) -> tuple[int, str, str]:
    """Run the hook with a SessionStart payload on stdin. Returns (rc, out, err)."""
    env = os.environ.copy()
    env["PATH"] = f"{repo / 'bin'}{os.pathsep}{env['PATH']}"
    env["BD_LOG"] = str(repo / "bd.log")
    env["BD_SHOW_DIR"] = str(repo / "shows")
    env["BD_CHILDREN_JSON"] = str(repo / "children.json")
    payload = json.dumps(
        {
            "session_id": session_id,
            "transcript_path": transcript_path,
            "cwd": str(repo),
            "hook_event_name": "SessionStart",
            "source": source,
        }
    )
    proc = subprocess.run(
        ["bash", str(HOOK_PATH)],
        cwd=repo,
        env=env,
        input=payload,
        capture_output=True,
        text=True,
    )
    return proc.returncode, proc.stdout, proc.stderr


ROTATION_MARKER = "Huddle rotation needed"
REGISTRATION_MARKER = "Huddle identity — registration needed"
IDENTITY_MARKER = "## Huddle identity"


# --- PP-2m3l: rotation must not short-circuit registration ------------------


def test_rotation_pending_emits_both_notice_and_registration_block(
    repo: Path,
) -> None:
    set_rotation_pending(repo)
    rc, out, err = run_hook(repo)
    assert rc == 0, err
    assert ROTATION_MARKER in out
    assert REGISTRATION_MARKER in out
    assert SESSION_ID in out
    # The registration block must carry the copy-paste register command.
    assert f"huddle-whoami.sh register <YourName> {SESSION_ID}" in out
    # Ordering: the rotation notice stays first so it reads as the urgent item.
    assert out.index(ROTATION_MARKER) < out.index(REGISTRATION_MARKER)


def test_rotation_pending_emits_identity_block_for_registered_session(
    repo: Path,
) -> None:
    set_rotation_pending(repo)
    register(repo, "Claude-DoctorAudit")
    rc, out, err = run_hook(repo)
    assert rc == 0, err
    assert ROTATION_MARKER in out
    assert "Registered as: **Claude-DoctorAudit**" in out
    assert REGISTRATION_MARKER not in out
    # Today's daily does not exist yet, so the kickoff command must fall back to
    # the placeholder rather than pointing at yesterday's (stale) bead.
    assert "<today-bead-id>" in out
    assert YESTERDAY_DAILY_ID not in out.split("## Huddle recent activity")[0]


def test_rotation_pending_still_injects_recent_activity(repo: Path) -> None:
    # Falling through means the recent-activity digest is emitted too — the
    # session gets yesterday's context instead of a bare rotation nag.
    set_rotation_pending(repo)
    rc, out, err = run_hook(repo)
    assert rc == 0, err
    assert "## Huddle recent activity" in out
    assert "Yesterday's digest." in out


# --- Unchanged behaviour on the up-to-date path -----------------------------


def test_no_rotation_emits_registration_block_only(repo: Path) -> None:
    rc, out, err = run_hook(repo)
    assert rc == 0, err
    assert ROTATION_MARKER not in out
    assert REGISTRATION_MARKER in out
    assert SESSION_ID in out


def test_no_rotation_emits_identity_block_for_registered_session(
    repo: Path,
) -> None:
    register(repo, "Claude-HuddleFix")
    rc, out, err = run_hook(repo)
    assert rc == 0, err
    assert ROTATION_MARKER not in out
    assert "Registered as: **Claude-HuddleFix**" in out
    # Today's daily resolves, so the kickoff command names it.
    assert TODAY_DAILY_ID in out
    assert "## Huddle recent activity" in out


# --- Early-exit paths must keep short-circuiting -----------------------------


def test_compact_suppresses_identity_but_keeps_rotation_notice(repo: Path) -> None:
    # The agent already saw its identity pre-compaction; rotation is still news.
    set_rotation_pending(repo)
    rc, out, err = run_hook(repo, source="compact")
    assert rc == 0, err
    assert ROTATION_MARKER in out
    assert IDENTITY_MARKER not in out


def test_subagent_transcript_emits_nothing(repo: Path) -> None:
    set_rotation_pending(repo)
    rc, out, err = run_hook(
        repo, transcript_path="/tmp/transcripts/subagents/abc.jsonl"
    )
    assert rc == 0, err
    assert out == ""

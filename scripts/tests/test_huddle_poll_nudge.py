"""Unit tests for the quiet-session nudge in scripts/hooks/huddle-poll.sh (PP-llkj).

The huddle's real failure mode isn't sessions that never introduce themselves —
it's sessions that post a kickoff and then go silent while the work changes
shape: scope gets added mid-session, direction changes, a "quick fix" grows a
migration, and peers keep coordinating against a stale plan. The nudge exists to
catch that, so the properties under test are the ones that decide whether it is
useful or merely annoying:

  - a session that just opened is never nagged (it hasn't had a chance yet)
  - a session that posted recently is never nagged (the channel is current)
  - a quiet session is nagged once per window, not once per turn
  - the nag names *added scope* explicitly, since that's what goes unsaid
  - unregistered sessions and HUDDLE_NUDGE_SECONDS=0 opt out entirely

Same harness shape as test_huddle_session_start.py: throwaway git repo, `bd`
stubbed on PATH, hook payload on stdin, assertions on stdout.
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

HOOK_PATH = Path(__file__).parent.parent / "hooks" / "huddle-poll.sh"
ROOT_ID = "PP-lt12"
TODAY_DAILY_ID = "PP-lt12.61"
SESSION_ID = "11111111-2222-3333-4444-555555555555"
AGENT = "Claude-Quiet"

TODAY = datetime.date.today().isoformat()

# Stub `bd`: `show <id>` from $BD_SHOW_DIR/<id>.json, `comments <id>` from
# $BD_COMMENTS_JSON, everything else a silent success.
BD_STUB = r"""#!/usr/bin/env bash
case "$1" in
  show)
    f="${BD_SHOW_DIR:-}/$2.json"
    if [[ -f "$f" ]]; then cat "$f"; exit 0; fi
    exit 1
    ;;
  comments)
    [[ -n "${BD_COMMENTS_JSON:-}" ]] && cat "$BD_COMMENTS_JSON"
    exit 0
    ;;
esac
exit 0
"""

NUDGE_MARKER = "## Huddle: say what you are working on"


def _iso(minutes_ago: int) -> str:
    t = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(
        minutes=minutes_ago
    )
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


@pytest.fixture
def repo() -> Iterator[Path]:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        subprocess.run(["git", "init", "-q"], cwd=root, check=True)

        huddle = root / ".agents" / "huddle"
        huddle.mkdir(parents=True)
        (huddle / "config.json").write_text(
            json.dumps({"schema_version": 1, "root_bead_id": ROOT_ID})
        )
        (huddle / "session-names.json").write_text(json.dumps({SESSION_ID: AGENT}))

        # Server mode keeps huddle_sync a no-op so no test touches the network.
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
        (shows / f"{ROOT_ID}.json").write_text(
            json.dumps(
                [
                    {
                        "id": ROOT_ID,
                        "title": "Huddle coordination root",
                        "status": "open",
                        "notes": json.dumps(
                            {
                                "schema_version": 1,
                                "today_bead": {"id": TODAY_DAILY_ID, "date": TODAY},
                                "monthly_bead": {"id": "PP-lt12.34", "month": "x"},
                                "settings": {"day_boundary_tz": "local"},
                            }
                        ),
                    }
                ]
            )
        )
        set_comments(root, [])
        yield root


def set_comments(repo: Path, comments: list[dict[str, str]]) -> None:
    (repo / "comments.json").write_text(json.dumps(comments))


def post_by(
    agent: str, minutes_ago: int, text: str = "Working on the thing."
) -> dict[str, str]:
    return {
        "author": agent,
        "created_at": _iso(minutes_ago),
        "text": f"{text} —{agent}",
    }


def run_hook(
    repo: Path,
    session_id: str = SESSION_ID,
    nudge_seconds: str | None = None,
) -> tuple[int, str, str]:
    env = os.environ.copy()
    env["PATH"] = f"{repo / 'bin'}{os.pathsep}{env['PATH']}"
    env["BD_SHOW_DIR"] = str(repo / "shows")
    env["BD_COMMENTS_JSON"] = str(repo / "comments.json")
    env["CLAUDE_PROJECT_DIR"] = str(repo)
    env.pop("CLAUDE_AGENT_NAME", None)
    if nudge_seconds is not None:
        env["HUDDLE_NUDGE_SECONDS"] = nudge_seconds
    payload = json.dumps(
        {
            "session_id": session_id,
            "transcript_path": "/tmp/transcripts/abc.jsonl",
            "cwd": str(repo),
            "hook_event_name": "UserPromptSubmit",
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


def age_nudge_marker(repo: Path, seconds: int) -> None:
    """Backdate the per-session nudge clock so the next poll is due."""
    marker = repo / ".agents" / "huddle" / f"nudged-{SESSION_ID}"
    assert marker.exists(), "expected the first poll to have started the clock"
    marker.write_text(str(int(datetime.datetime.now().timestamp()) - seconds))


# --- Silence when silence is correct -----------------------------------------


def test_first_poll_of_a_session_never_nudges(repo: Path) -> None:
    rc, out, err = run_hook(repo)
    assert rc == 0, err
    assert NUDGE_MARKER not in out
    # ...but it does start the clock.
    assert (repo / ".agents" / "huddle" / f"nudged-{SESSION_ID}").exists()


def test_recent_post_by_this_session_suppresses_the_nudge(repo: Path) -> None:
    run_hook(repo)
    age_nudge_marker(repo, 3600)
    set_comments(repo, [post_by(AGENT, minutes_ago=5)])
    rc, out, err = run_hook(repo)
    assert rc == 0, err
    assert NUDGE_MARKER not in out


def test_unregistered_session_is_not_nudged(repo: Path) -> None:
    other = "99999999-8888-7777-6666-555555555555"
    run_hook(repo, session_id=other)
    rc, out, err = run_hook(repo, session_id=other)
    assert rc == 0, err
    assert NUDGE_MARKER not in out


def test_zero_seconds_disables_the_nudge(repo: Path) -> None:
    run_hook(repo)
    age_nudge_marker(repo, 3600)
    rc, out, err = run_hook(repo, nudge_seconds="0")
    assert rc == 0, err
    assert NUDGE_MARKER not in out


# --- Nudging when the session has gone quiet ---------------------------------


def test_quiet_session_that_never_posted_is_asked_for_a_kickoff(repo: Path) -> None:
    run_hook(repo)
    age_nudge_marker(repo, 3600)
    rc, out, err = run_hook(repo)
    assert rc == 0, err
    assert NUDGE_MARKER in out
    assert "has not posted to today" in out
    assert TODAY_DAILY_ID in out
    assert AGENT in out


def test_stale_post_prompts_specifically_about_added_scope(repo: Path) -> None:
    run_hook(repo)
    age_nudge_marker(repo, 3600)
    set_comments(repo, [post_by(AGENT, minutes_ago=180)])
    rc, out, err = run_hook(repo)
    assert rc == 0, err
    assert NUDGE_MARKER in out
    # The whole point: scope that got bolted onto in-flight work is the thing
    # that goes unreported, so the nudge must name it, not just say "update us".
    assert "scope was ADDED" in out
    assert "changed direction" in out


def test_a_peers_post_does_not_count_as_yours(repo: Path) -> None:
    run_hook(repo)
    age_nudge_marker(repo, 3600)
    set_comments(repo, [post_by("Claude-SomeoneElse", minutes_ago=2)])
    rc, out, err = run_hook(repo)
    assert rc == 0, err
    assert NUDGE_MARKER in out
    assert "has not posted to today" in out


def test_nudge_is_rate_limited_to_one_per_window(repo: Path) -> None:
    run_hook(repo)
    age_nudge_marker(repo, 3600)
    _rc, first, _err = run_hook(repo)
    assert NUDGE_MARKER in first
    # Immediately after, still quiet — but the window has reset.
    _rc, second, _err = run_hook(repo)
    assert NUDGE_MARKER not in second

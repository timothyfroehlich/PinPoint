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
import time
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


# Stub `herdr`: serve `herdr workspace list` from $HERDR_STUB_JSON. With
# $HERDR_STUB_HANG set it sleeps instead, standing in for a wedged herdr server
# so the `timeout 1` guard is exercised rather than assumed.
HERDR_STUB = r"""#!/usr/bin/env bash
if [[ -n "${HERDR_STUB_HANG:-}" ]]; then sleep 30; exit 0; fi
[[ -n "${HERDR_STUB_JSON:-}" ]] && cat "$HERDR_STUB_JSON"
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


def stub_herdr(repo: Path, label: str | None, *, hang: bool = False) -> dict[str, str]:
    """Install a `herdr` stub and return the env vars that activate it.

    `label` is the workspace label the stub reports for workspace "wX"; None
    installs a stub that reports a *different* workspace, which is the moved-pane
    / stale-id case. `hang` makes it sleep, for the timeout guard.
    """
    stub = repo / "bin" / "herdr"
    stub.write_text(HERDR_STUB)
    stub.chmod(stub.stat().st_mode | stat.S_IEXEC)
    workspaces = [{"workspace_id": "wOTHER", "label": "somebody else"}]
    if label is not None:
        workspaces.append({"workspace_id": "wX", "label": label})
    payload = repo / "herdr-workspaces.json"
    _write_json(payload, {"result": {"workspaces": workspaces}})
    env = {"HERDR_WORKSPACE_ID": "wX", "HERDR_STUB_JSON": str(payload)}
    if hang:
        env["HERDR_STUB_HANG"] = "1"
    return env


def run_hook_payload(
    repo: Path,
    payload: dict[str, object],
    extra_env: dict[str, str] | None = None,
) -> tuple[int, str, str]:
    """Run the hook with an arbitrary stdin payload. Returns (rc, out, err).

    Takes the payload dict verbatim so a test can omit a key or vary the key
    order — `json.dumps` preserves insertion order, which is what makes the
    "field ordering" cases in PP-txet expressible.
    """
    env = os.environ.copy()
    env["PATH"] = f"{repo / 'bin'}{os.pathsep}{env['PATH']}"
    env["BD_LOG"] = str(repo / "bd.log")
    env["BD_SHOW_DIR"] = str(repo / "shows")
    env["BD_CHILDREN_JSON"] = str(repo / "children.json")
    # Drop the inherited herdr identity. Without this the hook reaches the real
    # herdr server whenever pytest runs from a herdr pane, so the naming block
    # takes the label branch locally and the no-label branch in CI with nothing
    # pinning either — the next assertion anyone adds on that text would pass
    # here and fail in CI. Tests that want the label branch stub `herdr` on PATH
    # and set HERDR_WORKSPACE_ID themselves.
    env.pop("HERDR_WORKSPACE_ID", None)
    env.update(extra_env or {})
    proc = subprocess.run(
        ["bash", str(HOOK_PATH)],
        cwd=repo,
        env=env,
        input=json.dumps(payload),
        capture_output=True,
        text=True,
    )
    return proc.returncode, proc.stdout, proc.stderr


def run_hook(
    repo: Path,
    session_id: str = SESSION_ID,
    source: str = "startup",
    transcript_path: str = "/tmp/transcripts/abc.jsonl",
    extra_env: dict[str, str] | None = None,
) -> tuple[int, str, str]:
    """Run the hook with a well-formed SessionStart payload on stdin."""
    return run_hook_payload(
        repo,
        {
            "session_id": session_id,
            "transcript_path": transcript_path,
            "cwd": str(repo),
            "hook_event_name": "SessionStart",
            "source": source,
        },
        extra_env=extra_env,
    )


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
    # Today's daily does not exist yet, so the kickoff command falls back to the
    # placeholder rather than pointing at yesterday's (stale) bead — and the
    # block must SAY that, so nobody pastes the literal placeholder into bash.
    assert "<today-bead-id>" in out
    assert "rotation is still pending, so today's bead does not exist yet" in out
    assert YESTERDAY_DAILY_ID not in out.split("## Huddle recent activity")[0]
    # The blank line between the rotation notice and the identity heading is
    # load-bearing: without it the notice's last line butts against the heading
    # and the markdown collapses into one paragraph.
    assert "SKILL.md.\n\n## Huddle identity" in out


def test_rotation_pending_still_injects_recent_activity(repo: Path) -> None:
    # Falling through means the recent-activity digest is emitted too — the
    # session gets yesterday's context instead of a bare rotation nag.
    set_rotation_pending(repo)
    rc, out, err = run_hook(repo)
    assert rc == 0, err
    assert "## Huddle recent activity" in out
    assert "Yesterday's digest." in out


def test_rotation_pending_skips_stale_day_reconcile(repo: Path) -> None:
    # huddle_reconcile_today keys off root notes' today_bead.date, which is still
    # YESTERDAY while rotation is pending — so falling through must NOT drag it
    # along. Two open dailies for that stale date are left alone here.
    #
    # They are never collapsed later either: rotation moves the pointer to today,
    # and this net only targets whatever date the pointer names. That gap is
    # pre-existing and out of scope for PP-2m3l — this test pins the skip, not a
    # claim that something else cleans up.
    set_rotation_pending(repo)
    _write_json(
        repo / "children.json",
        [
            {
                "id": YESTERDAY_DAILY_ID,
                "title": f"Huddle daily {YESTERDAY}",
                "status": "open",
            },
            # Sorts ahead of YESTERDAY_DAILY_ID, so an unguarded reconcile would
            # both repoint root notes (bd update) and close the loser (bd close).
            {
                "id": "PP-lt12.10",
                "title": f"Huddle daily {YESTERDAY}",
                "status": "open",
            },
        ],
    )
    rc, out, err = run_hook(repo)
    assert rc == 0, err
    assert ROTATION_MARKER in out
    # Match on the subcommand only — a whole-log substring check would flip on any
    # future bead id or flag that happens to contain "update"/"close".
    subcommands = {
        line.split()[0]
        for line in (repo / "bd.log").read_text().splitlines()
        if line.strip()
    }
    assert "update" not in subcommands
    assert "close" not in subcommands
    assert "comments" not in subcommands


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


# --- PP-llkj: the compact path informs instead of staying silent -------------
#
# Compaction used to emit nothing past the rotation notice, on the theory that
# the agent had already seen its identity. But the compaction summary carries no
# guarantee of retaining the agent's huddle name or today's bead id, and a
# compacted session is the one most likely to go quiet for the rest of its life.
# It now gets a condensed identity + posting reminder (never the full
# registration/etiquette wall) and the work digest.


def test_compact_emits_condensed_identity_not_the_full_block(repo: Path) -> None:
    register(repo, "Claude-HuddleFix")
    rc, out, err = run_hook(repo, source="compact")
    assert rc == 0, err
    assert "## Huddle identity (post-compaction)" in out
    assert "You are **Claude-HuddleFix**" in out
    assert TODAY_DAILY_ID in out
    # The verbose startup-only text stays suppressed.
    assert "Registered as: **Claude-HuddleFix**" not in out
    assert "self-filter active" not in out
    assert "## Huddle recent activity" not in out


def test_compact_prompts_an_unregistered_session_to_register(repo: Path) -> None:
    rc, out, err = run_hook(repo, source="compact")
    assert rc == 0, err
    assert "not registered in the huddle" in out
    assert SESSION_ID in out
    assert REGISTRATION_MARKER not in out


def test_compact_still_emits_the_rotation_notice(repo: Path) -> None:
    set_rotation_pending(repo)
    rc, out, err = run_hook(repo, source="compact")
    assert rc == 0, err
    assert ROTATION_MARKER in out


# --- PP-llkj: work digest ----------------------------------------------------


def _seed_commit(repo: Path, subject: str) -> None:
    """One commit on `main`, so huddle-digest.sh has something to report."""
    subprocess.run(["git", "checkout", "-q", "-b", "main"], cwd=repo, check=False)
    subprocess.run(
        [
            "git",
            "-c",
            "user.email=t@example.com",
            "-c",
            "user.name=T",
            "commit",
            "-q",
            "--allow-empty",
            "-m",
            subject,
        ],
        cwd=repo,
        check=True,
    )


def test_startup_injects_the_work_digest_before_the_dailies(repo: Path) -> None:
    register(repo, "Claude-HuddleFix")
    _seed_commit(repo, "feat(settings): shareable settings sets (#1730)")
    rc, out, err = run_hook(repo)
    assert rc == 0, err
    assert "## What we have been working on (last 7 days)" in out
    assert "shareable settings sets (#1730)" in out
    # Framing order matters: "what are we building" lands before the daily
    # summaries, which read as a list of what recently broke.
    assert out.index("What we have been working on") < out.index(
        "## Huddle recent activity"
    )


def test_compact_injects_the_work_digest(repo: Path) -> None:
    register(repo, "Claude-HuddleFix")
    _seed_commit(repo, "feat(settings): shareable settings sets (#1730)")
    rc, out, err = run_hook(repo, source="compact")
    assert rc == 0, err
    assert "## What we have been working on (last 7 days)" in out
    assert "shareable settings sets (#1730)" in out


def test_digest_absence_does_not_break_session_start(repo: Path) -> None:
    """No commits (fresh clone, shallow checkout) — the section just vanishes."""
    register(repo, "Claude-HuddleFix")
    rc, out, err = run_hook(repo)
    assert rc == 0, err
    assert "What we have been working on" not in out
    assert "Registered as: **Claude-HuddleFix**" in out


# --- PP-llkj: scope-growth prompting ----------------------------------------


def test_identity_block_prompts_on_added_scope(repo: Path) -> None:
    """The kickoff is not the last post — added scope must be announced too."""
    register(repo, "Claude-HuddleFix")
    rc, out, err = run_hook(repo)
    assert rc == 0, err
    assert "THE KICKOFF IS NOT THE LAST POST" in out
    assert "scope gets ADDED" in out
    assert "CHANGE DIRECTION" in out


# --- PP-txet: the session_id / source parse must not collapse an empty field --
#
# The two fields were space-joined by the inline python and read back with the
# default IFS, which skips leading whitespace. `{"session_id": "", "source":
# "startup"}` therefore printed " startup" and parsed as SESSION_ID=startup,
# SOURCE="" — the "no session_id, exit silently" guard never fired, the hook
# announced the literal `startup` as the session id, and the compact
# suppression check compared against an empty SOURCE.
#
# Claude Code always sends a session_id, so this was latent there; it bites
# adapter-supplied payloads (.agents/hooks/antigravity-bootstrap.cjs), where an
# empty or missing session_id is plausible.


def test_missing_session_id_emits_rotation_notice_only(repo: Path) -> None:
    """Empty session_id: the rotation notice still fires, nothing else does."""
    set_rotation_pending(repo)
    rc, out, err = run_hook(repo, session_id="")
    assert rc == 0, err
    assert ROTATION_MARKER in out
    assert IDENTITY_MARKER not in out
    assert REGISTRATION_MARKER not in out
    # The pre-fix parse announced `source` as the session id. No part of the
    # rotation notice contains that word, so this pins the actual defect.
    assert "startup" not in out


def test_missing_session_id_on_the_up_to_date_path_emits_nothing(repo: Path) -> None:
    rc, out, err = run_hook(repo, session_id="")
    assert rc == 0, err
    assert out == ""


def test_absent_session_id_key_emits_nothing(repo: Path) -> None:
    """A payload that omits `session_id` entirely, not just an empty string."""
    rc, out, err = run_hook_payload(
        repo,
        {
            "transcript_path": "/tmp/transcripts/abc.jsonl",
            "cwd": str(repo),
            "hook_event_name": "SessionStart",
            "source": "startup",
        },
    )
    assert rc == 0, err
    assert out == ""


def test_compact_stays_suppressed_when_session_id_is_missing(repo: Path) -> None:
    """The worst pre-fix case: an empty session_id defeated the compact check.

    SESSION_ID took `compact` and SOURCE emptied out, so the hook skipped the
    condensed post-compaction block and emitted the full registration wall
    instead — naming `compact` as the session id.
    """
    register(repo, "Claude-HuddleFix")
    rc, out, err = run_hook(repo, session_id="", source="compact")
    assert rc == 0, err
    assert out == ""


def test_compact_is_suppressed_when_source_precedes_session_id(repo: Path) -> None:
    """Key order in the JSON payload must not change which block is emitted."""
    register(repo, "Claude-HuddleFix")
    rc, out, err = run_hook_payload(
        repo,
        {
            "source": "compact",
            "hook_event_name": "SessionStart",
            "cwd": str(repo),
            "transcript_path": "/tmp/transcripts/abc.jsonl",
            "session_id": SESSION_ID,
        },
    )
    assert rc == 0, err
    assert "## Huddle identity (post-compaction)" in out
    # The full startup-only registration/etiquette wall stays suppressed.
    assert "self-filter active" not in out
    assert REGISTRATION_MARKER not in out


def test_absent_source_key_still_emits_the_startup_block(repo: Path) -> None:
    """A missing `source` leaves an empty trailing field, not a shifted one."""
    register(repo, "Claude-HuddleFix")
    rc, out, err = run_hook_payload(
        repo,
        {
            "session_id": SESSION_ID,
            "transcript_path": "/tmp/transcripts/abc.jsonl",
            "cwd": str(repo),
            "hook_event_name": "SessionStart",
        },
    )
    assert rc == 0, err
    assert "Registered as: **Claude-HuddleFix**" in out
    assert "## Huddle identity (post-compaction)" not in out


# --- Early-exit paths must keep short-circuiting -----------------------------


def test_subagent_transcript_emits_nothing(repo: Path) -> None:
    set_rotation_pending(repo)
    rc, out, err = run_hook(
        repo, transcript_path="/tmp/transcripts/subagents/abc.jsonl"
    )
    assert rc == 0, err
    assert out == ""


# --- PP-355h: name derivation from the herdr workspace label -----------------


def test_workspace_label_is_offered_as_the_first_naming_choice(repo: Path) -> None:
    """The label branch renders the label and its CamelCased form."""
    rc, out, err = run_hook(repo, extra_env=stub_herdr(repo, "main e2e failures"))
    assert rc == 0, err
    assert REGISTRATION_MARKER in out
    assert 'workspace label, which is "main e2e failures"' in out
    assert "becomes <Harness>-MainE2eFailures" in out


def test_no_herdr_env_falls_back_to_bead_then_task(repo: Path) -> None:
    """Absent HERDR_WORKSPACE_ID, naming drops to bead-then-task and says why."""
    rc, out, err = run_hook(repo)
    assert rc == 0, err
    assert REGISTRATION_MARKER in out
    assert "No herdr workspace label available" in out
    assert "workspace label, which is" not in out


def test_unknown_workspace_id_falls_back(repo: Path) -> None:
    """A stale/moved id resolves to no label rather than a peer's label.

    The stub reports only "wOTHER" while the hook asks for "wX".
    """
    rc, out, err = run_hook(repo, extra_env=stub_herdr(repo, None))
    assert rc == 0, err
    assert "No herdr workspace label available" in out
    assert "somebody else" not in out


def test_label_without_alphanumerics_does_not_render_a_bare_prefix(
    repo: Path,
) -> None:
    """A label that camelizes to "" must not yield "<Harness>-".

    huddle-whoami.sh's ^[A-Za-z0-9_-]+$ validator accepts a bare "Claude-", so
    offering it invites a truncated registration.
    """
    rc, out, err = run_hook(repo, extra_env=stub_herdr(repo, "🔥"))
    assert rc == 0, err
    assert "becomes <Harness>-\n" not in out
    assert "becomes <Harness>-." not in out
    assert "No herdr workspace label available" in out


def test_wedged_herdr_does_not_consume_the_hook_budget(repo: Path) -> None:
    """A hung herdr must cost ~1s, not the hook's whole 5000ms budget.

    Blowing the budget makes Claude Code discard ALL stdout, so the session gets
    no session_id and never registers — the PP-2m3l breakage this file guards.
    """
    start = time.monotonic()
    rc, out, err = run_hook(repo, extra_env=stub_herdr(repo, "whatever", hang=True))
    elapsed = time.monotonic() - start
    assert rc == 0, err
    assert elapsed < 4.0, f"herdr timeout guard did not fire (took {elapsed:.1f}s)"
    assert REGISTRATION_MARKER in out
    assert f"`{SESSION_ID}`" in out
    assert "No herdr workspace label available" in out

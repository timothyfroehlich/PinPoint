"""Unit tests for scripts/hooks/huddle-whoami.sh.

Regression guard for PP-788v: `register` wrote `. + {($sid): $name}`
unconditionally, so a session_id that already held a name was silently rebound
to whatever name arrived last — and the command still printed a cheerful
"Registered:" line. The pre-existing duplicate-name check only covered the
FORWARD direction (this name is held by a different sid); the reverse
direction (this sid already holds a different name) was unguarded.

Observed live 2026-07-31: three consecutive dispatched subagents each
overwrote the orchestrator's mapping for the orchestrator's OWN session_id,
because a subagent has no route to its own id and gets handed the parent's.
That broke the orchestrator's self-filter (its own posts re-injected as a
peer's) and misattributed its huddle comments — including to Tim.

Two guards are under test:
  1. the reverse-direction collision refusal (harness-agnostic, --force
     overrides for a genuine rename);
  2. the subagent refusal on `register` and `discover`, keyed off the caller's
     transcript path. No --force override — there is no correct id for a
     subagent to supply.

Guard 2 used to key off the env pair CLAUDE_CODE_CHILD_SESSION + an AI_AGENT
ending in `_agent`, on the belief that Claude Code seeds those only into a
dispatch. It does not: the CLI puts both into the environment of EVERY shell
the Bash tool spawns, so from 2026-08-08 the predicate was true for top-level
sessions too and every Claude session on the machine was locked out of
registering (PP-uxnn). A top-level session and a dispatched subagent were
measured to carry byte-identical AI_AGENT, CLAUDE_CODE_CHILD_SESSION and
CLAUDE_CODE_SESSION_ID values — there is no env-level discriminator, so the
guard now looks at where the harness recorded the call: <project>/<sid>.jsonl
for a top-level session, <project>/<sid>/subagents/<agent>.jsonl for a
dispatch. Both directions are covered below.

Each test builds a throwaway git repo so `huddle_state_dir` resolves to
<repo>/.agents/huddle, then runs the script with an explicit env.
"""

import json
import os
import subprocess
import tempfile
from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent.parent / "hooks" / "huddle-whoami.sh"
SID = "11111111-2222-3333-4444-555555555555"
OTHER_SID = "99999999-8888-7777-6666-555555555555"

# What EVERY Claude Code Bash-tool shell carries — top-level session and
# dispatched subagent alike. CLAUDE_CODE_SESSION_ID holds the top-level id in
# both cases, which is exactly why a subagent registering it is wrong.
AGENT_ENV = {
    "CLAUDE_CODE_CHILD_SESSION": "1",
    "AI_AGENT": "claude-code_2-1-226_agent",
    "CLAUDE_CODE_SESSION_ID": SID,
}

# A recorded Bash call naming this script — what the caller's transcript holds
# by the time the script runs.
REGISTER_COMMAND = "bash scripts/hooks/huddle-whoami.sh register Claude-X " + SID

DISCOVER_COMMAND = "bash scripts/hooks/huddle-whoami.sh discover"


def ago(seconds: float) -> str:
    """An ISO-8601 UTC timestamp `seconds` in the past, formatted as Claude Code writes it.

    Timestamps must be relative to the run, not literals: the script ignores
    records older than WHOAMI_FRESH_SECONDS, so a fixed date would age out and
    every detection test would start passing for the wrong reason (the record
    being invisible rather than correctly classified). See STALE_SECONDS.
    """
    stamp = datetime.now(timezone.utc) - timedelta(seconds=seconds)
    return stamp.strftime("%Y-%m-%dT%H:%M:%S.") + f"{stamp.microsecond // 1000:03d}Z"


# Comfortably past the script's 120s freshness bound, for the stale-record
# tests. Kept well clear of it so the suite does not sit near the boundary.
STALE_SECONDS = 3600


@pytest.fixture
def repo() -> Iterator[Path]:
    """A throwaway git repo; huddle state lands in <repo>/.agents/huddle."""
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        subprocess.run(["git", "init", "-q"], cwd=root, check=True)
        yield root


def transcript_dir(repo: Path) -> Path:
    """Where the script looks for Claude Code transcripts, given HOME=repo.

    Mirrors `project_transcript_dir`: the main worktree root with every `/`
    replaced by `-`. `.resolve()` matters on macOS, where the temp dir is
    /var/folders/... but bash's `pwd` reports the physical /private/var/...
    """
    mangled = str(repo.resolve()).replace("/", "-")
    return repo / ".claude" / "projects" / mangled


def write_transcript(path: Path, *records: tuple[str, str]) -> None:
    """Write a JSONL transcript of (timestamp, command) tool_use records."""
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        json.dumps(
            {
                "type": "assistant",
                "timestamp": ts,
                "message": {
                    "content": [
                        {"type": "tool_use", "name": "Bash", "input": {"command": cmd}}
                    ]
                },
            },
            # Compact, the way Claude Code's JSON.stringify writes it.
            separators=(",", ":"),
        )
        for ts, cmd in records
    ]
    path.write_text("\n".join(lines) + "\n")


def write_raw_transcript(path: Path, *records: dict[str, object]) -> None:
    """Write pre-built records verbatim, for shapes `write_transcript` cannot express."""
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps(r, separators=(",", ":")) for r in records]
    path.write_text("\n".join(lines) + "\n")


def mention_only_records(ts: str) -> list[dict[str, object]]:
    """Records that NAME the script without invoking it.

    Every one of these is matched by a raw `grep -F huddle-whoami.sh` over the
    line, and none of them is evidence that this agent ran the script. The
    first three were taken from a live transcript, where they were the *only*
    matches in a 25-record window — editing or reading the file is enough to
    produce them.
    """
    return [
        {"type": "file-history-snapshot", "timestamp": ts, "filePath": str(SCRIPT)},
        {"type": "queue-operation", "timestamp": ts, "detail": str(SCRIPT)},
        {
            "type": "user",
            "timestamp": ts,
            "message": {"content": "look at scripts/hooks/huddle-whoami.sh"},
        },
        # A Bash call that merely READS the script — the shape that makes a
        # subagent doing research look like it invoked the guard.
        {
            "type": "assistant",
            "timestamp": ts,
            "message": {
                "content": [
                    {
                        "type": "tool_use",
                        "name": "Bash",
                        "input": {
                            "command": "rg -n discover scripts/hooks/huddle-whoami.sh"
                        },
                    }
                ]
            },
        },
        # A tool RESULT echoing the command back.
        {
            "type": "user",
            "timestamp": ts,
            "message": {
                "content": [
                    {"type": "tool_result", "content": REGISTER_COMMAND},
                ]
            },
        },
    ]


def top_level_transcript(repo: Path, *records: tuple[str, str]) -> None:
    write_transcript(transcript_dir(repo) / f"{SID}.jsonl", *records)


def subagent_transcript(repo: Path, *records: tuple[str, str]) -> None:
    path = transcript_dir(repo) / SID / "subagents" / "agent-abc123.jsonl"
    write_transcript(path, *records)


def names(repo: Path) -> dict[str, str]:
    path = repo / ".agents" / "huddle" / "session-names.json"
    if not path.exists():
        return {}
    parsed: dict[str, str] = json.loads(path.read_text())
    return parsed


def run(
    repo: Path, *args: str, env: dict[str, str] | None = None
) -> tuple[int, str, str]:
    """Run the script. The env starts EMPTY of Claude's identity vars.

    `pnpm run check:pytest` may itself be invoked from inside a subagent, whose
    environment carries the very vars the subagent guard keys off. Passing an
    explicit env keeps the tests deterministic wherever they run.

    PATH is INHERITED, not hardcoded — it is not one of the identity vars this
    is isolating, and the script needs `jq`. A fixed
    "/usr/local/bin:/usr/bin:/bin" passes on Linux, where the distro ships
    /usr/bin/jq, and fails on Apple Silicon macOS, where Homebrew installs jq
    under /opt/homebrew/bin. CI is Linux-only, so that break would surface as a
    local-only failure on a Mac and never in CI.
    """
    proc = subprocess.run(
        ["bash", str(SCRIPT), *args],
        cwd=repo,
        env={
            "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
            "HOME": str(repo),
            **(env or {}),
        },
        capture_output=True,
        text=True,
    )
    return proc.returncode, proc.stdout, proc.stderr


def test_register_writes_the_mapping(repo: Path) -> None:
    rc, out, _ = run(repo, "register", "Claude-Alpha", SID)
    assert rc == 0
    assert f"Registered: {SID} → Claude-Alpha" in out
    assert names(repo) == {SID: "Claude-Alpha"}


def test_reregistering_the_same_name_is_idempotent(repo: Path) -> None:
    run(repo, "register", "Claude-Alpha", SID)
    rc, out, _ = run(repo, "register", "Claude-Alpha", SID)
    assert rc == 0
    assert "Registered" in out
    assert names(repo) == {SID: "Claude-Alpha"}


def test_rebinding_a_registered_session_is_refused(repo: Path) -> None:
    """The PP-788v regression: a second name for an already-named session."""
    run(repo, "register", "Claude-Orchestrator", SID)
    rc, out, err = run(repo, "register", "Claude-Subagent", SID)
    assert rc == 1
    assert out == ""
    assert "already registered as Claude-Orchestrator" in err
    assert "Refusing to rebind it to Claude-Subagent" in err
    # The owner keeps the name — the whole point.
    assert names(repo) == {SID: "Claude-Orchestrator"}


def test_rebind_refusal_names_the_force_escape(repo: Path) -> None:
    run(repo, "register", "Claude-Orchestrator", SID)
    _, _, err = run(repo, "register", "Claude-Renamed", SID)
    assert f"register --force Claude-Renamed {SID}" in err


def test_force_rebinds_and_says_so(repo: Path) -> None:
    run(repo, "register", "Claude-Orchestrator", SID)
    rc, out, _ = run(repo, "register", "--force", "Claude-Renamed", SID)
    assert rc == 0
    assert "Renamed (--force)" in out
    assert "was Claude-Orchestrator" in out
    assert names(repo) == {SID: "Claude-Renamed"}


def test_name_held_by_another_session_is_still_refused(repo: Path) -> None:
    """The pre-existing forward-direction guard must survive the refactor."""
    run(repo, "register", "Claude-Alpha", SID)
    rc, _, err = run(repo, "register", "Claude-Alpha", OTHER_SID)
    assert rc == 1
    assert f"already registered to session {SID}" in err
    assert names(repo) == {SID: "Claude-Alpha"}


def test_force_does_not_override_a_taken_name(repo: Path) -> None:
    """--force is for renaming YOUR session, not for stealing someone's name."""
    run(repo, "register", "Claude-Alpha", SID)
    rc, _, err = run(repo, "register", "--force", "Claude-Alpha", OTHER_SID)
    assert rc == 1
    assert "already registered to session" in err
    assert names(repo) == {SID: "Claude-Alpha"}


def test_subagent_cannot_register(repo: Path) -> None:
    """The caller's own tool_use sits in a subagents/ transcript."""
    top_level_transcript(repo, (ago(10), "git status"))
    subagent_transcript(repo, (ago(5), REGISTER_COMMAND))
    rc, out, err = run(repo, "register", "Claude-Subagent", SID, env=AGENT_ENV)
    assert rc == 1
    assert out == ""
    assert "this is a dispatched subagent" in err
    assert "Sign your huddle posts" in err
    assert names(repo) == {}


def test_subagent_cannot_register_even_over_a_free_session_id(repo: Path) -> None:
    """The rebind guard can't help here — nothing owns the id yet.

    This is the case that makes the subagent guard load-bearing rather than
    belt-and-braces: an unregistered parent id would be claimed by the
    subagent's name, and the parent would then be locked out by guard 1.
    """
    subagent_transcript(repo, (ago(5), REGISTER_COMMAND))
    run(repo, "register", "Claude-Subagent", "some-unclaimed-id", env=AGENT_ENV)
    assert names(repo) == {}


def test_subagent_refusal_ignores_force(repo: Path) -> None:
    subagent_transcript(repo, (ago(5), REGISTER_COMMAND))
    rc, _, err = run(repo, "register", "--force", "Claude-Subagent", SID, env=AGENT_ENV)
    assert rc == 1
    assert "this is a dispatched subagent" in err
    assert names(repo) == {}


def test_subagent_is_found_behind_a_trailing_hook_attachment(repo: Path) -> None:
    """A PreToolUse hook_success record can land after the tool_use.

    Measured once in 34 live Bash calls, so the last line alone is not a safe
    place to look — the scan covers a short window of trailing records.
    """
    subagent_transcript(
        repo,
        (ago(5), REGISTER_COMMAND),
        (ago(4), "(hook attachment, no signature)"),
    )
    rc, _, err = run(repo, "register", "Claude-Subagent", SID, env=AGENT_ENV)
    assert rc == 1
    assert "this is a dispatched subagent" in err


def test_top_level_session_registers_despite_the_agent_env_markers(
    repo: Path,
) -> None:
    """PP-uxnn: the exact shape that locked every session out.

    CLAUDE_CODE_CHILD_SESSION and an `_agent` AI_AGENT are present — Claude
    Code puts them in every Bash-tool shell — but the call is recorded in the
    TOP-LEVEL transcript, and a stale subagent record must not outrank it.
    """
    subagent_transcript(repo, (ago(65), REGISTER_COMMAND))
    top_level_transcript(repo, (ago(5), REGISTER_COMMAND))
    rc, out, _ = run(repo, "register", "Claude-HerdrRecon", SID, env=AGENT_ENV)
    assert rc == 0
    assert "Registered" in out
    assert names(repo) == {SID: "Claude-HerdrRecon"}


def test_stale_subagent_record_does_not_refuse_an_unflushed_top_level_call(
    repo: Path,
) -> None:
    """Regression, PP-uxnn: the false positive that reintroduced the lockout.

    The detection assumed the caller's own tool_use is always flushed before the
    command runs. It is not. Observed live: a top-level `discover` ran with its
    record still unwritten, so the only record naming the script was one an
    earlier dispatched subagent had left 18 minutes before — and the session was
    told it was a subagent. Every session that had ever dispatched a subagent
    touching this script was one unflushed write away from being locked out.

    So: top-level transcript holds NO matching record (the unflushed case), and
    the subagent's is stale. A record that old says nothing about the process
    running now and must be ignored, leaving the read indeterminate — which
    fails open, with `register`'s rebind guard as the backstop.
    """
    top_level_transcript(repo, (ago(3), "git status"))
    subagent_transcript(repo, (ago(STALE_SECONDS), REGISTER_COMMAND))
    rc, out, _ = run(repo, "register", "Claude-TopLevel", SID, env=AGENT_ENV)
    assert rc == 0
    assert "Registered" in out
    assert names(repo) == {SID: "Claude-TopLevel"}


def test_stale_record_does_not_refuse_discover_either(repo: Path) -> None:
    """Same staleness rule on the read-only path."""
    subagent_transcript(repo, (ago(STALE_SECONDS), DISCOVER_COMMAND))
    rc, out, err = run(repo, "discover", env=AGENT_ENV)
    assert rc == 0
    assert out.strip() == SID
    assert "dispatched subagent" not in err


def test_fresh_subagent_record_still_refuses(repo: Path) -> None:
    """The freshness bound must not blunt the guard it protects.

    Paired with the two staleness tests above: same setup, recent record, and
    the refusal must still fire. Without this, widening the bound to uselessness
    would leave the suite green.
    """
    top_level_transcript(repo, (ago(3), "git status"))
    subagent_transcript(repo, (ago(2), REGISTER_COMMAND))
    rc, _, err = run(repo, "register", "Claude-Subagent", SID, env=AGENT_ENV)
    assert rc == 1
    assert "this is a dispatched subagent" in err
    assert names(repo) == {}


def test_records_that_merely_mention_the_script_are_not_invocations(
    repo: Path,
) -> None:
    """Regression, PP-uxnn review: the match was a substring of the raw JSONL line.

    `grep -F huddle-whoami.sh` over the line counts any record that names the
    path — a file-history snapshot, a queue operation, a user message, a `rg`
    that reads the file, a tool_result echoing an earlier command. In a live
    transcript those were the ONLY matches in a 25-record window, and not one
    was a Bash tool_use invoking the script; editing this file produces them.

    Here the subagent transcript holds nothing BUT mentions, all fresh. If any
    of them counts, a legitimate top-level session is refused — the PP-uxnn
    lockout a third time, now triggered by a subagent that merely read the file.
    """
    write_raw_transcript(
        transcript_dir(repo) / SID / "subagents" / "agent-abc123.jsonl",
        *mention_only_records(ago(2)),
    )
    rc, out, _ = run(repo, "register", "Claude-TopLevel", SID, env=AGENT_ENV)
    assert rc == 0
    assert "Registered" in out
    assert names(repo) == {SID: "Claude-TopLevel"}


def test_parent_mentioning_the_script_does_not_mask_a_real_subagent(
    repo: Path,
) -> None:
    """The same overmatch in the other direction — the PP-788v clobber path.

    Parent merely reads the file 1s ago; the subagent genuinely invokes it 3s
    ago. Under a substring match the parent's newer mention outranks the
    subagent's real call, the subagent is classified top-level, and it
    overwrites the parent's mapping — the exact damage this guard exists to
    stop.
    """
    write_raw_transcript(
        transcript_dir(repo) / f"{SID}.jsonl",
        *mention_only_records(ago(1)),
    )
    subagent_transcript(repo, (ago(3), REGISTER_COMMAND))
    rc, _, err = run(repo, "register", "Claude-Subagent", SID, env=AGENT_ENV)
    assert rc == 1
    assert "this is a dispatched subagent" in err
    assert names(repo) == {}


INVOCATIONS = [
    "bash scripts/hooks/huddle-whoami.sh register Claude-X " + SID,
    # Multi-line, invocation on a later line. 17.5% of real Bash tool_use
    # commands in this project's transcripts are multi-line (117/669), and
    # jq's Oniguruma treats `^` as start-of-STRING, so these matched nothing
    # until `\n` joined the separator class — a subagent running the ordinary
    # `cd`-then-run shape was read as top-level.
    'cd "$REPO"\nbash scripts/hooks/huddle-whoami.sh register Claude-X ' + SID,
    "set -e\ncd /repo\nbash scripts/hooks/huddle-whoami.sh discover",
    "bash /abs/path/scripts/hooks/huddle-whoami.sh discover",
    "/abs/path/scripts/hooks/huddle-whoami.sh discover",
    "sh scripts/hooks/huddle-whoami.sh list",
    "cd /somewhere && bash scripts/hooks/huddle-whoami.sh discover",
    "bash scripts/hooks/huddle-whoami.sh discover; echo done",
]

MENTIONS = [
    "rg -n discover scripts/hooks/huddle-whoami.sh",
    # Multi-line must not become a blanket pass in the other direction: the
    # script is still only an argument here.
    'cd "$REPO"\nrg -n discover scripts/hooks/huddle-whoami.sh',
    "cat scripts/hooks/huddle-whoami.sh",
    "git diff scripts/hooks/huddle-whoami.sh",
    "shellcheck scripts/hooks/huddle-whoami.sh",
    "echo huddle-whoami.sh",
    "sed -i s/x/y/ scripts/hooks/huddle-whoami.sh",
]


@pytest.mark.parametrize("command", INVOCATIONS)
def test_command_position_counts_as_an_invocation(repo: Path, command: str) -> None:
    """The script in command position — with or without a bash/sh prefix, a path, or a separator."""
    subagent_transcript(repo, (ago(2), command))
    rc, _, err = run(repo, "register", "Claude-Subagent", SID, env=AGENT_ENV)
    assert rc == 1, f"should have been read as an invocation: {command}"
    assert "this is a dispatched subagent" in err


@pytest.mark.parametrize("command", MENTIONS)
def test_argument_position_is_not_an_invocation(repo: Path, command: str) -> None:
    """The script as an ARGUMENT to another program — reading it is not running it."""
    subagent_transcript(repo, (ago(2), command))
    rc, out, _ = run(repo, "register", "Claude-TopLevel", SID, env=AGENT_ENV)
    assert rc == 0, f"should not have been read as an invocation: {command}"
    assert names(repo) == {SID: "Claude-TopLevel"}


def test_a_record_with_a_non_object_message_does_not_disable_detection(
    repo: Path,
) -> None:
    """Regression, PP-uxnn review: an unguarded index aborted the whole jq run.

    `.message.content` raises on a record whose `.message` is not an object,
    and jq aborts the entire program on the first one — not just that record.
    The caller swallows the error (`2>/dev/null || true`), so a single odd
    record would silently switch detection off for that transcript and the
    subagent would sail through.

    The odd record here sits BEFORE a genuine invocation in the same file, so
    the guard only fires if the run survived it.
    """
    path = transcript_dir(repo) / SID / "subagents" / "agent-abc123.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    records = [
        {"type": "user", "timestamp": ago(4), "message": "a bare string"},
        {"type": "summary", "timestamp": ago(3), "message": 42},
        {
            "type": "assistant",
            "timestamp": ago(2),
            "message": {
                "content": [
                    {
                        "type": "tool_use",
                        "name": "Bash",
                        "input": {"command": REGISTER_COMMAND},
                    }
                ]
            },
        },
    ]
    path.write_text(
        "\n".join(json.dumps(r, separators=(",", ":")) for r in records) + "\n"
    )
    rc, _, err = run(repo, "register", "Claude-Subagent", SID, env=AGENT_ENV)
    assert rc == 1
    assert "this is a dispatched subagent" in err
    assert names(repo) == {}


def test_subsecond_ordering_is_not_lost_to_truncation(repo: Path) -> None:
    """Regression, PP-uxnn review: whole-second epochs made same-second records tie.

    Ties keep the FIRST candidate, which is unconditionally the top-level
    transcript, so a genuine subagent record fractionally newer than an
    unrelated parent record lost — systematically, and always in the
    fail-open direction.

    Both records land in the same wall-clock second, subagent newer by 400ms.
    """
    now = datetime.now(timezone.utc) - timedelta(seconds=5)
    base = now.replace(microsecond=0)

    def stamp(ms: int) -> str:
        return base.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ms:03d}Z"

    top_level_transcript(repo, (stamp(100), REGISTER_COMMAND))
    subagent_transcript(repo, (stamp(500), REGISTER_COMMAND))
    rc, _, err = run(repo, "register", "Claude-Subagent", SID, env=AGENT_ENV)
    assert rc == 1
    assert "this is a dispatched subagent" in err
    assert names(repo) == {}


def test_agent_env_markers_alone_do_not_refuse(repo: Path) -> None:
    """No transcripts to read is indeterminate, and indeterminate fails open.

    Other harnesses (Antigravity, Codex) land here too — they write no Claude
    transcripts — and must stay registerable.
    """
    rc, out, _ = run(repo, "register", "Claude-Alpha", SID, env=AGENT_ENV)
    assert rc == 0
    assert "Registered" in out
    assert names(repo) == {SID: "Claude-Alpha"}


def test_subagent_cannot_discover(repo: Path) -> None:
    """discover would hand back the PARENT's id — cause #1 of the clobber."""
    subagent_transcript(
        repo,
        (ago(5), DISCOVER_COMMAND),
    )
    rc, out, err = run(repo, "discover", env=AGENT_ENV)
    assert rc == 1
    assert out == ""
    assert "this is a dispatched subagent" in err


def test_top_level_session_can_discover(repo: Path) -> None:
    top_level_transcript(
        repo,
        (ago(5), DISCOVER_COMMAND),
    )
    rc, out, _ = run(repo, "discover", env=AGENT_ENV)
    assert rc == 0
    assert out.strip() == SID


def test_discover_uses_the_env_var_claude_code_actually_sets(repo: Path) -> None:
    """Regression, PP-uxnn: the exact path keyed off a variable that does not exist.

    `discover` read $CLAUDE_SESSION_ID; Claude Code sets $CLAUDE_CODE_SESSION_ID
    (https://code.claude.com/docs/en/env-vars.md). So the exact branch was
    unreachable in real use and every call fell through to the transcript
    heuristic, printing three warnings. The old tests missed it by injecting the
    misspelled variable themselves — asserting on a name only the test defined.

    Hence: no transcript is written here, and the misspelled name is NOT set.
    Discovery can only succeed via the documented variable, and a fall-through
    to the heuristic would fail outright with nothing on disk to read.
    """
    rc, out, err = run(repo, "discover", env={"CLAUDE_CODE_SESSION_ID": OTHER_SID})
    assert rc == 0
    assert out.strip() == OTHER_SID
    assert "falling back to transcript heuristic" not in err


def test_discover_falls_back_to_the_generic_var_for_other_harnesses(
    repo: Path,
) -> None:
    """$CLAUDE_SESSION_ID stays supported so a non-Claude harness can pass its id."""
    rc, out, err = run(repo, "discover", env={"CLAUDE_SESSION_ID": OTHER_SID})
    assert rc == 0
    assert out.strip() == OTHER_SID
    assert "falling back to transcript heuristic" not in err


def test_claude_code_var_wins_when_both_are_set(repo: Path) -> None:
    """$CLAUDE_SESSION_ID is a fallback, not an override — pin which one wins.

    A non-Claude shim launched from inside a Claude Code shell inherits
    $CLAUDE_CODE_SESSION_ID and gets Claude's id even having exported its own.
    That is the accepted trade: letting the generic name win would let one
    stale value in a shell profile misroute every session on the machine. A
    harness needing certainty passes the id as an argument.
    """
    rc, out, _ = run(
        repo,
        "discover",
        env={"CLAUDE_CODE_SESSION_ID": SID, "CLAUDE_SESSION_ID": OTHER_SID},
    )
    assert rc == 0
    assert out.strip() == SID


def test_unknown_option_is_rejected(repo: Path) -> None:
    rc, _, err = run(repo, "register", "--bogus", "Claude-Alpha", SID)
    assert rc == 1
    assert "unknown option '--bogus'" in err
    assert names(repo) == {}


def test_missing_session_id_still_shows_usage(repo: Path) -> None:
    rc, _, err = run(repo, "register", "Claude-Alpha")
    assert rc == 1
    assert "Usage: huddle-whoami.sh register [--force] NAME SESSION_ID" in err
    assert names(repo) == {}
    # The discover hint puts the command on its own line rather than running it
    # together with prose, which is what the stray double space was papering over.
    assert "To get the discovered session_id, run:" in err
    assert "\n  bash scripts/hooks/huddle-whoami.sh discover\n" in err
    assert "discover  to get" not in err


def test_unknown_subcommand_usage_states_each_signature(repo: Path) -> None:
    """A collapsed trailing `[SESSION_ID]` misdescribes every subcommand.

    SESSION_ID is REQUIRED for whoami and register, and accepted by neither
    list nor discover — so the fallback usage spells each one out.
    """
    rc, _, err = run(repo, "bogus-subcommand")
    assert rc == 1
    assert "Usage: huddle-whoami.sh <subcommand>" in err
    assert "whoami SESSION_ID" in err
    assert "register [--force] NAME SESSION_ID" in err
    # list/discover take no session_id, so neither line may suggest one.
    list_line = next(ln for ln in err.splitlines() if ln.strip().startswith("list"))
    discover_line = next(
        ln for ln in err.splitlines() if ln.strip().startswith("discover")
    )
    assert "SESSION_ID" not in list_line
    assert "SESSION_ID" not in discover_line
    # The old single-optional-argument form must not come back.
    assert "] [SESSION_ID]" not in err


def test_whoami_and_list_are_unaffected(repo: Path) -> None:
    run(repo, "register", "Claude-Alpha", SID)
    run(repo, "register", "Claude-Beta", OTHER_SID)
    rc, out, _ = run(repo, "whoami", SID)
    assert rc == 0
    assert out.strip() == "Claude-Alpha"
    rc, out, _ = run(repo, "list")
    assert rc == 0
    assert out.splitlines() == [f"Claude-Alpha\t{SID}", f"Claude-Beta\t{OTHER_SID}"]

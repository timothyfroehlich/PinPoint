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
    top_level_transcript(repo, ("2026-08-09T12:00:00.000Z", "git status"))
    subagent_transcript(repo, ("2026-08-09T12:00:05.000Z", REGISTER_COMMAND))
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
    subagent_transcript(repo, ("2026-08-09T12:00:05.000Z", REGISTER_COMMAND))
    run(repo, "register", "Claude-Subagent", "some-unclaimed-id", env=AGENT_ENV)
    assert names(repo) == {}


def test_subagent_refusal_ignores_force(repo: Path) -> None:
    subagent_transcript(repo, ("2026-08-09T12:00:05.000Z", REGISTER_COMMAND))
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
        ("2026-08-09T12:00:05.000Z", REGISTER_COMMAND),
        ("2026-08-09T12:00:05.040Z", "(hook attachment, no signature)"),
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
    subagent_transcript(repo, ("2026-08-09T11:59:00.000Z", REGISTER_COMMAND))
    top_level_transcript(repo, ("2026-08-09T12:00:05.000Z", REGISTER_COMMAND))
    rc, out, _ = run(repo, "register", "Claude-HerdrRecon", SID, env=AGENT_ENV)
    assert rc == 0
    assert "Registered" in out
    assert names(repo) == {SID: "Claude-HerdrRecon"}


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
        ("2026-08-09T12:00:05.000Z", "bash scripts/hooks/huddle-whoami.sh discover"),
    )
    rc, out, err = run(repo, "discover", env=AGENT_ENV)
    assert rc == 1
    assert out == ""
    assert "this is a dispatched subagent" in err


def test_top_level_session_can_discover(repo: Path) -> None:
    top_level_transcript(
        repo,
        ("2026-08-09T12:00:05.000Z", "bash scripts/hooks/huddle-whoami.sh discover"),
    )
    rc, out, _ = run(repo, "discover", env={**AGENT_ENV, "CLAUDE_SESSION_ID": SID})
    assert rc == 0
    assert out.strip() == SID


def test_discover_still_returns_an_explicit_session_id(repo: Path) -> None:
    rc, out, _ = run(repo, "discover", env={"CLAUDE_SESSION_ID": OTHER_SID})
    assert rc == 0
    assert out.strip() == OTHER_SID


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

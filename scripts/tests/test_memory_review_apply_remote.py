"""Unit tests for the cross-machine memory-review dispatcher.

`ssh` and `scp` are stubbed with fake executables on PATH so no real machine is
touched. Every external command the script can invoke is stubbed - a partially
stubbed harness is how a passing test still reaches the real world (the
merge-pr.sh harness wrote six live huddle comments because `bd` was not stubbed).
"""

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent.parent / "memory_review" / "apply_remote.sh"

REMOTE_RESULT = {
    "schema_version": 1,
    "machine": "bazzite",
    "applied": ["a1"],
    "disputed": [{"id": "a2", "reason": "still true here"}],
    "failed": [],
}


@pytest.fixture
def harness(tmp_path: Path) -> dict:
    """A stub bin dir plus a valid manifest. Stubs log every invocation."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    log = tmp_path / "calls.log"
    result_file = tmp_path / "result.json"
    result_file.write_text(json.dumps(REMOTE_RESULT), encoding="utf-8")

    # The ssh stub echoes the remote result only for the retrieval `cat`, so the
    # test can tell dispatch and retrieval apart in the log. Two env knobs let a
    # test drive the failure modes: MR_FAIL_CLAUDE makes the remote agent exit
    # nonzero, MR_NO_RESULT makes it exit 0 without writing a result.
    (bin_dir / "ssh").write_text(
        "#!/usr/bin/env bash\n"
        f'echo "ssh $*" >> "{log}"\n'
        'if [[ "$*" == *claude* ]]; then\n'
        '  [[ -n "${MR_NO_RESULT:-}" ]] && rm -f "%s"\n'
        '  exit "${MR_FAIL_CLAUDE:-0}"\n'
        "fi\n"
        'if [[ "$*" == *"cat "*memory-review-result.json* ]]; then\n'
        '  [[ -f "%s" ]] || exit 1\n'
        '  cat "%s"\n'
        "fi\n"
        "exit 0\n" % (result_file, result_file, result_file),
        encoding="utf-8",
    )
    (bin_dir / "scp").write_text(
        f'#!/usr/bin/env bash\necho "scp $*" >> "{log}"\nexit 0\n', encoding="utf-8"
    )
    for stub in ("ssh", "scp"):
        (bin_dir / stub).chmod(0o755)

    manifest = tmp_path / "manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "generated": "2026-07-28T14:00:00Z",
                "target_machine": "bazzite",
                "actions": [
                    {
                        "id": "a1",
                        "op": "create",
                        "slug": "-var-home-froeht-Code-PinPoint",
                        "name": "n",
                        "type": "reference",
                        "description": "d",
                        "body": "b",
                        "reason": "r",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    return {"bin": bin_dir, "log": log, "manifest": manifest, "tmp": tmp_path}


def _invoke(harness: dict, *args: str, **envvars: str) -> subprocess.CompletedProcess:
    env = dict(os.environ, PATH=f"{harness['bin']}:{os.environ['PATH']}", **envvars)
    return subprocess.run(
        ["bash", str(SCRIPT), *args], capture_output=True, text=True, env=env
    )


def _run(harness: dict, *args: str, **envvars: str) -> subprocess.CompletedProcess:
    return _invoke(harness, "--manifest", str(harness["manifest"]), *args, **envvars)


def _calls(harness: dict) -> list[str]:
    if not harness["log"].exists():
        return []
    return harness["log"].read_text(encoding="utf-8").splitlines()


def test_requires_a_manifest(harness):
    proc = _invoke(harness)
    assert proc.returncode != 0
    assert "--manifest is required" in proc.stderr


def test_rejects_a_missing_manifest(harness):
    proc = _invoke(harness, "--manifest", str(harness["tmp"] / "nope.json"))
    assert proc.returncode != 0
    assert "not found" in proc.stderr


def test_rejects_a_manifest_that_is_not_valid_json(harness):
    bad = harness["tmp"] / "bad.json"
    bad.write_text("{not json", encoding="utf-8")
    proc = _invoke(harness, "--manifest", str(bad))
    assert proc.returncode != 0
    assert "not valid JSON" in proc.stderr


def test_validates_before_touching_the_remote(harness):
    """A bad manifest must not cause a remote snapshot - failing fast keeps a
    typo from spinning up work on the other machine."""
    _invoke(harness, "--manifest", str(harness["tmp"] / "nope.json"))
    assert _calls(harness) == []


def test_dry_run_snapshots_but_never_dispatches(harness):
    proc = _run(harness, "--dry-run")
    assert proc.returncode == 0, proc.stderr
    calls = "\n".join(_calls(harness))
    assert "snapshot_stores.py" in calls or "python3 -" in calls, (
        "a dry run must still prove the snapshot path works"
    )
    assert "claude" not in calls, "a dry run must not launch the remote agent"


def test_snapshots_the_remote_before_dispatching(harness):
    assert _run(harness).returncode == 0
    calls = _calls(harness)
    snapshot_at = next(i for i, c in enumerate(calls) if "python3 -" in c)
    claude_at = next(i for i, c in enumerate(calls) if "claude" in c)
    assert snapshot_at < claude_at, "the undo must exist before anything is applied"


def test_returns_the_remote_result_document(harness):
    proc = _run(harness)
    assert proc.returncode == 0, proc.stderr
    assert json.loads(proc.stdout)["disputed"][0]["id"] == "a2"


def test_stage_only_ships_the_manifest_and_stops(harness):
    """Tim's opt-in path: stage the manifest, print the prompt, let him drive an
    interactive session on the far side instead of dispatching headlessly."""
    proc = _run(harness, "--stage-only")
    assert proc.returncode == 0, proc.stderr
    calls = "\n".join(_calls(harness))
    assert "scp " in calls, "the manifest must still reach the remote"
    assert "claude" not in calls, "stage-only must not launch the remote agent"
    assert "memory-review-manifest.json" in proc.stdout, (
        "must print a prompt naming the staged manifest"
    )


def test_honours_an_alternate_host(harness):
    assert _run(harness, "--host", "bazzite-lan").returncode == 0
    assert "bazzite-lan" in "\n".join(_calls(harness))


def test_rejects_unknown_arguments(harness):
    proc = _run(harness, "--nope")
    assert proc.returncode != 0
    assert "unknown argument" in proc.stderr


def test_clears_the_stale_result_before_dispatching(harness):
    """REMOTE_RESULT is a fixed path. If it is not cleared first, a run that
    writes no result silently returns the PREVIOUS run's document - and the lead
    reports last week's ids as applied this week."""
    assert _run(harness).returncode == 0
    calls = _calls(harness)
    rm_at = next(i for i, c in enumerate(calls) if "rm -f" in c and "result" in c)
    claude_at = next(i for i, c in enumerate(calls) if "claude" in c)
    assert rm_at < claude_at


def test_fails_loudly_when_the_remote_writes_no_result(harness):
    """Exit 0 with no result document must not be reported as success."""
    proc = _run(harness, MR_NO_RESULT="1")
    assert proc.returncode != 0
    assert "no result" in proc.stderr.lower() or "result" in proc.stderr.lower()
    assert proc.stdout.strip() == ""


def test_rejects_a_result_document_that_is_not_this_schema(harness):
    (harness["tmp"] / "result.json").write_text('{"nope": true}', encoding="utf-8")
    proc = _run(harness)
    assert proc.returncode != 0
    assert "result" in proc.stderr.lower()


def test_retrieves_the_result_even_when_the_remote_agent_fails(harness):
    """If the agent applied half the manifest then died, the store is already
    mutated - the applied/failed record is the only account of what changed, so
    dying before retrieval is the worst possible moment to give up."""
    proc = _run(harness, MR_FAIL_CLAUDE="3")
    calls = "\n".join(_calls(harness))
    assert "cat " in calls, "must still retrieve the result after a failed apply"
    assert json.loads(proc.stdout)["applied"] == ["a1"]
    assert proc.returncode != 0, "but must still surface the failure"


def test_missing_option_value_reports_instead_of_dying_silently(harness):
    """`shift 2` with one arg left trips set -e before the usage check runs."""
    proc = _invoke(harness, "--manifest")
    assert proc.returncode != 0
    assert proc.stderr.strip() != "", "must not exit silently"
    assert "--manifest" in proc.stderr


def test_rejects_dry_run_combined_with_stage_only(harness):
    proc = _run(harness, "--dry-run", "--stage-only")
    assert proc.returncode != 0
    assert "mutually exclusive" in proc.stderr


@pytest.mark.skipif(
    shutil.which("shellcheck") is None, reason="shellcheck not installed"
)
def test_shellcheck_is_clean():
    proc = subprocess.run(["shellcheck", str(SCRIPT)], capture_output=True, text=True)
    assert proc.returncode == 0, proc.stdout

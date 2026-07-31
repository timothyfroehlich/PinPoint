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

    # The ssh stub echoes the remote result only for the retrieval call, so the
    # test can tell dispatch and retrieval apart in the log.
    (bin_dir / "ssh").write_text(
        "#!/usr/bin/env bash\n"
        f'echo "ssh $*" >> "{log}"\n'
        f'if [[ "$*" == *memory-review-result.json* ]]; then cat "{result_file}"; fi\n'
        "exit 0\n",
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


def _invoke(harness: dict, *args: str) -> subprocess.CompletedProcess:
    env = dict(os.environ, PATH=f"{harness['bin']}:{os.environ['PATH']}")
    return subprocess.run(
        ["bash", str(SCRIPT), *args], capture_output=True, text=True, env=env
    )


def _run(harness: dict, *args: str) -> subprocess.CompletedProcess:
    return _invoke(harness, "--manifest", str(harness["manifest"]), *args)


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


@pytest.mark.skipif(
    shutil.which("shellcheck") is None, reason="shellcheck not installed"
)
def test_shellcheck_is_clean():
    proc = subprocess.run(["shellcheck", str(SCRIPT)], capture_output=True, text=True)
    assert proc.returncode == 0, proc.stdout

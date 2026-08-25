"""Contract tests for Beads attribution through the global Huddle identity API."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

HOOK = Path(__file__).parents[2] / ".claude" / "hooks" / "inject-beads-actor.cjs"


def find_node() -> str:
    """Find a real Node binary, skipping mise's HOME-sensitive shim."""
    for entry in os.environ.get("PATH", "").split(os.pathsep):
        candidate = Path(entry) / "node"
        if candidate.is_file() and os.access(candidate, os.X_OK):
            if candidate.resolve().name != "mise":
                return str(candidate)
    raise RuntimeError("Node.js is required to test the hook")


NODE = find_node()


def install_whoami_stub(home: Path) -> Path:
    script = home / ".agents" / "huddle" / "huddle-whoami.sh"
    script.parent.mkdir(parents=True, exist_ok=True)
    script.write_text(
        "#!/usr/bin/env bash\n"
        "set -u\n"
        'printf \'%s\\n\' "$*" > "$HUDDLE_CALL_LOG"\n'
        'pwd >> "$HUDDLE_CALL_LOG"\n'
        '[[ "${HUDDLE_FAIL:-0}" == 1 ]] && exit 1\n'
        "printf '%s\\n' \"${HUDDLE_NAME:-Claude-GlobalIdentity}\"\n"
    )
    script.chmod(0o755)
    return script


def run_hook(
    tmp_path: Path,
    payload: dict[str, object],
    *,
    extra_env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    home = tmp_path / "home"
    home.mkdir(exist_ok=True)
    install_whoami_stub(home)
    call_log = tmp_path / "whoami-call"
    env = {
        "HOME": str(home),
        "PATH": "/usr/bin:/bin",
        "HUDDLE_CALL_LOG": str(call_log),
        **(extra_env or {}),
    }
    return subprocess.run(
        [NODE, str(HOOK)],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        env=env,
        check=True,
    )


def test_bd_write_uses_global_huddle_identity_and_payload_cwd(tmp_path: Path) -> None:
    checkout = tmp_path / "checkout"
    checkout.mkdir()
    result = run_hook(
        tmp_path,
        {
            "session_id": "session-123",
            "cwd": str(checkout),
            "tool_input": {"command": "bd update PP-1 --title fixed"},
        },
    )

    decision = json.loads(result.stdout)["hookSpecificOutput"]
    assert decision["updatedInput"]["command"] == (
        'export BEADS_ACTOR="Claude-GlobalIdentity"; bd update PP-1 --title fixed'
    )
    assert decision["permissionDecision"] == "allow"
    assert (tmp_path / "whoami-call").read_text().splitlines() == [
        "whoami session-123",
        str(checkout),
    ]


def test_missing_or_invalid_global_identity_falls_back_to_claude(
    tmp_path: Path,
) -> None:
    payload = {
        "session_id": "session-123",
        "cwd": str(tmp_path),
        "tool_input": {"command": "bd close PP-1"},
    }
    failed = run_hook(tmp_path, payload, extra_env={"HUDDLE_FAIL": "1"})
    invalid = run_hook(tmp_path, payload, extra_env={"HUDDLE_NAME": "bad name"})

    for result in (failed, invalid):
        command = json.loads(result.stdout)["hookSpecificOutput"]["updatedInput"][
            "command"
        ]
        assert command == 'export BEADS_ACTOR="Claude"; bd close PP-1'


def test_explicit_actor_bypasses_huddle_lookup(tmp_path: Path) -> None:
    result = run_hook(
        tmp_path,
        {
            "session_id": "session-123",
            "cwd": str(tmp_path),
            "tool_input": {"command": "bd --actor Codex update PP-1 --claim"},
        },
    )

    assert result.stdout == ""
    assert not (tmp_path / "whoami-call").exists()

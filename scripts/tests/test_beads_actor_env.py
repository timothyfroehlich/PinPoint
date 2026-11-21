"""Contract tests for Beads attribution through the session env file.

The SessionStart hook appends a `bd` shell function to $CLAUDE_ENV_FILE. These
tests run the hook, source the file in zsh and bash the way Claude Code does
before a Bash command, and check what a stub `bd` receives.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

HOOK = Path(__file__).parents[2] / ".claude" / "hooks" / "beads-actor-env.cjs"
SESSION_ID = "0f6c2a9e-1b2c-4d5e-8f90-abcdef123456"


def find_node() -> str:
    """Find a real Node binary, skipping mise's HOME-sensitive shim."""
    for entry in os.environ.get("PATH", "").split(os.pathsep):
        candidate = Path(entry) / "node"
        if candidate.is_file() and os.access(candidate, os.X_OK):
            if candidate.resolve().name != "mise":
                return str(candidate)
    raise RuntimeError("Node.js is required to test the hook")


NODE = find_node()
SHELLS = [s for s in ("zsh", "bash") if shutil.which(s)]


def run_hook(
    env_file: Path | None, payload: dict[str, object] | str
) -> subprocess.CompletedProcess[str]:
    env = {"PATH": "/usr/bin:/bin"}
    if env_file is not None:
        env["CLAUDE_ENV_FILE"] = str(env_file)
    data = payload if isinstance(payload, str) else json.dumps(payload)
    return subprocess.run(
        [NODE, str(HOOK)],
        input=data,
        text=True,
        capture_output=True,
        env=env,
        check=False,
    )


def make_home(tmp_path: Path, whoami_body: str) -> tuple[Path, Path]:
    """A fake HOME with a huddle-whoami stub, plus a bin dir holding a stub bd."""
    home = tmp_path / "home"
    script = home / "Code" / "huddle" / "lib" / "huddle-whoami.sh"
    script.parent.mkdir(parents=True)
    script.write_text("#!/usr/bin/env bash\n" + whoami_body)
    script.chmod(0o755)
    bindir = tmp_path / "bin"
    bindir.mkdir()
    stub = bindir / "bd"
    stub.write_text('#!/bin/sh\nprintf "actor=%s args=%s\\n" "$BEADS_ACTOR" "$*"\n')
    stub.chmod(0o755)
    return home, bindir


def run_bd(
    shell: str, env_file: Path, home: Path, bindir: Path, command: str, **extra: str
) -> str:
    env = {"HOME": str(home), "PATH": f"{bindir}:/usr/bin:/bin", **extra}
    result = subprocess.run(
        [shell, "-c", f'. "{env_file}"; {command}'],
        text=True,
        capture_output=True,
        env=env,
        check=True,
    )
    return result.stdout.strip()


def test_appends_function_once(tmp_path: Path) -> None:
    env_file = tmp_path / "session.env"
    env_file.write_text("export FROM_OTHER_HOOK=1")
    for _ in range(2):
        assert run_hook(env_file, {"session_id": SESSION_ID}).returncode == 0
    text = env_file.read_text()
    assert text.startswith("export FROM_OTHER_HOOK=1\n")
    assert text.count("# pinpoint-beads-actor") == 1
    assert f'whoami "{SESSION_ID}"' in text


@pytest.mark.parametrize("shell", SHELLS)
def test_bd_gets_huddle_name(tmp_path: Path, shell: str) -> None:
    env_file = tmp_path / "session.env"
    run_hook(env_file, {"session_id": SESSION_ID})
    home, bindir = make_home(
        tmp_path, f'[[ "$*" == "whoami {SESSION_ID}" ]] && echo Claude-Tester\n'
    )
    out = run_bd(shell, env_file, home, bindir, "true && bd list --json | cat")
    assert out == "actor=Claude-Tester args=list --json"


@pytest.mark.parametrize("shell", SHELLS)
def test_falls_back_to_claude_never_tim(tmp_path: Path, shell: str) -> None:
    env_file = tmp_path / "session.env"
    run_hook(env_file, {"session_id": SESSION_ID})
    for body in ("exit 1\n", "echo 'Tim Froehlich'\n", "echo 'x; rm -rf /'\n"):
        sub = tmp_path / str(abs(hash(body)))
        sub.mkdir()
        home, bindir = make_home(sub, body)
        assert (
            run_bd(shell, env_file, home, bindir, "bd show") == "actor=Claude args=show"
        )


@pytest.mark.parametrize("shell", SHELLS)
def test_explicit_actor_wins(tmp_path: Path, shell: str) -> None:
    env_file = tmp_path / "session.env"
    run_hook(env_file, {"session_id": SESSION_ID})
    home, bindir = make_home(tmp_path, "echo Claude-Tester\n")
    out = run_bd(shell, env_file, home, bindir, "bd show", BEADS_ACTOR="Codex")
    assert out == "actor=Codex args=show"


@pytest.mark.parametrize(
    "payload",
    [{"session_id": 'x"; touch /tmp/pwned; "'}, {"session_id": 7}, {}, "not json"],
)
def test_rejects_unsafe_or_missing_session_id(tmp_path: Path, payload: object) -> None:
    env_file = tmp_path / "session.env"
    assert run_hook(env_file, payload).returncode == 0  # type: ignore[arg-type]
    assert not env_file.exists()


def test_no_env_file_is_a_no_op(tmp_path: Path) -> None:
    assert run_hook(None, {"session_id": SESSION_ID}).returncode == 0


def test_new_session_id_appends_and_wins(tmp_path: Path) -> None:
    env_file = tmp_path / "session.env"
    other = "11111111-2222-3333-4444-555555555555"
    run_hook(env_file, {"session_id": SESSION_ID})
    run_hook(env_file, {"session_id": other})
    run_hook(env_file, {"session_id": other})
    text = env_file.read_text()
    assert text.count("# pinpoint-beads-actor") == 2
    home, bindir = make_home(
        tmp_path, f'[[ "$*" == "whoami {other}" ]] && echo Claude-Forked\n'
    )
    out = run_bd(SHELLS[0], env_file, home, bindir, "bd show")
    assert out == "actor=Claude-Forked args=show"


def test_hung_lookup_is_capped(tmp_path: Path) -> None:
    if not shutil.which("timeout"):
        pytest.skip("no timeout command on this host")
    env_file = tmp_path / "session.env"
    run_hook(env_file, {"session_id": SESSION_ID})
    home, bindir = make_home(tmp_path, "sleep 30\necho Claude-Late\n")
    out = run_bd(SHELLS[0], env_file, home, bindir, "bd show")
    assert out == "actor=Claude args=show"

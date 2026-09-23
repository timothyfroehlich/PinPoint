"""Local opt-in and reset must prove the Docker owner of localhost ports."""

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent.parent / "assert-local-stack.py"
SPEC = importlib.util.spec_from_file_location("assert_local_stack", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
guard = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = guard
SPEC.loader.exec_module(guard)


def install_local_stack(
    monkeypatch: pytest.MonkeyPatch,
    root: Path,
    *,
    context: str = "unix:///tmp/local-docker.sock",
    owner: str | None = None,
    db_port: str = "54322",
) -> list[list[str]]:
    (root / "supabase").mkdir()
    (root / "supabase/config.toml").write_text('project_id = "pinpoint-test"\n')
    calls: list[list[str]] = []

    def fake_run(
        args: list[str], **_kwargs: object
    ) -> subprocess.CompletedProcess[str]:
        calls.append(args)
        if "context" in args:
            return subprocess.CompletedProcess(args, 0, json.dumps(context), "")
        name = args[-1]
        internal = "5432/tcp" if "_db_" in name else "8000/tcp"
        port = db_port if "_db_" in name else "54321"
        payload = {
            "Config": {
                "Labels": {
                    "com.supabase.cli.project": "pinpoint-test",
                    "com.supabase.cli.workdir": owner or str(root.resolve()),
                }
            },
            "State": {"Running": True},
            "HostConfig": {
                "PortBindings": {internal: [{"HostIp": "", "HostPort": port}]}
            },
        }
        return subprocess.CompletedProcess(args, 0, json.dumps([payload]), "")

    monkeypatch.setattr(guard.subprocess, "run", fake_run)
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321")
    return calls


def test_accepts_only_matching_running_local_containers(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = install_local_stack(monkeypatch, tmp_path)

    guard.assert_local_stack(
        tmp_path, "postgresql://postgres:secret@localhost:54322/postgres", True
    )

    assert len(calls) == 3
    assert calls[1][-1] == "supabase_db_pinpoint-test"
    assert calls[2][-1] == "supabase_kong_pinpoint-test"


@pytest.mark.parametrize(
    ("context", "owner", "db_port", "message"),
    [
        ("ssh://bazzite", None, "54322", "not a local Unix socket"),
        (
            "unix:///private/tmp/pinpoint-remote-docker-abc.sock",
            None,
            "54322",
            "remote pilot tunnel",
        ),
        (
            "unix:///tmp/local-docker.sock",
            "/other/worktree",
            "54322",
            "not this worktree",
        ),
        ("unix:///tmp/local-docker.sock", None, "9999", "does not own localhost port"),
    ],
)
def test_rejects_wrong_daemon_owner_or_port(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    context: str,
    owner: str | None,
    db_port: str,
    message: str,
) -> None:
    install_local_stack(
        monkeypatch, tmp_path, context=context, owner=owner, db_port=db_port
    )

    with pytest.raises(guard.LocalStackError, match=message):
        guard.assert_local_stack(
            tmp_path, "postgresql://postgres@localhost:54322/postgres", True
        )


def test_running_remote_tunnel_blocks_local_mode_before_docker(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = install_local_stack(monkeypatch, tmp_path)
    state = tmp_path / guard.REMOTE_STATE
    state.parent.mkdir(parents=True)
    state.write_text(json.dumps({"tunnel_pid": os.getpid()}))

    with pytest.raises(
        guard.LocalStackError, match="remote pilot tunnel is still running"
    ):
        guard.assert_local_stack(
            tmp_path, "postgresql://postgres@localhost:54322/postgres", True
        )
    assert calls == []


def test_stopped_remote_tunnel_does_not_block_owned_local_stack(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    install_local_stack(monkeypatch, tmp_path)
    state = tmp_path / guard.REMOTE_STATE
    state.parent.mkdir(parents=True)
    state.write_text(json.dumps({"tunnel_pid": 0}))

    guard.assert_local_stack(
        tmp_path, "postgresql://postgres@localhost:54322/postgres", True
    )

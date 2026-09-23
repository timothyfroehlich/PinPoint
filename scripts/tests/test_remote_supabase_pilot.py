"""Focused tests for the remote Supabase pilot lifecycle helper."""

import importlib.util
import json
import os
import subprocess
import sys
from dataclasses import replace
from pathlib import Path

import pytest

SCRIPT_PATH = Path(__file__).parent.parent / "remote-supabase.py"
SPEC = importlib.util.spec_from_file_location("remote_supabase_pilot", SCRIPT_PATH)
assert SPEC is not None
assert SPEC.loader is not None
pilot = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = pilot
SPEC.loader.exec_module(pilot)


def ports(slot: int = 3) -> object:
    return pilot.Ports.for_slot(slot)


def state(tmp_path: Path, *, tunnel_pid: int = 123) -> object:
    local = pilot.Ports.for_slot(3)
    remote = pilot.Ports.for_slot(12)
    provisional = pilot.PilotState(
        tunnel_pid=tunnel_pid,
        tunnel_argv=(),
        project_id="pinpoint-remote-pilot",
        remote_slot=12,
        network_name=pilot.network_name("pinpoint-remote-pilot"),
        docker_socket_path="/run/user/1000/docker.sock",
        local_socket_path=str(tmp_path / "docker.sock"),
        local=local,
        remote=remote,
        local_commit="abc",
        config_digest="digest",
        forwards=pilot.build_forwards(local, remote),
    )
    argv = pilot.build_tunnel_argv(provisional)
    return replace(provisional, tunnel_argv=argv)


def completed(returncode: int = 0, stdout: str = "", stderr: str = "") -> object:
    return subprocess.CompletedProcess([], returncode, stdout, stderr)


def write_config(root: Path, local: object) -> None:
    config_dir = root / "supabase"
    config_dir.mkdir()
    config = f"""# AUTO-GENERATED
project_id = "pinpoint-remote-pilot"
[api]
port = {local.api}
[db]
port = {local.db}
shadow_port = {local.shadow}
[db.pooler]
enabled = false
port = {local.pooler}
[studio]
enabled = false
port = 54323
[inbucket]
enabled = true
port = {local.inbucket}
smtp_port = {local.smtp}
pop3_port = {local.pop3}
[auth]
site_url = "http://localhost:{local.app}"
additional_redirect_urls = ["http://localhost:{local.app}"]
[auth.external.google]
enabled = false
redirect_uri = ""
[auth.external.discord]
enabled = true
redirect_uri = ""
[edge_runtime]
enabled = false
inspector_port = 54438
[analytics]
enabled = false
port = 54538
"""
    path = config_dir / "config.toml"
    path.write_text(config)
    path.chmod(0o444)


def test_ports_for_slot_matches_worktree_scheme() -> None:
    assert pilot.Ports.for_slot(12) == pilot.Ports(
        app=3120,
        api=55521,
        db=55522,
        shadow=55520,
        pooler=55529,
        inbucket=55524,
        smtp=55525,
        pop3=55526,
    )


def test_parse_env_handles_export_and_quotes(tmp_path: Path) -> None:
    path = tmp_path / ".env.local"
    path.write_text("export TOKEN='secret value'\nPLAIN=value\n# ignored\n")

    assert pilot.parse_env(path) == {"TOKEN": "secret value", "PLAIN": "value"}


def test_local_ports_use_generated_urls() -> None:
    actual = pilot.local_ports_from_env(
        {
            "PORT": "3030",
            "NEXT_PUBLIC_SUPABASE_URL": "http://localhost:54621",
            "POSTGRES_URL": "postgresql://postgres:postgres@localhost:54622/postgres",
            "INBUCKET_PORT": "54624",
            "INBUCKET_SMTP_PORT": "54625",
        }
    )

    assert actual == pilot.Ports.for_slot(3)


def test_build_forwards_preserves_mac_urls_and_adds_cli_health_ports() -> None:
    local = pilot.Ports.for_slot(3)
    remote = pilot.Ports.for_slot(12)

    assert pilot.build_forwards(local, remote) == (
        (54621, 55521),
        (54622, 55522),
        (54624, 55524),
        (54625, 55525),
        (55521, 55521),
        (55522, 55522),
        (55524, 55524),
        (55525, 55525),
    )


def test_build_forwards_deduplicates_matching_slots() -> None:
    matching = pilot.Ports.for_slot(3)

    forwards = pilot.build_forwards(matching, matching)

    assert len(forwards) == 4


def test_runtime_config_uses_remote_services_and_mac_auth_urls(tmp_path: Path) -> None:
    local = pilot.Ports.for_slot(3)
    remote = pilot.Ports.for_slot(12)
    write_config(tmp_path, local)

    runtime, digest = pilot.render_runtime_config(
        tmp_path, "pinpoint-remote-pilot", local, remote
    )

    config_path = runtime / "supabase/config.toml"
    parsed = pilot.tomllib.loads(config_path.read_text())
    assert parsed["api"]["port"] == remote.api
    assert parsed["db"]["port"] == remote.db
    assert parsed["inbucket"]["smtp_port"] == remote.smtp
    assert parsed["auth"]["site_url"] == f"http://localhost:{local.app}"
    assert (
        parsed["auth"]["external"]["discord"]["redirect_uri"]
        == f"http://localhost:{local.api}/auth/v1/callback"
    )
    assert len(digest) == 64
    assert config_path.stat().st_mode & 0o777 == 0o600
    assert runtime.stat().st_mode & 0o777 == 0o700


def test_runtime_config_rejects_enabled_bind_mount_services(tmp_path: Path) -> None:
    local = pilot.Ports.for_slot(3)
    write_config(tmp_path, local)
    path = tmp_path / "supabase/config.toml"
    path.chmod(0o644)
    path.write_text(
        path.read_text().replace(
            "[studio]\nenabled = false", "[studio]\nenabled = true"
        )
    )

    with pytest.raises(pilot.PilotError, match="Studio and Edge Runtime"):
        pilot.render_runtime_config(
            tmp_path, "pinpoint-remote-pilot", local, pilot.Ports.for_slot(12)
        )


def test_state_round_trip_uses_private_file(tmp_path: Path) -> None:
    expected = state(tmp_path)

    pilot.write_state(tmp_path, expected)

    assert pilot.read_state(tmp_path) == expected
    assert (tmp_path / pilot.STATE_RELATIVE_PATH).stat().st_mode & 0o777 == 0o600


def test_read_state_rejects_incomplete_payload(tmp_path: Path) -> None:
    path = tmp_path / pilot.STATE_RELATIVE_PATH
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps({"tunnel_pid": 123}))

    with pytest.raises(pilot.PilotError, match="invalid pilot state file"):
        pilot.read_state(tmp_path)


def test_tunnel_command_includes_private_socket_and_all_forwards(
    tmp_path: Path,
) -> None:
    expected = state(tmp_path)
    argv = pilot.build_tunnel_argv(expected)

    assert argv[:3] == ("ssh", "-S", "none")
    assert f"{expected.local_socket_path}:{expected.docker_socket_path}" in argv
    for local_port, remote_port in expected.forwards:
        assert f"{local_port}:127.0.0.1:{remote_port}" in argv
    assert argv[-1] == "bazzite"


def test_owned_tunnel_requires_exact_complete_argv(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    expected = state(tmp_path)
    monkeypatch.setattr(pilot, "process_argv", lambda _pid: expected.tunnel_argv)
    assert pilot.is_owned_tunnel(expected)

    shortened = expected.tunnel_argv[:-2] + (expected.tunnel_argv[-1],)
    monkeypatch.setattr(pilot, "process_argv", lambda _pid: shortened)
    assert not pilot.is_owned_tunnel(expected)


def test_child_environment_keeps_secret_out_of_command_and_state(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    expected = state(tmp_path)
    monkeypatch.setenv("DOCKER_CONTEXT", "unrelated")

    env = pilot.child_environment(
        tmp_path, {"DISCORD_CLIENT_SECRET": "secret"}, expected
    )

    assert env["DISCORD_CLIENT_SECRET"] == "secret"
    assert env["DOCKER_HOST"] == f"unix://{expected.local_socket_path}"
    assert env["DOCKER_SSH_COMMAND"].startswith("ssh -S none")
    assert "DOCKER_CONTEXT" not in env
    assert env["PATH"] == os.environ["PATH"]
    assert not (tmp_path / pilot.STATE_RELATIVE_PATH.parent / "docker-bin").exists()
    assert "secret" not in " ".join(expected.tunnel_argv)
    assert "secret" not in json.dumps(pilot.asdict(expected))


def test_cli_failure_omits_generated_and_local_credentials() -> None:
    output = (
        'startup failed near SERVICE_ROLE_KEY="generated-key"\n'
        "database secret db-password rejected\n"
    )

    safe = pilot.safe_cli_failure(output, {"DB_PASSWORD": "db-password"})

    assert "generated-key" not in safe
    assert "db-password" not in safe
    assert "[Supabase credential output omitted]" in safe


def test_remote_lease_script_reserves_persists_and_marks_bootstrap(
    tmp_path: Path,
) -> None:
    manifest = tmp_path / "worktree-slots.json"
    lease_root = tmp_path / "leases"
    forbidden = ",".join(str(value) for value in range(1, 96))

    def invoke(action: str) -> dict[str, object]:
        result = subprocess.run(
            [
                sys.executable,
                "-",
                action,
                "pinpoint-remote-pilot",
                str(manifest),
                str(lease_root),
                forbidden,
            ],
            input=pilot.REMOTE_LEASE_SCRIPT,
            check=True,
            capture_output=True,
            text=True,
        )
        return json.loads(result.stdout)

    first = invoke("reserve")
    second = invoke("reserve")
    marked = invoke("mark-bootstrapped")

    assert first["slot"] == 96
    assert second["slot"] == first["slot"]
    assert first["bootstrap_complete"] is False
    assert marked["bootstrap_complete"] is True
    lease_file = Path(str(first["lease_path"])) / "lease.json"
    assert lease_file.stat().st_mode & 0o777 == 0o600
    registry = json.loads(manifest.read_text())["slots"]
    assert registry[str(first["lease_path"])] == 96

    wrong_release = subprocess.run(
        [
            sys.executable,
            "-",
            "pinpoint-remote-pilot",
            "95",
            str(manifest),
            str(lease_root),
        ],
        input=pilot.REMOTE_RELEASE_SCRIPT,
        check=False,
        capture_output=True,
        text=True,
    )
    assert wrong_release.returncode != 0
    assert lease_file.exists()

    subprocess.run(
        [
            sys.executable,
            "-",
            "pinpoint-remote-pilot",
            "96",
            str(manifest),
            str(lease_root),
        ],
        input=pilot.REMOTE_RELEASE_SCRIPT,
        check=True,
        capture_output=True,
        text=True,
    )
    assert not lease_file.exists()
    assert str(first["lease_path"]) not in json.loads(manifest.read_text())["slots"]


def test_corrupt_remote_lease_cannot_be_replaced(tmp_path: Path) -> None:
    manifest = tmp_path / "worktree-slots.json"
    manifest.write_text('{"version": 1, "slots": {}}')
    lease_dir = tmp_path / "leases" / "pinpoint-remote-pilot"
    lease_dir.mkdir(parents=True)
    (lease_dir / "lease.json").write_text("invalid json")

    result = subprocess.run(
        [
            sys.executable,
            "-",
            "reserve",
            "pinpoint-remote-pilot",
            str(manifest),
            str(tmp_path / "leases"),
            "-",
        ],
        input=pilot.REMOTE_LEASE_SCRIPT,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode != 0
    assert "lease is unreadable" in result.stderr
    assert (lease_dir / "lease.json").read_text() == "invalid json"


def test_validate_state_rejects_changed_lease(tmp_path: Path) -> None:
    expected = state(tmp_path)
    wrong = pilot.RemoteLease(
        project_id=expected.project_id,
        slot=13,
        bootstrap_complete=False,
        lease_path="/lease",
    )

    with pytest.raises(pilot.PilotError, match="port lease"):
        pilot.validate_state_identity(
            expected, expected.project_id, wrong, expected.config_digest, 1000
        )


def test_validate_state_rejects_wrong_daemon_socket(tmp_path: Path) -> None:
    expected = state(tmp_path)
    wrong = replace(expected, docker_socket_path="/run/user/1000/podman/podman.sock")
    lease = pilot.RemoteLease(
        expected.project_id, expected.remote_slot, False, "/lease"
    )

    with pytest.raises(pilot.PilotError, match="rootless Docker"):
        pilot.validate_state_identity(
            wrong, expected.project_id, lease, expected.config_digest, 1000
        )


def test_remote_docker_command_uses_explicit_socket_and_binary(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[list[str]] = []

    def record(args: list[str], **_kwargs: object) -> object:
        calls.append(args)
        return completed()

    monkeypatch.setattr(pilot, "run_remote", record)
    pilot.run_remote_docker(1000, ["info", "--format", "{{.ServerVersion}}"])

    command = calls[0][-1]
    assert "DOCKER_HOST=unix:///run/user/1000/docker.sock" in command
    assert pilot.REMOTE_DOCKER_BIN in command
    assert "podman" not in command


def test_verify_remote_docker_requires_rootless_identity(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    expected = state(tmp_path)
    good = f'29.8.1|["name=rootless"]|{pilot.REMOTE_DOCKER_ROOT}\n'
    monkeypatch.setattr(pilot, "docker_run", lambda *_args: completed(stdout=good))
    monkeypatch.setattr(
        pilot, "run_remote_docker", lambda *_args, **_kwargs: completed(stdout=good)
    )
    monkeypatch.setattr(
        pilot, "run_remote", lambda *_args, **_kwargs: completed(stdout="bazzite\n")
    )

    assert "Docker 29.8.1" in pilot.verify_remote_docker(expected, {}, 1000)

    podman = '5.8.4|["name=seccomp"]|/var/home/froeht/.local/share/containers\n'
    monkeypatch.setattr(pilot, "docker_run", lambda *_args: completed(stdout=podman))
    with pytest.raises(pilot.PilotError, match="rootless Docker"):
        pilot.verify_remote_docker(expected, {}, 1000)


def test_network_creation_sets_loopback_binding(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    expected = state(tmp_path)
    calls: list[list[str]] = []

    def docker_call(
        _state: object, _env: object, args: list[str], **_kwargs: object
    ) -> object:
        calls.append(args)
        if args[:2] == ["network", "inspect"]:
            return completed(returncode=1)
        return completed()

    monkeypatch.setattr(pilot, "docker_run", docker_call)
    pilot.ensure_remote_network(expected, {})

    assert "com.docker.network.bridge.host_binding_ipv4=127.0.0.1" in calls[-1]


def test_existing_network_must_still_be_loopback_bound(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    expected = state(tmp_path)
    payload = [{"Labels": {"pinpoint.remote-supabase-pilot": expected.project_id}}]
    monkeypatch.setattr(
        pilot,
        "docker_run",
        lambda *_args, **_kwargs: completed(stdout=json.dumps(payload)),
    )

    with pytest.raises(pilot.PilotError, match="not loopback-bound"):
        pilot.ensure_remote_network(expected, {})


def install_status_baseline(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> object:
    expected = state(tmp_path)
    lease = pilot.RemoteLease(
        project_id=expected.project_id,
        slot=expected.remote_slot,
        bootstrap_complete=True,
        lease_path="/lease",
    )
    monkeypatch.setattr(pilot, "run_remote", lambda *_args, **_kwargs: completed())
    monkeypatch.setattr(pilot, "remote_uid", lambda: 1000)
    monkeypatch.setattr(
        pilot, "run_remote_docker", lambda *_args, **_kwargs: completed(stdout="29.8.1")
    )
    monkeypatch.setattr(
        pilot,
        "read_local_identity",
        lambda _root: (expected.project_id, expected.local, {}, "abc"),
    )
    monkeypatch.setattr(pilot, "remote_lease", lambda *_args, **_kwargs: lease)
    monkeypatch.setattr(
        pilot,
        "render_runtime_config",
        lambda *_args: (tmp_path, expected.config_digest),
    )
    monkeypatch.setattr(pilot, "read_state", lambda _root: expected)
    monkeypatch.setattr(pilot, "remote_container_snapshot", lambda _project, _uid: [])
    monkeypatch.setattr(pilot, "remote_health", lambda _remote: (True, "healthy"))
    monkeypatch.setattr(pilot, "is_owned_tunnel", lambda _state: True)
    monkeypatch.setattr(pilot, "local_health", lambda _local: (True, "healthy"))
    return expected


def test_status_distinguishes_unreachable_host(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(
        pilot, "run_remote", lambda *_args, **_kwargs: completed(returncode=255)
    )

    assert pilot.status(tmp_path) == pilot.STATUS_UNREACHABLE
    assert "UNREACHABLE" in capsys.readouterr().out


def test_status_distinguishes_unreachable_docker(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(pilot, "run_remote", lambda *_args, **_kwargs: completed())
    monkeypatch.setattr(pilot, "remote_uid", lambda: 1000)
    monkeypatch.setattr(
        pilot,
        "run_remote_docker",
        lambda *_args, **_kwargs: completed(returncode=1),
    )

    assert pilot.status(tmp_path) == pilot.STATUS_DOCKER_UNREACHABLE
    assert "DOCKER UNREACHABLE" in capsys.readouterr().out


def test_status_distinguishes_identity_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    install_status_baseline(monkeypatch, tmp_path)
    monkeypatch.setattr(
        pilot,
        "read_local_identity",
        lambda _root: (_ for _ in ()).throw(pilot.PilotError("wrong project")),
    )

    assert pilot.status(tmp_path) == pilot.STATUS_IDENTITY_ERROR
    assert "IDENTITY ERROR" in capsys.readouterr().out


def test_status_distinguishes_unhealthy_remote(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    install_status_baseline(monkeypatch, tmp_path)
    monkeypatch.setattr(pilot, "remote_health", lambda _remote: (False, "db down"))

    assert pilot.status(tmp_path) == pilot.STATUS_REMOTE_UNHEALTHY
    assert "REMOTE UNHEALTHY" in capsys.readouterr().out


def test_status_distinguishes_missing_tunnel(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    install_status_baseline(monkeypatch, tmp_path)
    monkeypatch.setattr(pilot, "is_owned_tunnel", lambda _state: False)

    assert pilot.status(tmp_path) == pilot.STATUS_TUNNEL_DOWN
    assert "TUNNEL DOWN" in capsys.readouterr().out


def test_status_distinguishes_broken_tunnel(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    install_status_baseline(monkeypatch, tmp_path)
    monkeypatch.setattr(pilot, "local_health", lambda _local: (False, "refused"))

    assert pilot.status(tmp_path) == pilot.STATUS_TUNNEL_BROKEN
    assert "TUNNEL BROKEN" in capsys.readouterr().out


def test_status_reports_ready(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    expected = install_status_baseline(monkeypatch, tmp_path)

    assert pilot.status(tmp_path) == 0
    output = capsys.readouterr().out
    assert "READY" in output
    assert expected.project_id in output


@pytest.mark.parametrize(
    ("bootstrap_complete", "transient_first_start", "expected_scripts"),
    [
        (False, False, ["db:migrate", "db:fast-reset"]),
        (False, True, ["db:migrate", "db:fast-reset"]),
        (True, False, ["db:migrate"]),
    ],
)
def test_start_migrates_every_time_and_seeds_only_before_bootstrap(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    bootstrap_complete: bool,
    transient_first_start: bool,
    expected_scripts: list[str],
) -> None:
    expected = state(tmp_path)
    lease = pilot.RemoteLease(
        project_id=expected.project_id,
        slot=expected.remote_slot,
        bootstrap_complete=bootstrap_complete,
        lease_path="/lease",
    )
    marked = replace(lease, bootstrap_complete=True)
    lease_calls: list[str] = []
    scripts: list[str] = []
    start_calls: list[object] = []
    monkeypatch.setattr(
        pilot,
        "read_local_identity",
        lambda _root: (expected.project_id, expected.local, {}, "abc"),
    )
    monkeypatch.setattr(pilot, "verify_locked_cli", lambda _root: "2.117.0")
    monkeypatch.setattr(pilot, "read_state", lambda _root: None)
    monkeypatch.setattr(pilot, "remote_uid", lambda: 1000)

    def lease_result(action: str, *_args: object, **_kwargs: object) -> object:
        lease_calls.append(action)
        return marked if action == "mark-bootstrapped" else lease

    monkeypatch.setattr(pilot, "remote_lease", lease_result)
    monkeypatch.setattr(
        pilot,
        "render_runtime_config",
        lambda *_args: (tmp_path, expected.config_digest),
    )
    monkeypatch.setattr(pilot, "start_tunnel", lambda _root, _state: expected)
    monkeypatch.setattr(pilot, "child_environment", lambda *_args: os.environ.copy())
    monkeypatch.setattr(pilot, "verify_remote_docker", lambda *_args: "Docker 29.8.1")
    monkeypatch.setattr(pilot, "ensure_remote_network", lambda *_args: None)
    monkeypatch.setattr(
        pilot, "project_volumes", lambda *_args: ("db",) if bootstrap_complete else ()
    )

    def start_result(*_args: object, **_kwargs: object) -> object:
        start_calls.append(object())
        if transient_first_start and len(start_calls) == 1:
            return completed(
                1,
                stderr="LegacyDbConnectError: Connection terminated unexpectedly",
            )
        return completed()

    monkeypatch.setattr(pilot.subprocess, "run", start_result)
    monkeypatch.setattr(pilot.time, "sleep", lambda _seconds: None)
    monkeypatch.setattr(pilot, "wait_for_local_services", lambda *_args: None)
    monkeypatch.setattr(
        pilot,
        "run_project_command",
        lambda _root, _env, script, **_kwargs: scripts.append(script),
    )

    assert pilot.start(tmp_path) == 0
    assert scripts == expected_scripts
    assert len(start_calls) == (2 if transient_first_start else 1)
    assert ("mark-bootstrapped" in lease_calls) is (not bootstrap_complete)


def test_stop_tunnel_never_kills_unowned_process(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    expected = state(tmp_path)
    killed: list[tuple[int, int]] = []
    monkeypatch.setattr(pilot, "is_owned_tunnel", lambda _state: False)
    monkeypatch.setattr(pilot.os, "kill", lambda pid, sig: killed.append((pid, sig)))

    pilot.stop_tunnel(tmp_path, expected)

    assert killed == []
    assert pilot.read_state(tmp_path).tunnel_pid == 0


def test_start_never_reserves_over_a_failed_lease_lookup(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    expected = state(tmp_path)
    calls: list[str] = []
    monkeypatch.setattr(
        pilot,
        "read_local_identity",
        lambda _root: (expected.project_id, expected.local, {}, "abc"),
    )
    monkeypatch.setattr(pilot, "verify_locked_cli", lambda _root: "2.117.0")
    monkeypatch.setattr(pilot, "read_state", lambda _root: None)
    monkeypatch.setattr(pilot, "remote_uid", lambda: 1000)

    def failed_lookup(action: str, *_args: object, **_kwargs: object) -> object:
        calls.append(action)
        raise subprocess.CalledProcessError(1, ["ssh"], stderr="identity mismatch")

    monkeypatch.setattr(pilot, "remote_lease", failed_lookup)

    with pytest.raises(pilot.PilotError, match="without proving the lease is absent"):
        pilot.start(tmp_path)
    assert calls == ["get"]


def test_destroy_removes_only_owned_remote_resources(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    expected = state(tmp_path)
    pilot.write_state(tmp_path, expected)
    lease = pilot.RemoteLease(expected.project_id, expected.remote_slot, True, "/lease")
    events: list[str] = []
    monkeypatch.setattr(
        pilot,
        "read_local_identity",
        lambda _root: (expected.project_id, expected.local, {}, "abc"),
    )
    monkeypatch.setattr(pilot, "remote_lease", lambda *_args: lease)
    monkeypatch.setattr(
        pilot,
        "render_runtime_config",
        lambda *_args: (tmp_path, expected.config_digest),
    )
    monkeypatch.setattr(pilot, "remote_uid", lambda: 1000)
    monkeypatch.setattr(pilot, "is_owned_tunnel", lambda _state: True)
    monkeypatch.setattr(pilot, "child_environment", lambda *_args: {})
    monkeypatch.setattr(pilot, "verify_remote_docker", lambda *_args: "Docker")
    monkeypatch.setattr(pilot, "project_volumes", lambda *_args: ("owned-db",))

    def docker_call(
        _state: object, _env: object, args: list[str], **_kwargs: object
    ) -> object:
        events.append("docker " + " ".join(args))
        if args[:2] == ["network", "inspect"]:
            return completed(
                stdout=json.dumps(
                    [
                        {
                            "Labels": {
                                "pinpoint.remote-supabase-pilot": expected.project_id
                            }
                        }
                    ]
                )
            )
        return completed()

    monkeypatch.setattr(pilot, "docker_run", docker_call)
    monkeypatch.setattr(
        pilot.subprocess,
        "run",
        lambda args, **_kwargs: (
            events.append("supabase " + " ".join(args)) or completed()
        ),
    )
    monkeypatch.setattr(
        pilot, "stop_tunnel", lambda _root, _state: events.append("stop tunnel")
    )
    monkeypatch.setattr(
        pilot,
        "release_remote_lease",
        lambda project, slot: events.append(f"release {project} {slot}"),
    )

    assert pilot.destroy(tmp_path) == 0
    assert events[0].startswith("docker network inspect")
    assert any("stop --workdir" in event for event in events)
    assert "docker volume rm owned-db" in events
    assert f"docker network rm {expected.network_name}" in events
    assert events[-1] == f"release {expected.project_id} {expected.remote_slot}"
    assert not pilot.state_path(tmp_path).exists()


def test_destroy_refuses_foreign_network_before_stopping_containers(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    expected = state(tmp_path)
    pilot.write_state(tmp_path, expected)
    lease = pilot.RemoteLease(expected.project_id, expected.remote_slot, True, "/lease")
    monkeypatch.setattr(
        pilot,
        "read_local_identity",
        lambda _root: (expected.project_id, expected.local, {}, "abc"),
    )
    monkeypatch.setattr(pilot, "remote_lease", lambda *_args: lease)
    monkeypatch.setattr(
        pilot,
        "render_runtime_config",
        lambda *_args: (tmp_path, expected.config_digest),
    )
    monkeypatch.setattr(pilot, "remote_uid", lambda: 1000)
    monkeypatch.setattr(pilot, "is_owned_tunnel", lambda _state: True)
    monkeypatch.setattr(pilot, "child_environment", lambda *_args: {})
    monkeypatch.setattr(pilot, "verify_remote_docker", lambda *_args: "Docker")
    monkeypatch.setattr(
        pilot,
        "docker_run",
        lambda *_args, **_kwargs: completed(
            stdout=json.dumps([{"Labels": {"pinpoint.remote-supabase-pilot": "other"}}])
        ),
    )
    stopped: list[object] = []
    monkeypatch.setattr(
        pilot.subprocess, "run", lambda *_args, **_kwargs: stopped.append(1)
    )

    with pytest.raises(pilot.PilotError, match="owner label"):
        pilot.destroy(tmp_path)
    assert stopped == []
    assert pilot.state_path(tmp_path).exists()

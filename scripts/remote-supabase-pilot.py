#!/usr/bin/env python3
"""Operate the Mac-to-Bazzite Supabase development pilot.

The repository, Supabase CLI, migrations, seeds, Next.js, and browser stay on
the Mac. The CLI reaches Bazzite's rootless Docker API through an SSH-forwarded
Unix socket, while service-port forwards preserve this worktree's generated
localhost URLs. No global Docker context is changed and no local Supabase
fallback exists.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shlex
import signal
import socket
import stat
import subprocess
import sys
import time
import tomllib
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass, replace
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

REMOTE_HOST = "bazzite"
REMOTE_LEASE_ROOT = "/var/home/froeht/.local/state/pinpoint/remote-supabase-docker"
REMOTE_MANIFEST = "/var/home/froeht/.config/pinpoint/worktree-slots.json"
REMOTE_DOCKER_BIN = "/var/home/froeht/.local/share/remote-supabase-docker/bin/docker"
REMOTE_DOCKER_ROOT = "/var/home/froeht/.local/share/docker"
STATE_RELATIVE_PATH = Path(".agent/tmp/remote-supabase-docker-pilot/state.json")
RUNTIME_RELATIVE_PATH = Path(".agent/tmp/remote-supabase-docker-pilot/runtime")
LOG_RELATIVE_PATH = Path(".agent/tmp/remote-supabase-docker-pilot/tunnel.log")
SUPABASE_HOME_RELATIVE_PATH = Path(
    ".agent/tmp/remote-supabase-docker-pilot/supabase-home"
)
MAX_SLOT = 96

BASE_PORT_APP = 3000
BASE_PORT_API = 54321
BASE_PORT_DB = 54322
BASE_PORT_SHADOW = 54320
BASE_PORT_POOLER = 54329
BASE_PORT_INBUCKET = 54324
BASE_PORT_SMTP = 54325
BASE_PORT_POP3 = 54326

SSH_OPTIONS = (
    "-S",
    "none",
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=10",
)

STATUS_UNREACHABLE = 2
STATUS_DOCKER_UNREACHABLE = 3
STATUS_IDENTITY_ERROR = 4
STATUS_REMOTE_UNHEALTHY = 5
STATUS_TUNNEL_DOWN = 6
STATUS_TUNNEL_BROKEN = 7


class PilotError(RuntimeError):
    """A user-actionable pilot lifecycle failure."""


@dataclass(frozen=True)
class Ports:
    app: int
    api: int
    db: int
    shadow: int
    pooler: int
    inbucket: int
    smtp: int
    pop3: int

    @classmethod
    def for_slot(cls, slot: int) -> Ports:
        offset = slot * 100
        return cls(
            app=BASE_PORT_APP + slot * 10,
            api=BASE_PORT_API + offset,
            db=BASE_PORT_DB + offset,
            shadow=BASE_PORT_SHADOW + offset,
            pooler=BASE_PORT_POOLER + offset,
            inbucket=BASE_PORT_INBUCKET + offset,
            smtp=BASE_PORT_SMTP + offset,
            pop3=BASE_PORT_POP3 + offset,
        )


@dataclass(frozen=True)
class RemoteLease:
    project_id: str
    slot: int
    bootstrap_complete: bool
    lease_path: str


@dataclass(frozen=True)
class PilotState:
    tunnel_pid: int
    tunnel_argv: tuple[str, ...]
    project_id: str
    remote_slot: int
    network_name: str
    docker_socket_path: str
    local_socket_path: str
    local: Ports
    remote: Ports
    local_commit: str
    config_digest: str
    forwards: tuple[tuple[int, int], ...]


REMOTE_LEASE_SCRIPT = r"""
import fcntl
import json
import os
import re
import socket
import sys
from pathlib import Path

BASES = {
    "api": 54321,
    "db": 54322,
    "shadow": 54320,
    "pooler": 54329,
    "inbucket": 54324,
    "smtp": 54325,
    "pop3": 54326,
}
MAX_SLOT = 96
action, project_id, manifest_raw, lease_root_raw, forbidden_raw = sys.argv[1:6]
if re.fullmatch(r"pinpoint-[a-z0-9-]+", project_id) is None:
    raise SystemExit("invalid project id")
manifest = Path(manifest_raw)
lease_root = Path(lease_root_raw)
lease_dir = lease_root / project_id
lease_file = lease_dir / "lease.json"
forbidden = {
    int(value) for value in forbidden_raw.split(",") if value and value != "-"
}

manifest.parent.mkdir(parents=True, exist_ok=True)
lease_root.mkdir(parents=True, exist_ok=True)
os.chmod(lease_root, 0o700)
if not manifest.exists():
    manifest.write_text('{"version": 1, "slots": {}}\n')

def read_json(path, default):
    try:
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError, TypeError):
        return default

def ports_available(slot):
    sockets = []
    try:
        for base in BASES.values():
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sockets.append(sock)
            try:
                sock.bind(("127.0.0.1", base + slot * 100))
            except OSError:
                return False
        return True
    finally:
        for sock in sockets:
            sock.close()

def write_lease(data):
    lease_dir.mkdir(parents=True, exist_ok=True)
    os.chmod(lease_dir, 0o700)
    tmp = lease_file.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n")
    os.chmod(tmp, 0o600)
    tmp.replace(lease_file)

with manifest.open("r+") as handle:
    fcntl.flock(handle, fcntl.LOCK_EX)
    try:
        try:
            payload = json.loads(handle.read())
            slots = payload.get("slots", {})
            if not isinstance(slots, dict):
                slots = {}
        except (json.JSONDecodeError, TypeError):
            slots = {}
        slots = {path: int(slot) for path, slot in slots.items() if Path(path).is_dir()}

        lease = read_json(lease_file, None)
        if lease is not None:
            if lease.get("project_id") != project_id:
                raise SystemExit("lease project identity mismatch")
            slot = int(lease["slot"])
            conflicts = [path for path, value in slots.items() if value == slot and path != str(lease_dir)]
            if conflicts:
                raise SystemExit(f"lease slot {slot} is owned by {conflicts[0]}")
            slots[str(lease_dir)] = slot
        elif action == "reserve":
            used = set(slots.values())
            slot = next(
                (
                    candidate
                    for candidate in range(1, MAX_SLOT + 1)
                    if candidate not in used
                    and candidate not in forbidden
                    and ports_available(candidate)
                ),
                None,
            )
            if slot is None:
                raise SystemExit("no free remote port slot")
            lease = {
                "version": 1,
                "kind": "remote-supabase-docker-pilot",
                "project_id": project_id,
                "slot": slot,
                "bootstrap_complete": False,
            }
            write_lease(lease)
            slots[str(lease_dir)] = slot
        else:
            raise SystemExit("pilot lease does not exist")

        if action == "mark-bootstrapped":
            lease["bootstrap_complete"] = True
            write_lease(lease)
        elif action not in {"reserve", "get"}:
            raise SystemExit(f"unsupported action: {action}")

        handle.seek(0)
        handle.truncate()
        handle.write(json.dumps({"version": 1, "slots": slots}, indent=2) + "\n")
        handle.flush()
        os.fsync(handle.fileno())
    finally:
        fcntl.flock(handle, fcntl.LOCK_UN)

lease["lease_path"] = str(lease_dir)
print(json.dumps(lease))
"""


def repo_root() -> Path:
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        check=True,
        capture_output=True,
        text=True,
    )
    return Path(result.stdout.strip())


def ensure_private_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    path.chmod(0o700)


def parse_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line.removeprefix("export ")
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        values[key.strip()] = value
    return values


def port_from_url(value: str, name: str) -> int:
    port = urlparse(value).port
    if port is None:
        raise PilotError(f"{name} has no port: {value}")
    return port


def local_ports_from_env(values: dict[str, str]) -> Ports:
    required = (
        "PORT",
        "NEXT_PUBLIC_SUPABASE_URL",
        "POSTGRES_URL",
        "INBUCKET_PORT",
        "INBUCKET_SMTP_PORT",
    )
    missing = [name for name in required if not values.get(name)]
    if missing:
        raise PilotError(f"missing generated environment values: {', '.join(missing)}")
    api = port_from_url(values["NEXT_PUBLIC_SUPABASE_URL"], "Supabase URL")
    db = port_from_url(values["POSTGRES_URL"], "Postgres URL")
    return Ports(
        app=int(values["PORT"]),
        api=api,
        db=db,
        shadow=db - 2,
        pooler=db + 7,
        inbucket=int(values["INBUCKET_PORT"]),
        smtp=int(values["INBUCKET_SMTP_PORT"]),
        pop3=int(values["INBUCKET_PORT"]) + 2,
    )


def read_local_identity(root: Path) -> tuple[str, Ports, dict[str, str], str]:
    config_path = root / "supabase/config.toml"
    env_path = root / ".env.local"
    if not config_path.exists() or not env_path.exists():
        raise PilotError("generated supabase/config.toml and .env.local are required")
    config_text = config_path.read_text()
    if "AUTO-GENERATED" not in config_text:
        raise PilotError("supabase/config.toml is not the generated worktree config")
    if config_path.stat().st_mode & stat.S_IWUSR:
        raise PilotError("generated supabase/config.toml must remain read-only")
    config = tomllib.loads(config_text)
    project_id = config.get("project_id")
    if (
        not isinstance(project_id, str)
        or re.fullmatch(r"pinpoint-[a-z0-9-]+", project_id) is None
    ):
        raise PilotError(f"invalid pinned project_id: {project_id!r}")
    env_values = parse_env(env_path)
    local = local_ports_from_env(env_values)
    site_url = env_values.get("NEXT_PUBLIC_SITE_URL")
    if site_url != f"http://localhost:{local.app}":
        raise PilotError("NEXT_PUBLIC_SITE_URL does not match the generated app port")
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    )
    return project_id, local, env_values, result.stdout.strip()


def set_toml_value(content: str, section: str, key: str, rendered: str) -> str:
    lines = content.splitlines()
    current = ""
    replaced = False
    for index, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            current = stripped[1:-1]
            continue
        if current == section and re.match(rf"^{re.escape(key)}\s*=", stripped):
            indent = line[: len(line) - len(line.lstrip())]
            lines[index] = f"{indent}{key} = {rendered}"
            replaced = True
            break
    if not replaced:
        raise PilotError(f"runtime config is missing [{section}] {key}")
    return "\n".join(lines) + "\n"


def render_runtime_config(
    root: Path, project_id: str, local: Ports, remote: Ports
) -> tuple[Path, str]:
    content = (root / "supabase/config.toml").read_text()
    config = tomllib.loads(content)
    if config.get("project_id") != project_id:
        raise PilotError("generated config project identity changed")
    replacements = (
        ("api", "port", remote.api),
        ("db", "port", remote.db),
        ("db", "shadow_port", remote.shadow),
        ("db.pooler", "port", remote.pooler),
        ("inbucket", "port", remote.inbucket),
        ("inbucket", "smtp_port", remote.smtp),
        ("inbucket", "pop3_port", remote.pop3),
    )
    for section, key, value in replacements:
        content = set_toml_value(content, section, key, str(value))
    callback = f'"http://localhost:{local.api}/auth/v1/callback"'
    content = set_toml_value(content, "auth.external.google", "redirect_uri", callback)
    content = set_toml_value(content, "auth.external.discord", "redirect_uri", callback)

    parsed = tomllib.loads(content)
    if parsed["auth"]["site_url"] != f"http://localhost:{local.app}":
        raise PilotError("runtime auth site_url must remain Mac-facing")
    if parsed["studio"]["enabled"] or parsed["edge_runtime"]["enabled"]:
        raise PilotError(
            "remote-daemon pilot requires Studio and Edge Runtime disabled"
        )

    runtime_root = root / RUNTIME_RELATIVE_PATH
    config_dir = runtime_root / "supabase"
    ensure_private_directory(runtime_root.parent)
    ensure_private_directory(runtime_root)
    ensure_private_directory(config_dir)
    config_path = config_dir / "config.toml"
    config_path.write_text(content)
    config_path.chmod(0o600)
    digest = hashlib.sha256(content.encode()).hexdigest()
    return runtime_root, digest


def run_remote(
    args: list[str],
    *,
    check: bool = True,
    input_text: str | None = None,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["ssh", *SSH_OPTIONS, REMOTE_HOST, *args],
        check=check,
        capture_output=True,
        text=True,
        input=input_text,
    )


def remote_uid() -> int:
    result = run_remote(["id", "-u"])
    try:
        return int(result.stdout.strip())
    except ValueError as error:
        raise PilotError("Bazzite returned an invalid user id") from error


def run_remote_docker(
    uid: int, args: list[str], *, check: bool = True
) -> subprocess.CompletedProcess[str]:
    command = shlex.join(
        [
            "env",
            f"DOCKER_HOST=unix:///run/user/{uid}/docker.sock",
            REMOTE_DOCKER_BIN,
            *args,
        ]
    )
    return run_remote(["bash", "-lc", shlex.quote(command)], check=check)


def remote_lease(
    action: str, project_id: str, forbidden_slots: set[int] | None = None
) -> RemoteLease:
    forbidden = (
        ",".join(str(value) for value in sorted(forbidden_slots or set())) or "-"
    )
    result = run_remote(
        [
            "python3",
            "-",
            action,
            project_id,
            REMOTE_MANIFEST,
            REMOTE_LEASE_ROOT,
            forbidden,
        ],
        input_text=REMOTE_LEASE_SCRIPT,
    )
    try:
        payload = json.loads(result.stdout)
        return RemoteLease(
            project_id=str(payload["project_id"]),
            slot=int(payload["slot"]),
            bootstrap_complete=bool(payload["bootstrap_complete"]),
            lease_path=str(payload["lease_path"]),
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise PilotError(f"invalid Bazzite lease response: {error}") from error


def port_is_available(port: int) -> bool:
    sockets: list[socket.socket] = []
    try:
        for family, address in (
            (socket.AF_INET, ("127.0.0.1", port)),
            (socket.AF_INET6, ("::1", port)),
        ):
            sock = socket.socket(family, socket.SOCK_STREAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sockets.append(sock)
            try:
                sock.bind(address)
            except OSError:
                return False
        return True
    finally:
        for sock in sockets:
            sock.close()


def forbidden_remote_slots() -> set[int]:
    forbidden: set[int] = set()
    for slot in range(1, MAX_SLOT + 1):
        ports = Ports.for_slot(slot)
        if not all(
            port_is_available(port)
            for port in (ports.api, ports.db, ports.inbucket, ports.smtp)
        ):
            forbidden.add(slot)
    return forbidden


def build_forwards(local: Ports, remote: Ports) -> tuple[tuple[int, int], ...]:
    forwards = {
        (local.api, remote.api),
        (local.db, remote.db),
        (local.inbucket, remote.inbucket),
        (local.smtp, remote.smtp),
        # Stable CLI health and status resolve remote-daemon ports against the
        # Mac because SUPABASE_SERVICES_HOSTNAME=localhost.
        (remote.api, remote.api),
        (remote.db, remote.db),
        (remote.inbucket, remote.inbucket),
        (remote.smtp, remote.smtp),
    }
    return tuple(sorted(forwards))


def state_path(root: Path) -> Path:
    return root / STATE_RELATIVE_PATH


def write_state(root: Path, state: PilotState) -> None:
    path = state_path(root)
    ensure_private_directory(path.parent)
    data = asdict(state)
    data["tunnel_argv"] = list(state.tunnel_argv)
    data["forwards"] = [list(pair) for pair in state.forwards]
    path.write_text(json.dumps(data, indent=2) + "\n")
    path.chmod(0o600)


def read_state(root: Path) -> PilotState | None:
    path = state_path(root)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
        return PilotState(
            tunnel_pid=int(data["tunnel_pid"]),
            tunnel_argv=tuple(str(value) for value in data["tunnel_argv"]),
            project_id=str(data["project_id"]),
            remote_slot=int(data["remote_slot"]),
            network_name=str(data["network_name"]),
            docker_socket_path=str(data["docker_socket_path"]),
            local_socket_path=str(data["local_socket_path"]),
            local=Ports(**data["local"]),
            remote=Ports(**data["remote"]),
            local_commit=str(data["local_commit"]),
            config_digest=str(data["config_digest"]),
            forwards=tuple((int(pair[0]), int(pair[1])) for pair in data["forwards"]),
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise PilotError(f"invalid pilot state file {path}: {error}") from error


def local_socket_path(project_id: str) -> str:
    digest = hashlib.sha256(project_id.encode()).hexdigest()[:12]
    return f"/private/tmp/pinpoint-remote-docker-{digest}.sock"


def network_name(project_id: str) -> str:
    digest = hashlib.sha256(project_id.encode()).hexdigest()[:10]
    return f"pinpoint-remote-supabase-docker-{digest}"


def build_tunnel_argv(state: PilotState) -> tuple[str, ...]:
    command = [
        "ssh",
        *SSH_OPTIONS,
        "-N",
        "-T",
        "-o",
        "ExitOnForwardFailure=yes",
        "-o",
        "ServerAliveInterval=30",
        "-o",
        "ServerAliveCountMax=3",
        "-o",
        "StreamLocalBindUnlink=yes",
        "-L",
        f"{state.local_socket_path}:{state.docker_socket_path}",
    ]
    for local_port, remote_port in state.forwards:
        command.extend(("-L", f"{local_port}:127.0.0.1:{remote_port}"))
    command.append(REMOTE_HOST)
    return tuple(command)


def process_argv(pid: int) -> tuple[str, ...]:
    if pid <= 1:
        return ()
    result = subprocess.run(
        ["ps", "-ww", "-p", str(pid), "-o", "command="],
        check=False,
        capture_output=True,
        text=True,
    )
    command = result.stdout.strip()
    if not command:
        return ()
    try:
        return tuple(shlex.split(command))
    except ValueError:
        return ()


def is_owned_tunnel(state: PilotState) -> bool:
    actual = process_argv(state.tunnel_pid)
    expected = state.tunnel_argv
    if not actual or not expected:
        return False
    return Path(actual[0]).name == Path(expected[0]).name and actual[1:] == expected[1:]


def start_tunnel(root: Path, provisional: PilotState) -> PilotState:
    unavailable = sorted(
        local for local, _remote in provisional.forwards if not port_is_available(local)
    )
    if unavailable:
        raise PilotError(
            f"local tunnel ports already in use: {', '.join(map(str, unavailable))}"
        )
    socket_path = Path(provisional.local_socket_path)
    if socket_path.exists():
        socket_path.unlink()
    argv = build_tunnel_argv(provisional)
    log_path = root / LOG_RELATIVE_PATH
    ensure_private_directory(log_path.parent)
    log_path.touch(mode=0o600, exist_ok=True)
    log_path.chmod(0o600)
    with log_path.open("ab") as log:
        process = subprocess.Popen(
            argv,
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=log,
            start_new_session=True,
        )
    state = replace(provisional, tunnel_pid=process.pid, tunnel_argv=argv)
    write_state(root, state)
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise PilotError(f"SSH tunnel exited with status {process.returncode}")
        if socket_path.exists():
            return state
        time.sleep(0.1)
    raise PilotError("SSH tunnel did not expose the Docker socket within 15s")


def stop_tunnel(root: Path, state: PilotState) -> None:
    if is_owned_tunnel(state):
        os.kill(state.tunnel_pid, signal.SIGTERM)
        for _attempt in range(50):
            if not process_argv(state.tunnel_pid):
                break
            time.sleep(0.1)
        if process_argv(state.tunnel_pid):
            raise PilotError(f"owned tunnel pid {state.tunnel_pid} did not stop")
        print(f"Stopped pilot tunnel pid {state.tunnel_pid}.")
    elif state.tunnel_pid:
        print("Pilot tunnel was already stopped; no unrelated process was touched.")
    socket_path = Path(state.local_socket_path)
    if socket_path.exists():
        socket_path.unlink()
    write_state(root, replace(state, tunnel_pid=0, tunnel_argv=()))


def child_environment(
    root: Path, env_values: dict[str, str], state: PilotState
) -> dict[str, str]:
    env = os.environ.copy()
    env.update(env_values)
    env.pop("DOCKER_CONTEXT", None)
    supabase_home = root / SUPABASE_HOME_RELATIVE_PATH
    ensure_private_directory(supabase_home)
    env.update(
        {
            "DOCKER_HOST": f"unix://{state.local_socket_path}",
            "DOCKER_SSH_COMMAND": "ssh -S none -o BatchMode=yes -o ConnectTimeout=10",
            "SUPABASE_SERVICES_HOSTNAME": "localhost",
            "SUPABASE_TELEMETRY_DISABLED": "1",
            "SUPABASE_HOME": str(supabase_home),
        }
    )
    return env


def supabase_command(*args: str) -> list[str]:
    return ["mise", "exec", "--", "supabase", *args]


def verify_locked_cli(root: Path) -> str:
    expected = tomllib.loads((root / "mise.toml").read_text())["tools"]["supabase"]
    base_env = os.environ.copy()
    supabase_home = root / SUPABASE_HOME_RELATIVE_PATH
    ensure_private_directory(supabase_home)
    base_env["SUPABASE_HOME"] = str(supabase_home)
    base_env["SUPABASE_TELEMETRY_DISABLED"] = "1"
    result = subprocess.run(
        supabase_command("--version"),
        cwd=root,
        env=base_env,
        check=True,
        capture_output=True,
        text=True,
    )
    actual = result.stdout.strip().removeprefix("v")
    if actual != expected:
        raise PilotError(
            f"Supabase CLI version {actual} does not match lock {expected}"
        )
    return actual


def docker_run(
    state: PilotState,
    env: dict[str, str],
    args: list[str],
    *,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["docker", *args],
        check=check,
        capture_output=True,
        text=True,
        env=env,
    )


def verify_remote_docker(state: PilotState, env: dict[str, str], uid: int) -> str:
    info_args = [
        "info",
        "--format",
        "{{.ServerVersion}}|{{json .SecurityOptions}}|{{.DockerRootDir}}",
    ]
    result = docker_run(
        state,
        env,
        info_args,
    )
    identity = result.stdout.strip()
    direct = run_remote_docker(uid, info_args, check=False)
    hostname = run_remote(["hostname"], check=False)
    try:
        version, security_raw, docker_root = identity.split("|", 2)
        security = json.loads(security_raw)
    except (ValueError, json.JSONDecodeError) as error:
        raise PilotError(f"unexpected remote Docker identity: {identity!r}") from error
    if (
        not version
        or not isinstance(security, list)
        or "name=rootless" not in security
        or docker_root != REMOTE_DOCKER_ROOT
        or direct.returncode != 0
        or direct.stdout.strip() != identity
        or hostname.stdout.strip() != REMOTE_HOST
    ):
        raise PilotError(
            f"remote container server is not Bazzite rootless Docker: {identity!r}"
        )
    return f"Docker {version} ({docker_root})"


def ensure_remote_network(state: PilotState, env: dict[str, str]) -> None:
    inspect = docker_run(
        state, env, ["network", "inspect", state.network_name], check=False
    )
    if inspect.returncode == 0:
        payload = json.loads(inspect.stdout)
        labels = payload[0].get("Labels") or payload[0].get("labels") or {}
        if labels.get("pinpoint.remote-supabase-pilot") != state.project_id:
            raise PilotError(f"network {state.network_name} has the wrong owner label")
        options = payload[0].get("Options") or {}
        if options.get("com.docker.network.bridge.host_binding_ipv4") != "127.0.0.1":
            raise PilotError(f"network {state.network_name} is not loopback-bound")
        return
    docker_run(
        state,
        env,
        [
            "network",
            "create",
            "--label",
            f"pinpoint.remote-supabase-pilot={state.project_id}",
            "--opt",
            "com.docker.network.bridge.host_binding_ipv4=127.0.0.1",
            state.network_name,
        ],
    )


def project_volumes(state: PilotState, env: dict[str, str]) -> tuple[str, ...]:
    result = docker_run(
        state,
        env,
        [
            "volume",
            "ls",
            "--filter",
            f"label=com.supabase.cli.project={state.project_id}",
            "--format",
            "{{.Name}}",
        ],
    )
    return tuple(line for line in result.stdout.splitlines() if line)


def wait_for_local_services(local: Ports, timeout: float = 30) -> None:
    deadline = time.monotonic() + timeout
    api_url = f"http://localhost:{local.api}/auth/v1/health"
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(api_url, timeout=1) as response:
                api_ready = response.status == 200
        except (urllib.error.URLError, TimeoutError):
            api_ready = False
        db_ready = (
            subprocess.run(
                [
                    "pg_isready",
                    "-h",
                    "localhost",
                    "-p",
                    str(local.db),
                    "-t",
                    "1",
                ],
                check=False,
                capture_output=True,
            ).returncode
            == 0
        )
        if api_ready and db_ready:
            return
        time.sleep(0.25)
    raise PilotError("Supabase API or Postgres did not become ready through the tunnel")


def run_project_command(root: Path, env: dict[str, str], script: str) -> None:
    subprocess.run(["pnpm", "run", script], cwd=root, env=env, check=True)


def safe_cli_failure(output: str, env_values: dict[str, str]) -> str:
    for value in env_values.values():
        if len(value) >= 8:
            output = output.replace(value, "[redacted]")
    sensitive_keys = (
        "PUBLISHABLE_KEY",
        "SECRET_KEY",
        "JWT_SECRET",
        "ANON_KEY",
        "SERVICE_ROLE_KEY",
    )
    lines = [
        "[Supabase credential output omitted]"
        if any(key in line for key in sensitive_keys)
        else line
        for line in output.splitlines()
    ]
    return "\n".join(lines[-20:]).strip()


def remote_container_snapshot(project_id: str, uid: int) -> list[dict[str, Any]]:
    result = run_remote_docker(
        uid,
        [
            "ps",
            "-a",
            "--filter",
            f"label=com.supabase.cli.project={project_id}",
            "--format",
            "{{json .}}",
        ],
    )
    try:
        payload = [json.loads(line) for line in result.stdout.splitlines() if line]
    except json.JSONDecodeError as error:
        raise PilotError("Bazzite returned invalid container status") from error
    if any(not isinstance(container, dict) for container in payload):
        raise PilotError("Bazzite returned an unexpected container status shape")
    return payload


def remote_health(remote: Ports) -> tuple[bool, str]:
    db_probe = (
        "import socket; "
        f"socket.create_connection(('127.0.0.1', {remote.db}), timeout=2).close()"
    )
    command = (
        f"curl -fsS --max-time 2 http://127.0.0.1:{remote.api}/auth/v1/health >/dev/null "
        f"&& python3 -c {shlex.quote(db_probe)}"
    )
    result = run_remote(["bash", "-lc", shlex.quote(command)], check=False)
    if result.returncode == 0:
        return True, "healthy"
    detail = (result.stderr or result.stdout).strip()
    return False, detail or "API or Postgres readiness probe failed"


def local_health(local: Ports) -> tuple[bool, str]:
    try:
        with urllib.request.urlopen(
            f"http://127.0.0.1:{local.api}/auth/v1/health", timeout=5
        ) as response:
            if response.status != 200:
                return False, f"API returned {response.status}"
    except (urllib.error.URLError, TimeoutError) as error:
        return False, str(error)
    db = subprocess.run(
        ["pg_isready", "-h", "127.0.0.1", "-p", str(local.db), "-t", "5"],
        check=False,
        capture_output=True,
        text=True,
    )
    if db.returncode != 0:
        return False, db.stderr.strip() or db.stdout.strip() or "Postgres probe failed"
    return True, "healthy"


def validate_state_identity(
    state: PilotState, project_id: str, lease: RemoteLease, digest: str, uid: int
) -> None:
    expected_remote = Ports.for_slot(lease.slot)
    if state.project_id != project_id:
        raise PilotError("local state project identity mismatch")
    if state.remote_slot != lease.slot or state.remote != expected_remote:
        raise PilotError("local state does not match the Bazzite port lease")
    if state.config_digest != digest:
        raise PilotError("runtime config changed since the tunnel was recorded")
    if state.docker_socket_path != f"/run/user/{uid}/docker.sock":
        raise PilotError("local state does not point to Bazzite rootless Docker")
    if state.network_name != network_name(project_id):
        raise PilotError("local state network identity mismatch")


def make_provisional_state(
    project_id: str,
    local: Ports,
    lease: RemoteLease,
    local_commit: str,
    config_digest: str,
    uid: int,
) -> PilotState:
    remote = Ports.for_slot(lease.slot)
    state = PilotState(
        tunnel_pid=0,
        tunnel_argv=(),
        project_id=project_id,
        remote_slot=lease.slot,
        network_name=network_name(project_id),
        docker_socket_path=f"/run/user/{uid}/docker.sock",
        local_socket_path=local_socket_path(project_id),
        local=local,
        remote=remote,
        local_commit=local_commit,
        config_digest=config_digest,
        forwards=build_forwards(local, remote),
    )
    return replace(state, tunnel_argv=build_tunnel_argv(state))


def start(root: Path) -> int:
    project_id, local, env_values, local_commit = read_local_identity(root)
    cli_version = verify_locked_cli(root)

    existing_state = read_state(root)

    uid = remote_uid()
    try:
        lease = remote_lease("get", project_id)
    except subprocess.CalledProcessError:
        lease = remote_lease("reserve", project_id, forbidden_remote_slots())
    remote = Ports.for_slot(lease.slot)
    runtime_root, digest = render_runtime_config(root, project_id, local, remote)
    provisional = make_provisional_state(
        project_id, local, lease, local_commit, digest, uid
    )
    if existing_state:
        validate_state_identity(existing_state, project_id, lease, digest, uid)

    if existing_state and is_owned_tunnel(existing_state):
        state = existing_state
        print(f"Reusing pilot tunnel pid {state.tunnel_pid}.")
    else:
        state = start_tunnel(root, provisional)
    env = child_environment(root, env_values, state)
    identity = verify_remote_docker(state, env, uid)
    ensure_remote_network(state, env)

    volumes_before = project_volumes(state, env)
    if lease.bootstrap_complete and not volumes_before:
        raise PilotError(
            "bootstrap marker exists but the pilot database volume is missing"
        )

    start_result = subprocess.run(
        supabase_command(
            "start",
            "--workdir",
            str(runtime_root),
            "--network-id",
            state.network_name,
        ),
        cwd=root,
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )
    if start_result.returncode != 0:
        detail = safe_cli_failure(start_result.stdout + start_result.stderr, env_values)
        raise PilotError(detail or f"supabase start exited {start_result.returncode}")
    print("Remote Supabase containers started through the Docker tunnel.")
    wait_for_local_services(local)
    run_project_command(root, env, "db:migrate")
    if not lease.bootstrap_complete:
        run_project_command(root, env, "db:fast-reset")
        lease = remote_lease("mark-bootstrapped", project_id)
    wait_for_local_services(local)

    print(f"Pilot ready with Supabase CLI {cli_version} against {identity}.")
    print(f"Browser:  http://localhost:{local.app}")
    print(f"API:      http://localhost:{local.api}")
    print(f"Postgres: localhost:{local.db}")
    print(f"Mailpit:  http://localhost:{local.inbucket}")
    print(
        f"Remote project {project_id}; slot {lease.slot}; tunnel pid {state.tunnel_pid}."
    )
    return 0


def status(root: Path) -> int:
    reachable = run_remote(["true"], check=False)
    if reachable.returncode != 0:
        print("UNREACHABLE: Bazzite SSH connection failed")
        return STATUS_UNREACHABLE

    uid = remote_uid()
    docker = run_remote_docker(
        uid, ["info", "--format", "{{.ServerVersion}}"], check=False
    )
    if docker.returncode != 0:
        print("DOCKER UNREACHABLE: Bazzite rootless Docker is unavailable")
        return STATUS_DOCKER_UNREACHABLE

    try:
        project_id, local, _env_values, _commit = read_local_identity(root)
        lease = remote_lease("get", project_id)
        remote = Ports.for_slot(lease.slot)
        _runtime, digest = render_runtime_config(root, project_id, local, remote)
        state = read_state(root)
        if state is not None:
            validate_state_identity(state, project_id, lease, digest, uid)
        containers = remote_container_snapshot(project_id, uid)
    except (PilotError, subprocess.CalledProcessError) as error:
        print(f"IDENTITY ERROR: {error}")
        return STATUS_IDENTITY_ERROR

    healthy, detail = remote_health(remote)
    if not healthy:
        print(f"REMOTE UNHEALTHY: {detail}")
        print(f"Project {project_id}; remote slot {lease.slot}.")
        return STATUS_REMOTE_UNHEALTHY

    if state is None or not is_owned_tunnel(state):
        print("TUNNEL DOWN: Bazzite Supabase is healthy; run start")
        print(f"Project {project_id}; remote slot {lease.slot}.")
        return STATUS_TUNNEL_DOWN

    local_ready, detail = local_health(local)
    if not local_ready:
        print(f"TUNNEL BROKEN: {detail}")
        return STATUS_TUNNEL_BROKEN

    identities = []
    for container in containers:
        names = container.get("Names") or container.get("names") or []
        name = names[0] if isinstance(names, list) and names else str(names)
        ports = container.get("Ports") or container.get("ports") or ""
        identities.append(f"{name} [{ports}]")
    print(
        f"READY: http://localhost:{local.app}; project {project_id}; "
        f"remote slot {lease.slot}; tunnel pid {state.tunnel_pid}"
    )
    if identities:
        print("Containers: " + "; ".join(identities))
    return 0


def stop(root: Path) -> int:
    project_id, local, env_values, local_commit = read_local_identity(root)
    lease = remote_lease("get", project_id)
    remote = Ports.for_slot(lease.slot)
    runtime_root, digest = render_runtime_config(root, project_id, local, remote)
    state = read_state(root)
    if state is None:
        uid = remote_uid()
        state = make_provisional_state(
            project_id, local, lease, local_commit, digest, uid
        )
    else:
        uid = remote_uid()
        validate_state_identity(state, project_id, lease, digest, uid)

    if not is_owned_tunnel(state):
        state = start_tunnel(root, replace(state, tunnel_pid=0, tunnel_argv=()))
    env = child_environment(root, env_values, state)
    verify_remote_docker(state, env, uid)
    result = subprocess.run(
        supabase_command(
            "stop",
            "--workdir",
            str(runtime_root),
            "--project-id",
            project_id,
        ),
        cwd=root,
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )
    combined = (result.stdout + result.stderr).strip()
    if result.returncode != 0 and "not running" not in combined.lower():
        raise PilotError(combined or f"supabase stop exited {result.returncode}")
    if combined:
        print(combined)
    stop_tunnel(root, state)
    print("Stopped pilot containers; database volumes and remote port lease preserved.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=("start", "status", "stop"))
    args = parser.parse_args()
    root = repo_root()
    try:
        if args.operation == "start":
            return start(root)
        if args.operation == "status":
            return status(root)
        return stop(root)
    except (PilotError, subprocess.CalledProcessError, OSError, ValueError) as error:
        if isinstance(error, subprocess.CalledProcessError):
            detail = (error.stderr or error.stdout or "").strip()
            message = detail or str(error)
        else:
            message = str(error)
        print(f"Error: {message}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

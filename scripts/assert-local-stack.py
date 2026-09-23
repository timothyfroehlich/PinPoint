#!/usr/bin/env python3
"""Fail closed unless this worktree's localhost database is Mac-local Docker."""

import argparse
import json
import os
import subprocess
import sys
import tomllib
from pathlib import Path
from urllib.parse import urlparse

REMOTE_STATE = Path(".agent/tmp/remote-supabase-docker-pilot/state.json")
PROJECT_LABEL = "com.supabase.cli.project"
WORKDIR_LABEL = "com.supabase.cli.workdir"


class LocalStackError(RuntimeError):
    """The requested localhost endpoint is not proved to be this local stack."""


def local_port(value: str, label: str) -> int:
    parsed = urlparse(value)
    if parsed.hostname not in {"localhost", "127.0.0.1", "::1"} or not parsed.port:
        raise LocalStackError(f"{label} must be a localhost URL with an explicit port")
    return parsed.port


def docker_host() -> str:
    # Ignore environment overrides. A remote DOCKER_HOST is never evidence that
    # the database reached through this Mac worktree's localhost is Mac-local.
    env = os.environ.copy()
    env.pop("DOCKER_HOST", None)
    env.pop("DOCKER_CONTEXT", None)
    try:
        result = subprocess.run(
            [
                "docker",
                "context",
                "inspect",
                "--format",
                "{{json .Endpoints.docker.Host}}",
            ],
            capture_output=True,
            text=True,
            check=True,
            timeout=10,
            env=env,
        )
        endpoint = json.loads(result.stdout)
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        raise LocalStackError(
            "the local Docker context could not be inspected"
        ) from error
    if not isinstance(endpoint, str) or not endpoint.startswith("unix:///"):
        raise LocalStackError("the Docker context is not a local Unix socket")
    if Path(endpoint.removeprefix("unix://")).name.startswith(
        "pinpoint-remote-docker-"
    ):
        raise LocalStackError("the Docker context points at the remote pilot tunnel")
    return endpoint


def inspect_container(host: str, name: str) -> dict[str, object]:
    env = os.environ.copy()
    env.pop("DOCKER_HOST", None)
    env.pop("DOCKER_CONTEXT", None)
    try:
        result = subprocess.run(
            ["docker", "--host", host, "inspect", "--type", "container", name],
            capture_output=True,
            text=True,
            check=True,
            timeout=10,
            env=env,
        )
        containers = json.loads(result.stdout)
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        raise LocalStackError(
            f"local Docker container {name} is unavailable"
        ) from error
    if (
        not isinstance(containers, list)
        or len(containers) != 1
        or not isinstance(containers[0], dict)
    ):
        raise LocalStackError(f"local Docker returned invalid identity for {name}")
    return containers[0]


def verify_container(
    host: str,
    root: Path,
    project_id: str,
    service: str,
    internal_port: int,
    local_port_number: int,
) -> None:
    name = f"supabase_{service}_{project_id}"
    container = inspect_container(host, name)
    config = container.get("Config")
    state = container.get("State")
    host_config = container.get("HostConfig")
    if (
        not isinstance(config, dict)
        or not isinstance(state, dict)
        or not isinstance(host_config, dict)
    ):
        raise LocalStackError(f"local Docker returned incomplete identity for {name}")
    labels = config.get("Labels")
    if (
        not isinstance(labels, dict)
        or labels.get(PROJECT_LABEL) != project_id
        or labels.get(WORKDIR_LABEL) != str(root)
        or state.get("Running") is not True
    ):
        raise LocalStackError(f"{name} is not this worktree's running local container")
    bindings = host_config.get("PortBindings")
    published = (
        bindings.get(f"{internal_port}/tcp") if isinstance(bindings, dict) else None
    )
    if not isinstance(published, list) or not any(
        isinstance(binding, dict) and binding.get("HostPort") == str(local_port_number)
        for binding in published
    ):
        raise LocalStackError(f"{name} does not own localhost port {local_port_number}")


def assert_local_stack(root: Path, database_url: str, require_api: bool) -> None:
    root = root.resolve()
    db_port = local_port(database_url, "POSTGRES_URL")
    state_path = root / REMOTE_STATE
    if state_path.exists():
        try:
            tunnel_pid = int(json.loads(state_path.read_text())["tunnel_pid"])
        except (OSError, ValueError, KeyError, TypeError) as error:
            raise LocalStackError(
                "remote tunnel ownership is unclear; refusing local mode"
            ) from error
        if tunnel_pid > 0:
            try:
                os.kill(tunnel_pid, 0)
            except ProcessLookupError:
                pass
            except OSError as error:
                raise LocalStackError(
                    "remote tunnel ownership is unclear; refusing local mode"
                ) from error
            else:
                raise LocalStackError(
                    "the remote pilot tunnel is still running; stop it before using local mode"
                )

    try:
        project_id = tomllib.loads((root / "supabase/config.toml").read_text())[
            "project_id"
        ]
    except (OSError, ValueError, KeyError) as error:
        raise LocalStackError(
            "the pinned worktree project ID is unavailable"
        ) from error
    if not isinstance(project_id, str) or not project_id:
        raise LocalStackError("the pinned worktree project ID is invalid")

    host = docker_host()
    verify_container(host, root, project_id, "db", 5432, db_port)
    if require_api:
        api_port = local_port(
            os.environ.get("NEXT_PUBLIC_SUPABASE_URL", ""), "NEXT_PUBLIC_SUPABASE_URL"
        )
        verify_container(host, root, project_id, "kong", 8000, api_port)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--require-api", action="store_true")
    args = parser.parse_args()
    database_url = (
        os.environ.get("PINPOINT_LOCAL_DB_GUARD_URL")
        or os.environ.get("POSTGRES_URL_NON_POOLING")
        or os.environ.get("POSTGRES_URL", "")
    )
    try:
        assert_local_stack(Path.cwd(), database_url, args.require_api)
    except LocalStackError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

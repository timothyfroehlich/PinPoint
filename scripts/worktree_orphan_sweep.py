#!/usr/bin/env python3
"""
worktree_orphan_sweep.py — find and (optionally) reclaim leaked worktree resources.

Two failure modes accumulate orphans:

1.  `rm -rf <worktree>` (no WorktreeRemove hook fires) leaves the slot
    manifest entry pointing at a missing path and the Supabase Docker
    volumes/containers — labeled `com.supabase.cli.project=pinpoint-*` —
    intact on the host.
2.  Claude in Web sandbox sessions cannot fire local hooks at all, so a
    branch DB started by an earlier local round-trip can outlive the
    sandbox session.

This script reconciles three sources of truth:

- active git worktrees (`git worktree list --porcelain`)
- slot manifest entries (`~/.config/pinpoint/worktree-slots.json`)
- Docker resources with the `com.supabase.cli.project` label whose value
  starts with `pinpoint-` (the prefix `branch_to_project_id` always emits)

Defaults to dry-run; pass `--apply` to actually deallocate orphan slots and
remove orphan Docker containers/volumes.

**Remote backend.** A worktree can run its Supabase stack on another host's
Docker (docs/runbooks/remote-supabase.md). When `PINPOINT_REMOTE_DOCKER_HOST`
is set, the sweep also enumerates that daemon, keeping only projects whose
`com.supabase.cli.workdir` label is a path on this machine and never touching
the remote host's own stacks (Crabbox runners, host-side paths). A remote
project whose workdir is gone and whose project_id has no active worktree is
an orphan. A slot whose worktree is gone is only freed once no remote project
still references that path — otherwise the next worktree to take the slot
would fail `supabase start` with "port is already allocated". When this
machine uses the remote backend but the remote daemon can't be queried, such
slots are UNKNOWN and kept. Without any remote-backend signal the sweep behaves
exactly as it always has.

**Unknown is never zero.** If Docker can't be queried, this script reports the
Docker half of the sweep as UNKNOWN and refuses to reclaim Docker resources —
it never prints `0 volume(s)` for a query it couldn't run. A false zero reads
as "there are none", which is how ~557 MB of orphan volumes accumulated
unnoticed behind the 6-hourly SessionStart nudge (PP-5o7b).
"""

import argparse
import fcntl
import json
import os
import re
import shlex
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from worktree_cleanup import MANIFEST_PATH, deallocate_slot  # noqa: E402
from worktree_setup import branch_to_project_id  # noqa: E402

_PROJECT_ID_LINE_RE = re.compile(r'^project_id\s*=\s*"([^"]+)"')

SUPABASE_PROJECT_LABEL = "com.supabase.cli.project"
SUPABASE_WORKDIR_LABEL = "com.supabase.cli.workdir"

#: Remote-backend settings (docs/runbooks/remote-supabase.md). Only the Docker
#: endpoint is needed to query the remote daemon; the others are signals that
#: this machine uses the remote backend at all.
REMOTE_DOCKER_HOST_ENV = "PINPOINT_REMOTE_DOCKER_HOST"
REMOTE_SUPABASE_HOST_ENV = "PINPOINT_REMOTE_SUPABASE_HOST"
BACKEND_ENV_KEY = "PINPOINT_SUPABASE_BACKEND"

#: The remote host runs its own Supabase stacks for Crabbox runners. They are
#: not this machine's worktrees and must never be reported or removed.
CRABBOX_PROJECT_PREFIX = "pinpoint-runner-crabbox"

#: Remote Docker goes over SSH (several seconds per call); an unreachable host
#: must become UNKNOWN, not a hang. Enumeration shares one budget. Under
#: --quiet it must leave the SessionStart hook's 10 s cap room for the local
#: half, so a slow remote reads as UNKNOWN instead of killing the whole report.
REMOTE_DOCKER_TIMEOUT_SECONDS = 60
REMOTE_QUERY_BUDGET_SECONDS = 120.0
QUIET_REMOTE_QUERY_BUDGET_SECONDS = 7.0

#: Exit status when the Docker half of the sweep could not be enumerated. The
#: SessionStart hook swallows exit codes, but a human (or any future caller)
#: gets a non-zero signal that the report is incomplete.
EXIT_DOCKER_UNKNOWN = 1


def get_active_worktree_branches(repo_dir: Path) -> dict[str, str]:
    """Return {path: branch} for all current git worktrees of repo_dir."""
    try:
        result = subprocess.run(
            ["git", "-C", str(repo_dir), "worktree", "list", "--porcelain"],
            capture_output=True,
            text=True,
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        # Without the worktree list every Supabase project would look orphaned,
        # and --apply would delete live stacks. Stop instead.
        sys.exit(
            f"worktree-orphan-sweep: `git worktree list` failed: {exc.stderr.strip()}"
        )

    worktrees: dict[str, str] = {}
    current_path = ""
    current_branch = ""
    for line in result.stdout.splitlines():
        if line.startswith("worktree "):
            if current_path:
                worktrees[current_path] = current_branch
            current_path = line[len("worktree ") :]
            current_branch = ""
        elif line.startswith("branch refs/heads/"):
            current_branch = line[len("branch refs/heads/") :]
    if current_path:
        worktrees[current_path] = current_branch
    return worktrees


def get_active_project_ids(worktrees: dict[str, str]) -> set[str]:
    """Derive the Supabase project_id for each active worktree.

    Reads `<worktree>/supabase/config.toml` directly when present — that file
    is the authoritative source for the project_id that Supabase containers
    actually use, and it works for detached worktrees and for worktrees whose
    branch was renamed after setup. Falls back to `branch_to_project_id(branch)`
    only when the config.toml is missing and the worktree is on a named branch.

    Worktrees we can't resolve (detached + missing config.toml) are intentionally
    skipped so the caller never deletes a Docker project we don't recognize.
    """
    project_ids: set[str] = set()
    for path_str, branch in worktrees.items():
        config_path = Path(path_str) / "supabase" / "config.toml"
        if config_path.is_file():
            try:
                for line in config_path.read_text().splitlines():
                    match = _PROJECT_ID_LINE_RE.match(line)
                    if match:
                        project_ids.add(match.group(1))
                        break
            except OSError:
                pass
        elif branch:
            project_ids.add(branch_to_project_id(branch))
    return project_ids


def get_orphan_slot_paths() -> list[str]:
    """Read the slot manifest and return paths missing on disk or w/o .git marker.

    Tolerates a corrupted/partial manifest the same way deallocate_slot does —
    a bad JSON shape shouldn't crash the sweep (and make `--apply` unusable).
    """
    if not MANIFEST_PATH.exists():
        return []
    with open(MANIFEST_PATH) as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_SH)
        try:
            raw = f.read()
        finally:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    try:
        data = json.loads(raw)
        slots = data.get("slots", {})
        if not isinstance(slots, dict):
            slots = {}
    except (json.JSONDecodeError, AttributeError):
        print(
            f"Warning: {MANIFEST_PATH} is not valid JSON; treating as empty.",
            file=sys.stderr,
        )
        slots = {}
    orphans: list[str] = []
    for path_str in slots:
        path = Path(path_str)
        if not path.is_dir() or not (path / ".git").exists():
            orphans.append(path_str)
    return orphans


class DockerNotInstalledError(RuntimeError):
    """The `docker` binary is absent, so there are genuinely no Docker resources."""


class DockerUnavailableError(RuntimeError):
    """Docker is installed but could not be enumerated.

    Callers MUST surface this as *unknown*, never as an empty result. Swallowing
    it into `[]` is what produced the `0 volume(s)` false zero in PP-5o7b:
    `--apply` then removed the containers, reported success, and left the
    volumes on disk.
    """


@dataclass(frozen=True)
class DockerSweepResult:
    """Supabase Docker resources grouped by project_id, or an explicit unknown.

    `unknown_reason is None` means `by_project` is trustworthy — an empty dict
    really means "no Supabase Docker resources". Otherwise `by_project` is empty
    only because we couldn't look, and no count derived from it may be reported
    or acted on.
    """

    by_project: dict[str, dict[str, list[str]]] = field(default_factory=dict)
    unknown_reason: str | None = None

    @property
    def is_unknown(self) -> bool:
        return self.unknown_reason is not None


def _run_docker(
    args: list[str],
    env: dict[str, str] | None = None,
    timeout: float | None = None,
) -> str:
    """Run a docker command and return stdout, or raise rather than return empty."""
    try:
        result = subprocess.run(
            args, capture_output=True, text=True, check=True, env=env, timeout=timeout
        )
    except FileNotFoundError as exc:
        raise DockerNotInstalledError("`docker` is not installed") from exc
    except OSError as exc:
        raise DockerUnavailableError(
            f"could not run `{shlex.join(args)}`: {exc}"
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise DockerUnavailableError(
            f"`{shlex.join(args)}` timed out after {exc.timeout:.0f}s"
        ) from exc
    except subprocess.CalledProcessError as exc:
        detail = (
            (exc.stderr or "").strip()
            or (exc.stdout or "").strip()
            or f"exit status {exc.returncode}"
        )
        raise DockerUnavailableError(f"`{shlex.join(args)}` failed: {detail}") from exc
    return result.stdout


def _parse_name_project_pairs(stdout: str) -> list[tuple[str, str]]:
    """Parse `name|project_id` lines, keeping only PinPoint-owned projects."""
    pairs: list[tuple[str, str]] = []
    for line in stdout.splitlines():
        name, sep, project = line.partition("|")
        if sep and project.startswith("pinpoint-"):
            pairs.append((name, project))
    return pairs


def get_supabase_volumes() -> list[tuple[str, str]]:
    """Return `(volume_name, project_id)` for every Supabase-CLI-labeled volume.

    Deliberately two calls. `docker volume ls --format '{{.Label "..."}}'` is NOT
    portable: Podman's `*types.VolumeListReport` has no `Label` method, so the
    whole command exits 125 with a template error (PP-5o7b). The label *filter*
    is honoured by both engines, and `docker volume inspect` exposes the raw
    `.Labels` map on both, so this pair works everywhere `docker volume rm` does.
    """
    names = [
        line.strip()
        for line in _run_docker(
            [
                "docker",
                "volume",
                "ls",
                "--filter",
                f"label={SUPABASE_PROJECT_LABEL}",
                "--format",
                "{{.Name}}",
            ]
        ).splitlines()
        if line.strip()
    ]
    if not names:
        return []

    # Tolerate a *partial* failure on purpose: on a host running many agent
    # worktrees a volume can be removed between the `ls` and the `inspect`, and
    # one racing removal shouldn't blind the whole sweep. `inspect` still writes
    # the volumes it did resolve to stdout, so those pairs stay trustworthy.
    #
    # Anything that leaves stdout empty is reported as unknown instead: a
    # template or daemon failure, and also the (rare) case where every named
    # volume raced away at once. Calling that last one "unknown" rather than
    # "zero" is deliberate — under-claiming knowledge is the whole point of
    # PP-5o7b, and the next sweep resolves it.
    inspect = subprocess.run(
        [
            "docker",
            "volume",
            "inspect",
            "--format",
            '{{.Name}}|{{index .Labels "' + SUPABASE_PROJECT_LABEL + '"}}',
            *names,
        ],
        capture_output=True,
        text=True,
    )
    pairs = _parse_name_project_pairs(inspect.stdout)
    if inspect.returncode != 0 and not pairs:
        detail = (inspect.stderr or "").strip() or f"exit status {inspect.returncode}"
        raise DockerUnavailableError(f"`docker volume inspect` failed: {detail}")
    return pairs


def get_supabase_containers() -> list[tuple[str, str]]:
    """Return `(container_name, project_id)` for every Supabase-CLI-labeled container."""
    return _parse_name_project_pairs(
        _run_docker(
            [
                "docker",
                "ps",
                "-a",
                "--filter",
                f"label={SUPABASE_PROJECT_LABEL}",
                "--format",
                '{{.Names}}|{{.Label "' + SUPABASE_PROJECT_LABEL + '"}}',
            ]
        )
    )


def get_supabase_resources_by_project(not_quiet: bool) -> DockerSweepResult:
    """Group Supabase Docker containers/volumes by their project_id label.

    Any enumeration failure returns an *unknown* result rather than an empty
    one — including a partial failure, since a project whose containers listed
    but whose volumes didn't would otherwise report a false `0 volume(s)`.
    """
    try:
        volumes = get_supabase_volumes()
        containers = get_supabase_containers()
    except DockerNotInstalledError as exc:
        # No docker binary means there are genuinely no Docker resources here,
        # so an empty (not unknown) result is the honest answer.
        if not_quiet:
            print(f"Note: {exc}; no Docker resources to sweep.", file=sys.stderr)
        return DockerSweepResult()
    except DockerUnavailableError as exc:
        return DockerSweepResult(unknown_reason=str(exc))

    grouped: dict[str, dict[str, list[str]]] = {}
    for kind, pairs in (("volumes", volumes), ("containers", containers)):
        for name, project in pairs:
            grouped.setdefault(project, {"volumes": [], "containers": []})
            grouped[project][kind].append(name)
    return DockerSweepResult(by_project=grouped)


def _is_main_worktree_path(path: str) -> bool:
    """Main worktree has .git as a directory; additional worktrees have .git as a file."""
    return (Path(path) / ".git").is_dir()


# --- Remote backend -------------------------------------------------------


def _worktree_uses_remote_backend(worktree_path: str) -> bool:
    """True when a live worktree's .env.local selects the remote backend."""
    env_file = Path(worktree_path) / ".env.local"
    try:
        lines = env_file.read_text().splitlines()
    except OSError:
        return False
    for line in lines:
        if line.startswith(f"{BACKEND_ENV_KEY}="):
            return line.partition("=")[2].strip() == "remote"
    return False


def remote_backend_in_use(worktrees: dict[str, str]) -> bool:
    """Whether this machine may have worktree stacks on a remote Docker daemon.

    Any one signal is enough: the remote settings in the environment, the
    shell's default backend, or a live worktree whose .env.local says remote.
    With none of them (CI, other hosts) the sweep keeps its local-only
    behaviour exactly.
    """
    if os.environ.get(REMOTE_DOCKER_HOST_ENV, "").strip():
        return True
    if os.environ.get(REMOTE_SUPABASE_HOST_ENV, "").strip():
        return True
    if os.environ.get(BACKEND_ENV_KEY, "").strip() == "remote":
        return True
    return any(_worktree_uses_remote_backend(path) for path in worktrees)


def remote_docker_env(docker_host: str) -> dict[str, str]:
    """Environment that points `docker` at the remote daemon, like supabase-stack.sh."""
    env = os.environ.copy()
    env["DOCKER_HOST"] = docker_host
    env.pop("DOCKER_CONTEXT", None)
    return env


def _is_this_machine_path(path: str) -> bool:
    """True for an absolute path under this machine's home or temp directories.

    A remote host's own checkouts (Bazzite: `/var/home/...`) fall outside these
    roots, so their stacks are never judged against this machine's filesystem.
    """
    if not path.startswith("/"):
        return False
    norm = os.path.normpath(path)
    roots = (os.path.normpath(str(Path.home())), "/tmp", "/private/tmp")
    return any(norm == root or norm.startswith(root + "/") for root in roots)


def _is_within(child: str, parent: str) -> bool:
    """True when `child` is `parent` or below it, comparing resolved paths."""
    child_real = os.path.realpath(child)
    parent_real = os.path.realpath(parent)
    return child_real == parent_real or child_real.startswith(
        parent_real.rstrip("/") + "/"
    )


@dataclass
class RemoteProject:
    """One Supabase project's resources on the remote daemon.

    `workdirs` comes from the `com.supabase.cli.workdir` label. The Supabase
    CLI sets it on containers but not on volumes, so a stopped stack (volumes
    only) has no workdir and cannot be attributed to this machine.
    """

    workdirs: set[str] = field(default_factory=set)
    containers: list[str] = field(default_factory=list)
    volumes: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class RemoteSweepResult:
    """This machine's Supabase projects on the remote daemon, or an explicit unknown.

    Same contract as `DockerSweepResult`: with `unknown_reason` set, `by_project`
    is empty only because we couldn't look.
    """

    docker_host: str | None
    by_project: dict[str, RemoteProject] = field(default_factory=dict)
    unknown_reason: str | None = None

    @property
    def is_unknown(self) -> bool:
        return self.unknown_reason is not None

    @property
    def label(self) -> str:
        return self.docker_host or f"remote Docker ({REMOTE_DOCKER_HOST_ENV} unset)"

    def projects_referencing(self, worktree_path: str) -> list[str]:
        """Remote projects whose workdir is `worktree_path` or inside it."""
        return sorted(
            pid
            for pid, project in self.by_project.items()
            if any(_is_within(workdir, worktree_path) for workdir in project.workdirs)
        )


def _parse_remote_rows(stdout: str) -> list[tuple[str, str, str]]:
    """Parse `name|project_id|workdir` lines for this repo's non-Crabbox projects."""
    rows: list[tuple[str, str, str]] = []
    for line in stdout.splitlines():
        parts = line.split("|", 2)
        if len(parts) != 3:
            continue
        name, project, workdir = (part.strip() for part in parts)
        if not project.startswith("pinpoint-"):
            continue
        if project.startswith(CRABBOX_PROJECT_PREFIX):
            continue
        rows.append((name, project, workdir))
    return rows


def get_remote_supabase_rows(
    env: dict[str, str], budget: float = REMOTE_QUERY_BUDGET_SECONDS
) -> tuple[list[tuple[str, str, str]], list[tuple[str, str, str]]]:
    """Return `(volumes, containers)` rows of `(name, project_id, workdir)`.

    Same two-call volume enumeration and partial-failure tolerance as
    `get_supabase_volumes()`; the remote daemon is only ever filtered by label.
    All three calls share `budget` seconds; running out raises
    DockerUnavailableError like any other failed query.
    """
    deadline = time.monotonic() + budget

    def remaining() -> float:
        return max(0.1, deadline - time.monotonic())

    label_fields = (
        '{{index .Labels "'
        + SUPABASE_PROJECT_LABEL
        + '"}}|{{index .Labels "'
        + SUPABASE_WORKDIR_LABEL
        + '"}}'
    )
    names = [
        line.strip()
        for line in _run_docker(
            [
                "docker",
                "volume",
                "ls",
                "--filter",
                f"label={SUPABASE_PROJECT_LABEL}",
                "--format",
                "{{.Name}}",
            ],
            env,
            remaining(),
        ).splitlines()
        if line.strip()
    ]
    volumes: list[tuple[str, str, str]] = []
    if names:
        args = [
            "docker",
            "volume",
            "inspect",
            "--format",
            "{{.Name}}|" + label_fields,
            *names,
        ]
        try:
            inspect = subprocess.run(
                args, capture_output=True, text=True, env=env, timeout=remaining()
            )
        except (OSError, subprocess.SubprocessError) as exc:
            raise DockerUnavailableError(
                f"could not run `docker volume inspect`: {exc}"
            ) from exc
        if inspect.returncode != 0 and not inspect.stdout.strip():
            detail = (
                inspect.stderr or ""
            ).strip() or f"exit status {inspect.returncode}"
            raise DockerUnavailableError(f"`docker volume inspect` failed: {detail}")
        volumes = _parse_remote_rows(inspect.stdout)

    containers = _parse_remote_rows(
        _run_docker(
            [
                "docker",
                "ps",
                "-a",
                "--filter",
                f"label={SUPABASE_PROJECT_LABEL}",
                "--format",
                "{{.Names}}|"
                + '{{.Label "'
                + SUPABASE_PROJECT_LABEL
                + '"}}|{{.Label "'
                + SUPABASE_WORKDIR_LABEL
                + '"}}',
            ],
            env,
            remaining(),
        )
    )
    return volumes, containers


def get_remote_sweep(
    worktrees: dict[str, str], budget: float = REMOTE_QUERY_BUDGET_SECONDS
) -> RemoteSweepResult | None:
    """Enumerate this machine's Supabase projects on the remote daemon.

    Returns None when nothing suggests this machine uses the remote backend,
    so the caller keeps today's local-only behaviour. Projects whose workdir
    is a path on the remote host itself are dropped entirely, as are Crabbox
    runner projects (`_parse_remote_rows`).
    """
    if not remote_backend_in_use(worktrees):
        return None
    docker_host = os.environ.get(REMOTE_DOCKER_HOST_ENV, "").strip() or None
    if docker_host is None:
        return RemoteSweepResult(
            docker_host=None,
            unknown_reason=(
                "this machine uses the remote Supabase backend but "
                f"{REMOTE_DOCKER_HOST_ENV} is unset"
            ),
        )
    try:
        volumes, containers = get_remote_supabase_rows(
            remote_docker_env(docker_host), budget
        )
    except (DockerNotInstalledError, DockerUnavailableError) as exc:
        # A missing docker CLI is a real zero only for the local daemon; the
        # remote host's resources exist regardless of this machine's tooling.
        return RemoteSweepResult(docker_host=docker_host, unknown_reason=str(exc))

    grouped: dict[str, RemoteProject] = {}
    for kind, rows in (("volumes", volumes), ("containers", containers)):
        for name, project, workdir in rows:
            entry = grouped.setdefault(project, RemoteProject())
            getattr(entry, kind).append(name)
            if workdir:
                entry.workdirs.add(workdir)
    # A project with any workdir outside this machine belongs to the remote
    # host (or another machine); it is not ours to report or remove.
    owned = {
        pid: project
        for pid, project in grouped.items()
        if all(_is_this_machine_path(workdir) for workdir in project.workdirs)
    }
    return RemoteSweepResult(docker_host=docker_host, by_project=owned)


def _remove_project_resources(
    pid: str,
    containers: list[str],
    volumes: list[str],
    not_quiet: bool,
    env: dict[str, str] | None = None,
    where: str = "",
) -> bool:
    """`docker rm -f` then `docker volume rm` one project's named resources.

    Names come from a label-filtered enumeration; nothing here prunes. Returns
    True when every removal that was needed succeeded.
    """
    ok = True
    for kind, argv, names in (
        ("container", ["docker", "rm", "-f"], containers),
        ("volume", ["docker", "volume", "rm"], volumes),
    ):
        if not names:
            continue
        try:
            rm = subprocess.run(
                argv + names,
                capture_output=True,
                text=True,
                env=env,
                timeout=REMOTE_DOCKER_TIMEOUT_SECONDS if env is not None else None,
            )
            failure = rm.stderr.strip() if rm.returncode != 0 else None
        except (OSError, subprocess.SubprocessError) as exc:
            failure = str(exc)
        if failure is not None:
            ok = False
            print(
                f"  Warning: `{' '.join(argv)}` for {pid}{where}: {failure}",
                file=sys.stderr,
            )
        elif not_quiet:
            print(
                f"  removed {len(names)} {kind}(s) for {pid}{where}",
                file=sys.stderr,
            )
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually remove orphan resources (default: dry-run report).",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress per-orphan logging; only print summary line and errors.",
    )
    parser.add_argument(
        "--repo-dir",
        type=Path,
        default=None,
        help=(
            "Repository root to use for `git worktree list`. "
            "Defaults to $CLAUDE_PROJECT_DIR or PWD."
        ),
    )
    args = parser.parse_args()

    repo_dir = args.repo_dir or Path(
        os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    )
    not_quiet = not args.quiet

    active = get_active_worktree_branches(repo_dir)
    active_project_ids = get_active_project_ids(active)

    if not_quiet:
        print(
            f"Active worktrees: {len(active)} "
            f"(project_ids: {sorted(active_project_ids)})",
            file=sys.stderr,
        )

    orphan_slots = get_orphan_slot_paths()
    if orphan_slots and not_quiet:
        print(
            f"Orphan slot entries (path missing or .git removed): {len(orphan_slots)}",
            file=sys.stderr,
        )
        for path_str in orphan_slots:
            print(f"  - {path_str}", file=sys.stderr)

    docker = get_supabase_resources_by_project(not_quiet)
    # An orphan is a project_id with no *active worktree*, never "a volume with
    # no container": a live worktree whose Supabase is merely stopped keeps its
    # volume and would be destroyed by a container-presence heuristic (or by
    # `docker volume prune`). Don't reintroduce either.
    orphan_projects = {
        pid: res
        for pid, res in docker.by_project.items()
        if pid not in active_project_ids
    }

    # Remote backend. `remote is None` means no remote-backend signal at all,
    # and everything below degrades to the local-only behaviour.
    remote = get_remote_sweep(
        active,
        REMOTE_QUERY_BUDGET_SECONDS if not_quiet else QUIET_REMOTE_QUERY_BUDGET_SECONDS,
    )
    remote_orphans: dict[str, RemoteProject] = {}
    unattributed: dict[str, RemoteProject] = {}
    # Orphan slots that must not be freed yet: path -> remote project_ids that
    # still reference it (empty list = remote state unknown).
    held_slots: dict[str, list[str]] = {}
    if remote is not None:
        if remote.is_unknown:
            held_slots = {path: [] for path in orphan_slots}
        else:
            for pid, project in remote.by_project.items():
                if pid in active_project_ids:
                    continue
                if not project.workdirs:
                    unattributed[pid] = project
                elif not any(Path(w).exists() for w in project.workdirs):
                    remote_orphans[pid] = project
            for path in orphan_slots:
                holders = remote.projects_referencing(path)
                if holders:
                    held_slots[path] = holders

    if docker.is_unknown:
        # Never suppressed by --quiet: a silent false zero is worse than an error,
        # and this is the line that keeps the SessionStart nudge honest.
        print(
            "worktree-orphan-sweep: Supabase Docker orphans are UNKNOWN, not zero — "
            f"{docker.unknown_reason}. Containers/volumes were not counted"
            + (
                " and --apply will not reclaim any Docker resources."
                if args.apply
                else "."
            ),
            file=sys.stderr,
        )
    elif orphan_projects and not_quiet:
        print(
            f"Orphan Supabase Docker projects: {len(orphan_projects)}",
            file=sys.stderr,
        )
        for pid, res in sorted(orphan_projects.items()):
            print(
                f"  - {pid}: {len(res['containers'])} container(s), "
                f"{len(res['volumes'])} volume(s)",
                file=sys.stderr,
            )

    if remote is not None and remote.is_unknown:
        # Same rule as the local line above: never suppressed by --quiet.
        print(
            "worktree-orphan-sweep: remote Supabase Docker orphans on "
            f"{remote.label} are UNKNOWN, not zero — {remote.unknown_reason}. "
            f"Keeping {len(held_slots)} orphan slot entr(ies): a remote stack "
            "may still hold their ports"
            + (
                "; --apply will not reclaim remote resources or those slots."
                if args.apply
                else "."
            ),
            file=sys.stderr,
        )
    elif remote is not None and not_quiet:
        print(
            f"Remote Supabase projects from this machine on {remote.label}: "
            f"{len(remote.by_project)} ({len(remote_orphans)} orphaned)",
            file=sys.stderr,
        )
        if remote_orphans:
            print(
                f"Orphan remote Supabase projects on {remote.label}: "
                f"{len(remote_orphans)}",
                file=sys.stderr,
            )
            for pid, project in sorted(remote_orphans.items()):
                print(
                    f"  - {pid}: {len(project.containers)} container(s), "
                    f"{len(project.volumes)} volume(s) "
                    f"(workdir gone: {', '.join(sorted(project.workdirs))})",
                    file=sys.stderr,
                )
        for path, holders in sorted(held_slots.items()):
            print(
                f"  keeping slot for {path}: remote project(s) "
                f"{', '.join(holders)} still reference it",
                file=sys.stderr,
            )
        if unattributed:
            print(
                f"Remote Supabase projects on {remote.label} with volumes only "
                "(no workdir label, so not attributable to this machine; "
                "never removed by this sweep):",
                file=sys.stderr,
            )
            for pid, project in sorted(unattributed.items()):
                print(
                    f"  - {pid}: {len(project.volumes)} volume(s)",
                    file=sys.stderr,
                )

    remote_unknown = remote is not None and remote.is_unknown
    any_unknown = docker.is_unknown or remote_unknown

    if not orphan_slots and not orphan_projects and not remote_orphans:
        if not_quiet:
            print(
                "No slot orphans found; Docker orphans unknown (see above)."
                if any_unknown
                else "No orphans found.",
                file=sys.stderr,
            )
        return EXIT_DOCKER_UNKNOWN if any_unknown else 0

    if not args.apply:
        if not_quiet:
            print("Dry-run; re-run with --apply to reclaim.", file=sys.stderr)
        else:
            # Quiet dry-run still surfaces a single-line nudge so the SessionStart
            # hook isn't completely silent when there's something to reclaim.
            docker_summary = (
                "Supabase Docker project orphans UNKNOWN"
                if docker.is_unknown
                else f"{len(orphan_projects)} Supabase Docker project orphan(s)"
            )
            if remote is not None:
                docker_summary += (
                    ", remote Supabase project orphans UNKNOWN"
                    if remote.is_unknown
                    else f", {len(remote_orphans)} remote Supabase project orphan(s)"
                )
            print(
                f"worktree-orphan-sweep: found {len(orphan_slots)} slot orphan(s), "
                f"{docker_summary} "
                "(dry-run). Run: python3 scripts/worktree_orphan_sweep.py --apply",
                file=sys.stderr,
            )
        return EXIT_DOCKER_UNKNOWN if any_unknown else 0

    def _free_slot(path_str: str) -> None:
        if _is_main_worktree_path(path_str):
            print(
                f"Skipping main worktree {path_str} (should not be in slot manifest).",
                file=sys.stderr,
            )
            return
        deallocate_slot(path_str)
        if not_quiet:
            print(f"  deallocated slot: {path_str}", file=sys.stderr)

    for path_str in orphan_slots:
        if path_str not in held_slots:
            _free_slot(path_str)

    for pid, res in sorted(orphan_projects.items()):
        _remove_project_resources(pid, res["containers"], res["volumes"], not_quiet)

    if remote is not None and remote.docker_host and not remote.is_unknown:
        env = remote_docker_env(remote.docker_host)
        where = f" on {remote.docker_host}"
        removed_remote = {
            pid
            for pid, project in sorted(remote_orphans.items())
            if _remove_project_resources(
                pid, project.containers, project.volumes, not_quiet, env, where
            )
        }
        # A slot held only by stacks that are now gone no longer has anything
        # bound to its ports, so it can be released in the same run.
        for path_str, holders in sorted(held_slots.items()):
            if set(holders) <= removed_remote:
                _free_slot(path_str)
            else:
                print(
                    f"  kept slot for {path_str}: remote project(s) "
                    f"{', '.join(h for h in holders if h not in removed_remote)} "
                    "still hold it",
                    file=sys.stderr,
                )

    if docker.is_unknown:
        print(
            "Docker sweep SKIPPED (state unknown); no containers or volumes were "
            "removed. Slot manifest orphans above were still reclaimed"
            + (" except those kept for the remote backend." if held_slots else "."),
            file=sys.stderr,
        )
    if remote is not None and remote.is_unknown:
        print(
            f"Remote Docker sweep SKIPPED (state unknown); nothing on {remote.label} "
            f"was removed and {len(held_slots)} orphan slot entr(ies) were kept.",
            file=sys.stderr,
        )

    return EXIT_DOCKER_UNKNOWN if any_unknown else 0


if __name__ == "__main__":
    sys.exit(main())

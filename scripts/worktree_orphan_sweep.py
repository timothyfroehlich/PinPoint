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
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from worktree_cleanup import MANIFEST_PATH, deallocate_slot  # noqa: E402
from worktree_setup import branch_to_project_id  # noqa: E402

_PROJECT_ID_LINE_RE = re.compile(r'^project_id\s*=\s*"([^"]+)"')

SUPABASE_PROJECT_LABEL = "com.supabase.cli.project"

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
        print(
            f"Warning: `git worktree list` failed: {exc.stderr.strip()}",
            file=sys.stderr,
        )
        return {}

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


def _run_docker(args: list[str]) -> str:
    """Run a docker command and return stdout, or raise rather than return empty."""
    try:
        result = subprocess.run(args, capture_output=True, text=True, check=True)
    except FileNotFoundError as exc:
        raise DockerNotInstalledError("`docker` is not installed") from exc
    except OSError as exc:
        raise DockerUnavailableError(
            f"could not run `{shlex.join(args)}`: {exc}"
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

    if not orphan_slots and not orphan_projects:
        if not_quiet:
            print(
                "No slot orphans found; Docker orphans unknown (see above)."
                if docker.is_unknown
                else "No orphans found.",
                file=sys.stderr,
            )
        return EXIT_DOCKER_UNKNOWN if docker.is_unknown else 0

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
            print(
                f"worktree-orphan-sweep: found {len(orphan_slots)} slot orphan(s), "
                f"{docker_summary} "
                "(dry-run). Run: python3 scripts/worktree_orphan_sweep.py --apply",
                file=sys.stderr,
            )
        return EXIT_DOCKER_UNKNOWN if docker.is_unknown else 0

    for path_str in orphan_slots:
        if _is_main_worktree_path(path_str):
            print(
                f"Skipping main worktree {path_str} (should not be in slot manifest).",
                file=sys.stderr,
            )
            continue
        deallocate_slot(path_str)
        if not_quiet:
            print(f"  deallocated slot: {path_str}", file=sys.stderr)

    for pid, res in sorted(orphan_projects.items()):
        if res["containers"]:
            rm = subprocess.run(
                ["docker", "rm", "-f"] + res["containers"],
                capture_output=True,
                text=True,
            )
            if rm.returncode != 0:
                print(
                    f"  Warning: `docker rm -f` for {pid}: {rm.stderr.strip()}",
                    file=sys.stderr,
                )
            elif not_quiet:
                print(
                    f"  removed {len(res['containers'])} container(s) for {pid}",
                    file=sys.stderr,
                )
        if res["volumes"]:
            rm = subprocess.run(
                ["docker", "volume", "rm"] + res["volumes"],
                capture_output=True,
                text=True,
            )
            if rm.returncode != 0:
                print(
                    f"  Warning: `docker volume rm` for {pid}: {rm.stderr.strip()}",
                    file=sys.stderr,
                )
            elif not_quiet:
                print(
                    f"  removed {len(res['volumes'])} volume(s) for {pid}",
                    file=sys.stderr,
                )

    if docker.is_unknown:
        print(
            "Docker sweep SKIPPED (state unknown); no containers or volumes were "
            "removed. Slot manifest orphans above were still reclaimed.",
            file=sys.stderr,
        )
        return EXIT_DOCKER_UNKNOWN

    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
Worktree cleanup — the single teardown entry point for PinPoint worktrees.

Stops Supabase, removes Docker volumes, removes/prunes the git worktree, then
deallocates its manifest slot. Call it directly with one worktree path, or use
`--claude-hook` to read Claude Code's `worktree_path` JSON field from stdin.

Exit 0 means the teardown is complete; 1 means anything else — a refusal, a
failure, or something left behind — with the reason on stderr. The caller
(Claude Code's WorktreeRemove hook) has no other way to learn that a worktree
leaked. Two rules follow from that, both of them regressions we have actually
shipped:

- **A missing target is never a silent success** (PP-omz3). Being handed a path
  that isn't there used to warn and `return`, i.e. exit 0, so a wrong or
  mangled path did nothing at all — no `supabase stop`, no volume removal, no
  slot deallocation — while everything upstream believed the worktree was
  cleaned. Exit 0 now requires *evidence* of a clean state: the path absent
  from both `git worktree list` and the slot manifest.
- **Unknown is never zero** (PP-3w4g, mirroring PP-5o7b / PR #1746 in the
  orphan section of `worktree_reap.py`). A failed `docker volume ls` used to collapse
  into `volumes = []`, indistinguishable from "no volumes exist", after which
  the worktree was removed and the slot deallocated while the volumes leaked.
  An unqueryable Docker now yields an explicit unknown and a non-zero exit — as
  does a `.git`-less worktree, whose missing branch leaves no project_id to query
  with, so the volumes are never counted at all (PP-ew10, the PP-qlzu path).

Targeting matters as much as reporting: the Supabase project id comes from the
worktree's pinned `supabase/config.toml`, not from its current branch name
(PP-rbbp). Since PP-4936 the pinned id no longer follows the branch, so a
branch-derived id goes stale the moment the branch is renamed — and a volume
query filtered on a label nothing carries returns a clean, wrong zero.
"""

import fcntl
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

# Reuse the project-id resolution from worktree_setup so cleanup targets the
# same container/volume names that setup created: the pinned id in the
# worktree's config.toml wins, and only a worktree without one falls back to
# the branch (or, when detached, the path). Deriving from the branch alone
# would target a label no volume carries after a branch rename (PP-rbbp).
# (Python auto-adds this script's directory to sys.path when invoked as
# `python3 worktree_cleanup.py`.)
from worktree_setup import (  # noqa: E402
    DockerNotInstalledError,
    DockerUnavailableError,
    list_worktrees,
    read_stored_backend,
    resolve_project_id,
    run_docker,
)

MANIFEST_PATH = Path.home() / ".config" / "pinpoint" / "worktree-slots.json"

SUPABASE_PROJECT_LABEL = "com.supabase.cli.project"

REAP_HINT = "python3 scripts/worktree_reap.py --apply"

#: Everything cleaned up (or verifiably nothing to clean up).
EXIT_OK = 0
#: Anything else: a usage error, a refusal (main worktree, remote backend
#: without PINPOINT_REMOTE_DOCKER_HOST), a failed removal, a missing target
#: with residue, or Supabase volumes whose state is unknown. stderr says which.
EXIT_FAILED = 1


def deallocate_slot(worktree_path: str) -> None:
    """Remove a worktree's entry from the manifest, with file locking."""
    if not MANIFEST_PATH.exists():
        return

    with open(MANIFEST_PATH, "r+") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        try:
            try:
                data = json.loads(f.read())
                slots = data.get("slots", {})
            except (json.JSONDecodeError, KeyError):
                slots = {}

            if worktree_path in slots:
                del slots[worktree_path]
                f.seek(0)
                f.truncate()
                f.write(json.dumps({"version": 1, "slots": slots}, indent=2) + "\n")
        finally:
            fcntl.flock(f, fcntl.LOCK_UN)


def slot_manifest_paths() -> set[str] | None:
    """Paths registered in the slot manifest, or None if it can't be read.

    None means *unknown*, not empty: a manifest we failed to parse may well
    still hold an entry for the target, and treating that as "no entry" is the
    false-zero shape this script exists to avoid.
    """
    if not MANIFEST_PATH.exists():
        return set()
    try:
        with open(MANIFEST_PATH) as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_SH)
            try:
                raw = f.read()
            finally:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        slots = json.loads(raw).get("slots", {})
    except (OSError, json.JSONDecodeError, AttributeError):
        return None
    if not isinstance(slots, dict):
        return None
    return {str(Path(path).resolve()) for path in slots}


def registered_worktree_paths() -> set[str] | None:
    """Paths git still knows as worktrees, or None if git can't be asked.

    Includes prunable registrations — a `rm -rf`'d worktree stays listed until
    `git worktree prune` runs, and that lingering registration is exactly the
    residue that makes "the directory is gone" not mean "cleanup happened".
    """
    repo_dir = Path(__file__).resolve().parent.parent
    try:
        worktrees = list_worktrees(repo_dir)
    except (OSError, subprocess.CalledProcessError):
        return None
    return {str(Path(path).resolve()) for path in worktrees}


def main_worktree_path(worktree_path: Path) -> Path | None:
    """Return Git's main worktree, which remains usable after target removal."""
    try:
        worktrees = list_worktrees(worktree_path)
    except (OSError, subprocess.CalledProcessError):
        return None
    main = next(iter(worktrees), None)
    return Path(main).resolve() if main is not None else None


def report_missing_target(worktree_path: Path) -> int:
    """Adjudicate a target path that isn't on disk (PP-omz3).

    Exit 0 only for a genuinely idempotent re-invocation — the path absent from
    both `git worktree list` and the slot manifest. Anything else (residue, or
    a source of truth we couldn't read) is a real error: the caller asked us to
    clean something we cannot find, so nothing was reclaimed and saying so is
    the whole point.
    """
    target = str(worktree_path)
    slots = slot_manifest_paths()
    registered = registered_worktree_paths()

    residue: list[str] = []
    if slots is None:
        residue.append(f"the slot manifest ({MANIFEST_PATH}) could not be read")
    elif target in slots:
        residue.append(f"the slot manifest ({MANIFEST_PATH}) still has its entry")
    if registered is None:
        residue.append("`git worktree list` could not be read")
    elif target in registered:
        residue.append("git still has it registered as a worktree")

    if not residue:
        # The one sanctioned exit 0 for a missing path: no residue anywhere, so
        # there is nothing left to leak. This cannot be distinguished from a
        # mistyped path pointing at a worktree that was never here, hence the
        # nudge — but with nothing registered under this path, there is also
        # nothing for us to reclaim under it.
        print(
            f"{worktree_path} does not exist and has no slot manifest entry or git "
            "worktree registration — already cleaned up, nothing to do. (If you "
            "expected a worktree here, re-check the path: a wrong path looks the same.)",
            file=sys.stderr,
        )
        return EXIT_OK

    print(
        f"Error: {worktree_path} does not exist, but cleanup is NOT complete — "
        + "; ".join(residue)
        + ". Nothing was reclaimed: no `supabase stop`, no Docker volume removal, "
        "no slot deallocation. Check the path you passed (a wrong or mangled path "
        f"lands here), then re-run with the real path or reclaim orphans with `{REAP_HINT}`.",
        file=sys.stderr,
    )
    return EXIT_FAILED


#: Upper bound for each `supabase`/`docker` call during teardown. With the
#: remote backend these run over SSH, and a sleeping host or a lossy link would
#: otherwise hang the WorktreeRemove hook and merge-pr.sh's reap indefinitely.
TEARDOWN_TIMEOUT_SECONDS = 120


@dataclass(frozen=True)
class VolumeQuery:
    """Volumes for one Supabase project, or an explicit unknown.

    `unknown_reason is None` means `volumes` is trustworthy — empty really means
    "this project has no volumes". Otherwise `volumes` is empty only because we
    couldn't look, and no count derived from it may be reported or acted on.
    `__post_init__` makes that invariant structural rather than conventional.
    """

    volumes: tuple[str, ...] = ()
    unknown_reason: str | None = None

    def __post_init__(self) -> None:
        if self.unknown_reason is not None and self.volumes:
            raise ValueError("an unknown VolumeQuery cannot also carry volumes")

    @property
    def is_unknown(self) -> bool:
        return self.unknown_reason is not None


def list_project_volumes(
    project_id: str, env: dict[str, str] | None = None
) -> VolumeQuery:
    """List Supabase volumes for `project_id`, or return an explicit unknown.

    The `--filter label=<k>=<v>` + `-q` form is honoured by both Docker and
    Podman, so this query does NOT need the two-call `volume inspect` dance that
    PP-5o7b forced on `worktree_reap.py`. Only the error handling is
    shared with it: a query that didn't run must never look like an empty one.
    """
    try:
        stdout = run_docker(
            [
                "docker",
                "volume",
                "ls",
                "--filter",
                f"label={SUPABASE_PROJECT_LABEL}={project_id}",
                "-q",
            ],
            env,
            TEARDOWN_TIMEOUT_SECONDS,
        )
    except DockerNotInstalledError as exc:
        # No docker binary means there are genuinely no volumes on this host,
        # so an empty (not unknown) result is the honest answer.
        print(f"Note: {exc}; no Supabase volumes to remove.", file=sys.stderr)
        return VolumeQuery()
    except DockerUnavailableError as exc:
        return VolumeQuery(unknown_reason=str(exc))
    return VolumeQuery(
        volumes=tuple(line.strip() for line in stdout.splitlines() if line.strip())
    )


def supabase_backend_env(worktree_path: Path) -> tuple[dict[str, str], str | None]:
    """Environment that points `supabase`/`docker` at this worktree's stack.

    A worktree whose .env.local selects the remote backend keeps its stack on
    another host's Docker (scripts/supabase-stack.sh). Tearing down with the
    ambient local daemon would stop nothing there and report zero volumes, so
    without PINPOINT_REMOTE_DOCKER_HOST the volumes are UNKNOWN, not zero.
    Returns (env, unknown_reason).
    """
    env = os.environ.copy()
    env["SUPABASE_TELEMETRY_DISABLED"] = "1"
    backend = read_stored_backend(worktree_path)
    if backend is None:
        return (
            env,
            "its .env.local could not be read, so its Supabase backend is unknown",
        )
    if backend != "remote":
        return env, None
    docker_host = os.environ.get("PINPOINT_REMOTE_DOCKER_HOST", "").strip()
    if not docker_host:
        return env, (
            "the worktree uses the remote Supabase backend but "
            "PINPOINT_REMOTE_DOCKER_HOST is unset"
        )
    env["DOCKER_HOST"] = docker_host
    env.pop("DOCKER_CONTEXT", None)
    remote_host = os.environ.get("PINPOINT_REMOTE_SUPABASE_HOST", "").strip()
    if remote_host:
        env["SUPABASE_SERVICES_HOSTNAME"] = remote_host
    return env, None


def stop_and_remove_supabase(
    worktree_path: Path, project_id: str, supabase_env: dict[str, str]
) -> str | None:
    """Stop the worktree's Supabase stack and remove its volumes.

    Returns why the volumes' state is unknown, or None when it is known.
    """
    volumes_unknown_reason: str | None = None
    try:
        stop_result = subprocess.run(
            ["supabase", "stop"],
            cwd=worktree_path,
            capture_output=True,
            text=True,
            env=supabase_env,
            timeout=TEARDOWN_TIMEOUT_SECONDS,
        )
        if stop_result.returncode != 0:
            print(
                f"Warning: `supabase stop` exited {stop_result.returncode}: "
                f"{stop_result.stderr.strip() or stop_result.stdout.strip()}",
                file=sys.stderr,
            )
    except subprocess.TimeoutExpired as exc:
        print(
            f"Warning: `supabase stop` timed out after {exc.timeout:.0f}s — "
            "continuing cleanup",
            file=sys.stderr,
        )
    except (FileNotFoundError, OSError) as exc:
        print(
            f"Warning: failed to invoke `supabase stop` ({exc}) — continuing cleanup",
            file=sys.stderr,
        )

    # Remove Docker volumes. A query that failed is unknown, NOT zero
    # (PP-3w4g): reporting "removed 0 volume(s)" for a query that never ran
    # is how volumes leak permanently past a teardown that claimed success.
    query = list_project_volumes(project_id, supabase_env)
    if query.is_unknown:
        volumes_unknown_reason = query.unknown_reason
        # No recovery hint here: it depends on the backend, and the caller
        # prints the right one (reap for a local stack, re-run for a remote one).
        print(
            f"Warning: Supabase volumes for {project_id} are UNKNOWN, not zero — "
            f"{query.unknown_reason}. None were removed.",
            file=sys.stderr,
        )
    elif query.volumes:
        try:
            rm_result = subprocess.run(
                ["docker", "volume", "rm", *query.volumes],
                capture_output=True,
                text=True,
                env=supabase_env,
                timeout=TEARDOWN_TIMEOUT_SECONDS,
            )
            if rm_result.returncode != 0:
                err_msg = (
                    rm_result.stderr.strip() or f"exit code {rm_result.returncode}"
                )
                print(
                    f"Warning: `docker volume rm` exited {rm_result.returncode}: {err_msg}",
                    file=sys.stderr,
                )
                volumes_unknown_reason = f"`docker volume rm` failed: {err_msg}"
            else:
                print(
                    f"Removed {len(query.volumes)} Docker volume(s)",
                    file=sys.stderr,
                )
        except subprocess.TimeoutExpired as exc:
            print(
                f"Warning: `docker volume rm` timed out after {exc.timeout:.0f}s",
                file=sys.stderr,
            )
            volumes_unknown_reason = (
                f"`docker volume rm` timed out after {exc.timeout:.0f}s"
            )
        except (FileNotFoundError, OSError) as exc:
            print(
                f"Warning: failed to invoke `docker volume rm` ({exc})",
                file=sys.stderr,
            )
            volumes_unknown_reason = f"failed to invoke `docker volume rm`: {exc}"
    return volumes_unknown_reason


def cleanup_worktree(worktree_path: Path) -> int:
    """Perform the complete ordered teardown for one additional worktree."""

    if not worktree_path.is_dir():
        return report_missing_target(worktree_path)

    # Refuse to operate on the main worktree. Inside a main worktree, .git is a
    # directory; inside an additional worktree, .git is a file with a "gitdir:"
    # pointer. A caller pointing this script at the main worktree (e.g., a
    # cleanup script that misidentified the path) would otherwise stop the
    # user's primary Supabase and try to remove their main checkout.
    git_marker = worktree_path / ".git"
    if git_marker.is_dir():
        print(
            f"Refusing to clean up the main worktree at {worktree_path}. "
            "worktree_cleanup.py is for additional (git worktree add) worktrees only.",
            file=sys.stderr,
        )
        return EXIT_FAILED

    # PP-qlzu: when .git is missing (partial removal, rm -rf without the hook,
    # Claude in Web sandbox sessions), we can't derive the branch and therefore
    # can't safely target the Supabase project_id. Skip the Docker/Supabase
    # phase but still deallocate the slot — otherwise the manifest entry leaks
    # forever. After any stale Git registration is pruned,
    # worktree_reap.py picks up any leaked Docker resources.
    #
    # PP-ew10: skipping that phase means the volumes were never queried, so their
    # state is UNKNOWN — the same "success without evidence" shape as PP-omz3 and
    # PP-3w4g, reached from a third direction. Record it as unknown here so the run
    # returns EXIT_FAILED and points at worktree_reap.py, instead of a false
    # EXIT_OK for a teardown that never touched Docker.
    git_marker_present = git_marker.is_file()

    volumes_unknown_reason: str | None = None
    if not git_marker_present:
        volumes_unknown_reason = (
            "no .git marker, so no branch to derive the Supabase project_id"
        )
        print(
            f"Warning: {worktree_path} has no .git marker — skipping Supabase/Docker "
            "cleanup (no branch to derive project_id from); deallocating slot only.",
            file=sys.stderr,
        )

    branch = ""
    if git_marker_present:
        try:
            result = subprocess.run(
                ["git", "-C", str(worktree_path), "rev-parse", "--abbrev-ref", "HEAD"],
                capture_output=True,
                text=True,
                check=True,
            )
            branch = result.stdout.strip()
        except (OSError, subprocess.CalledProcessError):
            branch = ""

        # A present marker is not enough evidence to continue: without a branch,
        # cleanup cannot target this worktree's Supabase project. Keep both the
        # worktree and its slot so a transient or corrupt Git state cannot turn
        # into another successful-looking resource leak.
        if not branch:
            print(
                f"Failed to derive a branch for {worktree_path} — refusing cleanup "
                "and keeping the worktree and slot manifest entry for investigation.",
                file=sys.stderr,
            )
            return EXIT_FAILED

    if branch:
        project_id = resolve_project_id(worktree_path, branch)

        # Stop Supabase. Failures here are non-fatal: a missing project_ref or
        # a stack that was never started both look like errors but don't block
        # slot deallocation.
        supabase_env, backend_problem = supabase_backend_env(worktree_path)
        if backend_problem is not None:
            # Nothing here can reach the remote stack, and worktree_reap.py
            # never removes a stopped one (its volumes carry no workdir label),
            # so removing the worktree now could strand its remote volumes.
            print(
                f"Refusing cleanup of {worktree_path}: {backend_problem}. "
                "Keeping the worktree and slot; fix that and re-run "
                "(docs/runbooks/remote-supabase.md).",
                file=sys.stderr,
            )
            return EXIT_FAILED
        print(f"Stopping Supabase for {branch}...", file=sys.stderr)
        volumes_unknown_reason = stop_and_remove_supabase(
            worktree_path, project_id, supabase_env
        )
        if volumes_unknown_reason and read_stored_backend(worktree_path) == "remote":
            # A stopped remote stack's volumes carry no workdir label, so
            # worktree_reap.py could never attribute them once the worktree is
            # gone. Keep the worktree and slot until they can be removed here.
            print(
                f"Refusing to remove {worktree_path}: its remote Supabase volumes "
                f"are UNKNOWN ({volumes_unknown_reason}). Keeping the worktree and "
                "slot; re-run this cleanup once the remote Docker host is reachable.",
                file=sys.stderr,
            )
            return EXIT_FAILED

    # Unlock first. Claude Code agent runtimes lock worktrees while in use,
    # and the lock persists after the agent finishes; `git worktree remove
    # --force` does NOT bypass these locks. Unlock errors (e.g., "not locked")
    # are harmless and intentionally ignored.
    if git_marker_present:
        control_worktree = main_worktree_path(worktree_path)
        if control_worktree is None:
            print(
                f"Failed to locate Git's main worktree for {worktree_path} — "
                "keeping slot manifest entry to avoid a port collision.",
                file=sys.stderr,
            )
            return EXIT_FAILED

        subprocess.run(
            [
                "git",
                "-C",
                str(control_worktree),
                "worktree",
                "unlock",
                str(worktree_path),
            ],
            capture_output=True,
        )

        result = subprocess.run(
            [
                "git",
                "-C",
                str(control_worktree),
                "worktree",
                "remove",
                "--force",
                str(worktree_path),
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            # Do NOT deallocate the slot — the worktree directory likely still
            # exists with its `.env.local` and config pointing at this slot's
            # ports. Freeing the slot would let the next worktree allocate the
            # same ports and collide. Surface the failure and bail.
            print(
                f"Failed to remove worktree {worktree_path}: "
                f"{result.stderr.strip()} — keeping slot manifest entry to "
                "avoid port collision; investigate manually.",
                file=sys.stderr,
            )
            return EXIT_FAILED

        subprocess.run(
            ["git", "-C", str(control_worktree), "worktree", "prune"],
            capture_output=True,
        )

    deallocate_slot(str(worktree_path))

    if volumes_unknown_reason is not None:
        # The slot is deallocated and (when we had a .git marker) the worktree
        # removed, so worktree_reap.py — which matches on the Docker label, not the
        # manifest — will still find any leaked volumes: a delayed leak, not a
        # permanent one. But this run did NOT finish the job, so it must not
        # report success to the WorktreeRemove hook.
        if git_marker_present:
            print(
                f"Removed worktree {worktree_path} and deallocated its slot, but Supabase "
                "volume state was UNKNOWN — cleanup is INCOMPLETE. Run "
                f"`{REAP_HINT}` once Docker is reachable.",
                file=sys.stderr,
            )
        else:
            # PP-ew10: the .git-absent path never queried Docker, so word it for
            # that case rather than borrowing the "once Docker is reachable" story.
            # We never looked, so we can't claim volumes exist — only that any that
            # do are unreclaimed. The reason string set above is surfaced here.
            print(
                f"Deallocated the slot for {worktree_path} but never queried Docker "
                f"({volumes_unknown_reason}) — cleanup is INCOMPLETE; any Supabase "
                "volumes that exist are still on disk. Inspect the residual directory "
                f"at {worktree_path}, preserve anything needed, and remove it manually. "
                "Then remove any stale Git registration with `git worktree prune` and "
                f"reclaim Docker resources with `{REAP_HINT}`.",
                file=sys.stderr,
            )
        return EXIT_FAILED

    print(f"Cleaned up worktree: {worktree_path}", file=sys.stderr)
    return EXIT_OK


def target_from_cli() -> Path | None:
    """Parse the direct or Claude hook interface, reporting usage errors."""
    args = sys.argv[1:]
    if args == ["--claude-hook"]:
        try:
            payload = json.load(sys.stdin)
        except (json.JSONDecodeError, OSError) as exc:
            print(f"Invalid Claude WorktreeRemove payload: {exc}", file=sys.stderr)
            return None
        if not isinstance(payload, dict):
            print(
                "Invalid Claude WorktreeRemove payload: expected an object.",
                file=sys.stderr,
            )
            return None
        raw_path = payload.get("worktree_path")
        if not isinstance(raw_path, str) or not raw_path.strip():
            print(
                "Invalid Claude WorktreeRemove payload: missing worktree_path.",
                file=sys.stderr,
            )
            return None
        return Path(raw_path).resolve()

    if len(args) == 1 and args[0] != "--claude-hook":
        return Path(args[0]).resolve()

    print(
        "Usage: worktree_cleanup.py <worktree-path> | --claude-hook",
        file=sys.stderr,
    )
    return None


def main() -> int:
    worktree_path = target_from_cli()
    if worktree_path is None:
        return EXIT_FAILED
    return cleanup_worktree(worktree_path)


if __name__ == "__main__":
    sys.exit(main())

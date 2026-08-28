#!/usr/bin/env python3
"""
Worktree cleanup — the single teardown entry point for PinPoint worktrees.

Stops Supabase, removes Docker volumes, removes/prunes the git worktree, then
deallocates its manifest slot. Call it directly with one worktree path, or use
`--claude-hook` to read Claude Code's `worktree_path` JSON field from stdin.

The exit code is load-bearing: this script's caller (Claude Code's
WorktreeRemove hook) has no other way to learn that a worktree leaked. Two
rules follow from that, both of them regressions we have actually shipped:

- **A missing target is never a silent success** (PP-omz3). Being handed a path
  that isn't there used to warn and `return`, i.e. exit 0, so a wrong or
  mangled path did nothing at all — no `supabase stop`, no volume removal, no
  slot deallocation — while everything upstream believed the worktree was
  cleaned. Exit 0 now requires *evidence* of a clean state: the path absent
  from both `git worktree list` and the slot manifest.
- **Unknown is never zero** (PP-3w4g, mirroring PP-5o7b / PR #1746 in
  `worktree_orphan_sweep.py`). A failed `docker volume ls` used to collapse
  into `volumes = []`, indistinguishable from "no volumes exist", after which
  the worktree was removed and the slot deallocated while the volumes leaked.
  An unqueryable Docker now yields an explicit unknown and a non-zero exit.

Targeting matters as much as reporting: the Supabase project id comes from the
worktree's pinned `supabase/config.toml`, not from its current branch name
(PP-rbbp). Since PP-4936 the pinned id no longer follows the branch, so a
branch-derived id goes stale the moment the branch is renamed — and a volume
query filtered on a label nothing carries returns a clean, wrong zero.
"""

import fcntl
import json
import shlex
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

# Reuse the project-id resolution from worktree_setup so cleanup targets the
# same container/volume names that setup created. (Python auto-adds this
# script's directory to sys.path when invoked as `python3 worktree_cleanup.py`.)
from worktree_setup import branch_to_project_id, read_pinned_project_id  # noqa: E402

MANIFEST_PATH = Path.home() / ".config" / "pinpoint" / "worktree-slots.json"

SUPABASE_PROJECT_LABEL = "com.supabase.cli.project"

SWEEP_HINT = "python3 scripts/worktree_orphan_sweep.py --apply"

#: Everything cleaned up (or verifiably nothing to clean up).
EXIT_OK = 0
#: Usage error, or the git worktree removal itself failed.
EXIT_FAILED = 1
#: Refused to operate: the target is the main worktree.
EXIT_MAIN_WORKTREE = 2
#: The target path does not exist *and* residue for it still exists (a slot
#: manifest entry, a git worktree registration, or an unreadable source of
#: truth for either). Nothing was reclaimed, so this must not read as success.
EXIT_STALE_TARGET = 3
#: Cleanup ran but Docker could not be enumerated, so the Supabase volumes were
#: neither counted nor removed. `worktree_orphan_sweep.py` is the backstop.
#: NOTE: `worktree_orphan_sweep.py` spells its equivalent `EXIT_DOCKER_UNKNOWN = 1`
#: — the same name with a different value, deliberately. In that script 1 is free;
#: here it already means "failed", and callers distinguish these codes per script.
EXIT_DOCKER_UNKNOWN = 4


def resolve_project_id(worktree_path: Path, branch: str) -> str:
    """Pick the Supabase project id whose containers and volumes to tear down.

    A pinned id recorded in the worktree's `supabase/config.toml` always wins.
    That file is what the Supabase CLI itself reads, so it is the authoritative
    record of the id the stack was started under — and since PP-4936 it survives
    a `git checkout -b` inside a live worktree instead of following the branch.
    Deriving from the branch here would then target a label no volume carries,
    the `docker volume ls --filter` query would return an honest-looking zero,
    and the volumes would leak (PP-rbbp).

    Falls back to `branch_to_project_id(branch)` only when there is no usable
    pinned id — a worktree set up before PP-4936, or a config.toml that is
    missing, unreadable, or carries an id outside the shape setup generates.
    Same precedence as `worktree_orphan_sweep.get_active_project_ids()`.

    This deliberately does not call `worktree_setup.resolve_project_id`, whose
    precedence is identical: its divergence message is written for the setup
    path ("keeping pinned … renaming it would orphan this worktree's running
    stack"), which is the wrong story to tell during a teardown. Two callers is
    below the Rule of Three; if a third appears, hoist the shared body and pass
    the message in.
    """
    derived = branch_to_project_id(branch)
    pinned = read_pinned_project_id(worktree_path)
    if pinned is None:
        return derived
    if pinned != derived:
        print(
            f"Note: tearing down pinned Supabase project_id '{pinned}' from "
            f"{worktree_path / 'supabase' / 'config.toml'} — branch '{branch}' "
            f"would derive '{derived}', but the running stack and its volumes "
            "are labelled with the pinned id.",
            file=sys.stderr,
        )
    return pinned


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
        result = subprocess.run(
            ["git", "-C", str(repo_dir), "worktree", "list", "--porcelain"],
            capture_output=True,
            text=True,
            check=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return None
    prefix = "worktree "
    return {
        str(Path(line[len(prefix) :]).resolve())
        for line in result.stdout.splitlines()
        if line.startswith(prefix)
    }


def main_worktree_path(worktree_path: Path) -> Path | None:
    """Return Git's main worktree, which remains usable after target removal."""
    try:
        result = subprocess.run(
            [
                "git",
                "-C",
                str(worktree_path),
                "worktree",
                "list",
                "--porcelain",
            ],
            capture_output=True,
            text=True,
            check=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return None

    prefix = "worktree "
    for line in result.stdout.splitlines():
        if line.startswith(prefix):
            return Path(line[len(prefix) :]).resolve()
    return None


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
        f"lands here), then re-run with the real path or sweep with `{SWEEP_HINT}`.",
        file=sys.stderr,
    )
    return EXIT_STALE_TARGET


# These three mirror `worktree_orphan_sweep.py` by name and behaviour on
# purpose: two scripts touching the same Docker resources should fail the same
# way. The duplication is deliberate and stays until there's a third caller —
# the sweep already imports from this module, so hoisting later is a one-liner,
# but doing it now would mean editing the sweep for no behaviour change.
class DockerNotInstalledError(RuntimeError):
    """The `docker` binary is absent, so there are genuinely no volumes."""


class DockerUnavailableError(RuntimeError):
    """Docker is installed but could not be enumerated.

    Callers MUST surface this as *unknown*, never as an empty result. Swallowing
    it into `[]` is the false zero PP-3w4g reports: the worktree was then
    removed and the slot deallocated while the volumes stayed on disk.
    """


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


def list_project_volumes(project_id: str) -> VolumeQuery:
    """List Supabase volumes for `project_id`, or return an explicit unknown.

    The `--filter label=<k>=<v>` + `-q` form is honoured by both Docker and
    Podman, so this query does NOT need the two-call `volume inspect` dance that
    PP-5o7b forced on `worktree_orphan_sweep.py`. Only the error handling is
    shared with it: a query that didn't run must never look like an empty one.
    """
    try:
        stdout = _run_docker(
            [
                "docker",
                "volume",
                "ls",
                "--filter",
                f"label={SUPABASE_PROJECT_LABEL}={project_id}",
                "-q",
            ]
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
        return EXIT_MAIN_WORKTREE

    # PP-qlzu: when .git is missing (partial removal, rm -rf without the hook,
    # Claude in Web sandbox sessions), we can't derive the branch and therefore
    # can't safely target the Supabase project_id. Skip the Docker/Supabase
    # phase but still deallocate the slot — otherwise the manifest entry leaks
    # forever. worktree_orphan_sweep.py picks up any leaked Docker resources.
    git_marker_present = git_marker.is_file()
    if not git_marker_present:
        print(
            f"Warning: {worktree_path} has no .git marker — skipping Supabase/Docker "
            "cleanup (no branch to derive project_id from); deallocating slot only.",
            file=sys.stderr,
        )

    volumes_unknown_reason: str | None = None

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
        except subprocess.CalledProcessError:
            branch = ""

    if branch:
        project_id = resolve_project_id(worktree_path, branch)

        # Stop Supabase. Failures here are non-fatal: a missing project_ref or
        # a stack that was never started both look like errors but don't block
        # slot deallocation.
        print(f"Stopping Supabase for {branch}...", file=sys.stderr)
        try:
            stop_result = subprocess.run(
                ["supabase", "stop"],
                cwd=worktree_path,
                capture_output=True,
                text=True,
            )
            if stop_result.returncode != 0:
                print(
                    f"Warning: `supabase stop` exited {stop_result.returncode}: "
                    f"{stop_result.stderr.strip() or stop_result.stdout.strip()}",
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
        query = list_project_volumes(project_id)
        if query.is_unknown:
            volumes_unknown_reason = query.unknown_reason
            print(
                f"Warning: Supabase volumes for {project_id} are UNKNOWN, not zero — "
                f"{query.unknown_reason}. None were removed; if any exist they are now "
                f"orphaned. Reclaim them with `{SWEEP_HINT}`.",
                file=sys.stderr,
            )
        elif query.volumes:
            try:
                rm_result = subprocess.run(
                    ["docker", "volume", "rm", *query.volumes],
                    capture_output=True,
                    text=True,
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
            except (FileNotFoundError, OSError) as exc:
                print(
                    f"Warning: failed to invoke `docker volume rm` ({exc})",
                    file=sys.stderr,
                )
                volumes_unknown_reason = f"failed to invoke `docker volume rm`: {exc}"

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
        # The worktree and slot are gone, so the sweep (which matches on the
        # Docker label, not the manifest) will still find any leaked volumes —
        # a delayed leak, not a permanent one. But this run did NOT finish the
        # job, so it must not report success to the WorktreeRemove hook.
        print(
            f"Removed worktree {worktree_path} and deallocated its slot, but Supabase "
            "volume state was UNKNOWN — cleanup is INCOMPLETE. Run "
            f"`{SWEEP_HINT}` once Docker is reachable.",
            file=sys.stderr,
        )
        return EXIT_DOCKER_UNKNOWN

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

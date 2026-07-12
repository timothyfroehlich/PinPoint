"""Unit tests for the pre-rotation verified pull in scripts/hooks/huddle-rotate.sh.

Regression guard for PP-1d51: on 2026-07-07 the Mac ran a huddle rotation while
its local beads Dolt had diverged from the remote. The pre-rotation pull failed on
a merge conflict, but rotation continued fail-open and minted the daily bead off a
STALE local child counter — producing an id (PP-lt12.38) that already existed on
the remote, an unmergeable cross-machine Dolt conflict.

The fix makes that pull VERIFIED: if the pull fails AND the output mentions a merge
conflict, rotation aborts (non-zero exit, clear stderr) before allocating any child
id. Offline/unreachable (a non-zero pull with no conflict wording) stays fail-open —
a single active machine cannot collide, and rotation must still work without a
network.

Each test builds a throwaway git repo (so huddle_state_dir resolves to
<repo>/.agents/huddle), stubs `bd` on PATH to record its invocations and emit canned
JSON, runs huddle-rotate.sh as a subprocess, and asserts on the exit code plus
whether `bd create` was invoked (inspected via the BD_LOG).
"""

import datetime
import json
import os
import stat
import subprocess
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest

ROTATE_PATH = Path(__file__).parent.parent / "hooks" / "huddle-rotate.sh"
ROOT_ID = "PP-lt12"

_TODAY = datetime.date.today().isoformat()
_YESTERDAY = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
_THIS_MONTH = datetime.date.today().strftime("%Y-%m")


def _set_server_mode(repo: Path) -> None:
    """Write .beads/metadata.json with dolt_mode=server (main-worktree path)."""
    beads = repo / ".beads"
    beads.mkdir(exist_ok=True)
    (beads / "metadata.json").write_text(
        json.dumps({"database": "dolt", "backend": "dolt", "dolt_mode": "server"})
    )


# Root notes whose today_bead.date is YESTERDAY (rotation is needed) and whose
# monthly month is the current month (no month roll → no monthly create). `bd show`
# emits a JSON ARRAY whose [0].notes is itself a stringified JSON blob — matching
# how huddle-rotate.sh / huddle-lib.sh parse `.[0].notes`.
_ROOT_NOTES = {
    "schema_version": 1,
    "today_bead": {"id": "PP-lt12.37", "date": _YESTERDAY},
    "monthly_bead": {"id": "PP-lt12.34", "month": _THIS_MONTH},
    "recent_dailies": [{"id": "PP-lt12.37", "date": _YESTERDAY}],
    "settings": {
        "n_dailies_to_inject": 5,
        "day_boundary_tz": "local",
        "stale_name_cutoff_days": 14,
    },
    "last_rotation": f"{_YESTERDAY}T00:00:00Z",
}
_ROOT_SHOW = json.dumps([{"id": ROOT_ID, "notes": json.dumps(_ROOT_NOTES)}])

# Stub `bd`: append the full arg list to $BD_LOG, then behave per subcommand.
#   dolt pull  → print $BD_PULL_OUT (if set), exit ${BD_PULL_RC:-0}
#   dolt push  → exit 0
#   show <root> → cat $BD_SHOW_JSON (root-notes array)
#   children    → emit [] (no existing daily today → rotation would create one)
#   create      → print a fake minted id, exit 0
#   everything else (update/comments/close) → exit 0
BD_STUB = r"""#!/usr/bin/env bash
printf '%s\n' "$*" >> "$BD_LOG"
case "$1 $2" in
  "dolt pull")
    [[ -n "${BD_PULL_OUT:-}" ]] && printf '%s\n' "$BD_PULL_OUT"
    exit "${BD_PULL_RC:-0}"
    ;;
  "dolt push") exit 0 ;;
esac
case "$1" in
  show)     cat "$BD_SHOW_JSON"; exit 0 ;;
  children) [[ -n "${BD_CHILDREN_JSON:-}" ]] && cat "$BD_CHILDREN_JSON" || printf '[]\n'; exit 0 ;;
  create)   printf 'PP-lt12.99\n'; exit 0 ;;
esac
exit 0
"""


@pytest.fixture
def repo() -> Iterator[Path]:
    """A temp git repo with .agents/huddle/config.json and a stub bd on PATH."""
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        subprocess.run(["git", "init", "-q"], cwd=root, check=True)
        huddle = root / ".agents" / "huddle"
        huddle.mkdir(parents=True)
        (huddle / "config.json").write_text(
            json.dumps({"schema_version": 1, "root_bead_id": ROOT_ID})
        )
        (root / "root_show.json").write_text(_ROOT_SHOW)
        bindir = root / "bin"
        bindir.mkdir()
        bd = bindir / "bd"
        bd.write_text(BD_STUB)
        bd.chmod(bd.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
        yield root


def run_rotate(
    repo: Path, env_extra: dict[str, str] | None = None
) -> tuple[int, str, str, str]:
    """Run huddle-rotate.sh in `repo`. Returns (rc, stdout, stderr, bd_log)."""
    log = repo / "bd.log"
    env = os.environ.copy()
    env["PATH"] = f"{repo / 'bin'}{os.pathsep}{env['PATH']}"
    env["BD_LOG"] = str(log)
    env["BD_SHOW_JSON"] = str(repo / "root_show.json")
    if env_extra:
        env.update(env_extra)
    proc = subprocess.run(
        ["bash", str(ROTATE_PATH)],
        cwd=repo,
        env=env,
        capture_output=True,
        text=True,
    )
    bd_log = log.read_text() if log.exists() else ""
    return proc.returncode, proc.stdout, proc.stderr, bd_log


def _created(bd_log: str) -> bool:
    """True iff `bd create` was invoked (a daily was minted)."""
    return any(line.startswith("create ") for line in bd_log.splitlines())


# --- the regression guard --------------------------------------------------


def test_rotation_aborts_on_pull_conflict(repo: Path) -> None:
    # Pull fails with a realistic Dolt merge-conflict message. Rotation must
    # abort BEFORE minting a daily off a possibly-stale local child counter.
    conflict = (
        "merge origin/main: merge conflicts in child_counters, dependencies, "
        "issues require operator resolution; merge aborted and working set restored"
    )
    rc, _out, err, log = run_rotate(repo, {"BD_PULL_RC": "1", "BD_PULL_OUT": conflict})
    assert rc != 0, "conflicting pull must abort rotation with a non-zero exit"
    assert "refusing to rotate" in err
    # The load-bearing assertion: no child id was ever allocated.
    assert not _created(log), "bd create must NOT run when the pull hit a conflict"


# --- clean pull still rotates ----------------------------------------------


def test_rotation_proceeds_on_clean_pull(repo: Path) -> None:
    rc, _out, _err, log = run_rotate(repo, {"BD_PULL_RC": "0"})
    assert rc == 0, "a clean pull must not block rotation"
    assert _created(log), "a clean pull must mint the daily bead"


# --- offline stays fail-open -----------------------------------------------


def test_rotation_proceeds_when_offline(repo: Path) -> None:
    # Non-zero pull, but a network-style error with NO conflict wording. A single
    # active machine cannot collide, so rotation must still proceed offline.
    rc, _out, _err, log = run_rotate(
        repo,
        {"BD_PULL_RC": "1", "BD_PULL_OUT": "error: could not connect to remote"},
    )
    assert rc == 0, "an offline (non-conflict) pull failure must not block rotation"
    assert _created(log), "offline rotation must still mint the daily bead"


# --- server mode: no dolt push/pull, adopt-by-title, self-heal --------------


def test_rotation_server_mode_skips_pull_and_push(repo: Path) -> None:
    # One shared DB — no divergence, no stale child counter. Rotation must NOT
    # run any bd dolt pull/push, yet must still mint today's daily.
    _set_server_mode(repo)
    # A conflicting pull output is configured but must never be consulted (no
    # pull runs), so rotation proceeds cleanly.
    rc, _out, err, log = run_rotate(
        repo, {"BD_PULL_RC": "1", "BD_PULL_OUT": "merge conflicts require operator"}
    )
    assert rc == 0, "server-mode rotation must not consult the (skipped) pull"
    assert "refusing to rotate" not in err
    assert "dolt pull" not in log, "server mode must not pull"
    assert "dolt push" not in log, "server mode must not push"
    assert _created(log), "server-mode rotation still mints the daily bead"


def test_rotation_server_mode_adopts_existing_daily_by_title(repo: Path) -> None:
    # A peer already created today's daily on the shared DB. Rotation must ADOPT
    # it (title query) instead of minting a duplicate.
    _set_server_mode(repo)
    children = repo / "children.json"
    children.write_text(
        json.dumps(
            [
                {
                    "id": "PP-lt12.77",
                    "title": f"Huddle daily {_TODAY}",
                    "status": "open",
                }
            ]
        )
    )
    rc, out, _err, log = run_rotate(repo, {"BD_CHILDREN_JSON": str(children)})
    assert rc == 0
    assert not _created(log), (
        "an existing daily for today must be adopted, not recreated"
    )
    assert "NEW_TODAY=PP-lt12.77" in out


def test_rotation_server_mode_self_heals_missing_daily(repo: Path) -> None:
    # No daily exists for today (e.g. it was deleted). The title query returns
    # empty, so rotation self-heals by creating today's daily.
    _set_server_mode(repo)
    empty = repo / "children.json"
    empty.write_text("[]")
    rc, _out, _err, log = run_rotate(repo, {"BD_CHILDREN_JSON": str(empty)})
    assert rc == 0
    assert _created(log), "a missing daily must be (re)created by rotation"

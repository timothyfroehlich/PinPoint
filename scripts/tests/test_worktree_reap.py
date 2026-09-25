"""End-to-end tests for worktree_reap.py (PP-49x5, PP-5o7b).

The command deletes worktrees and Docker resources, so these tests pin the
predicates that decide what goes:

- A finished worktree is reaped only on positive proof: merged-SHA equality
  (never `merge-base --is-ancestor`: PinPoint squash-merges, so a merged tip is
  never an ancestor of `main`), or "carries nothing" (clean, zero commits ahead,
  a day old). The absence of a PR proves nothing — an agent mid-task has none.
- An orphan is a project_id no live worktree claims, and a slot is released
  only once its stack is gone and its ports are closed.
- A failed `gh` or Docker query is UNKNOWN, never zero: it is reported, and
  nothing is removed on its strength.

Real throwaway git repositories and worktrees. `gh` and `docker` are stubs on
PATH — the docker stub plays both daemons (keyed by DOCKER_HOST) and, like
Podman, rejects `volume ls --format '{{.Label ...}}'`. `worktree_cleanup.py` is
a stub and the slot manifest a temp file: nothing here reaches GitHub, a real
Docker daemon, or the real manifest.
"""

import json
import os
import stat
import subprocess
import sys
import time
from collections.abc import Callable
from pathlib import Path

import pytest

pytestmark = pytest.mark.integration

sys.path.insert(0, str(Path(__file__).parent.parent))

import worktree_cleanup  # noqa: E402
import worktree_reap as reap  # noqa: E402

REMOTE = "ssh://bazzite"

GH_STUB = """#!/usr/bin/env bash
printf "%s\\n" "$PWD" >> "$GH_STUB_CWDS"
if [[ -n "${GH_STUB_FAIL:-}" ]]; then
  echo "gh: could not connect to api.github.com" >&2
  exit 1
fi
branch=""
prev=""
for a in "$@"; do
  if [[ "$prev" == "--head" ]]; then branch="$a"; fi
  prev="$a"
done
file="$GH_STUB_DIR/${branch//\\//__}.json"
if [[ -f "$file" ]]; then cat "$file"; else echo "[]"; fi
"""

DOCKER_STUB = """#!PYTHON
import json, os, sys, time
args = sys.argv[1:]
host = os.environ.get("DOCKER_HOST", "local")
with open(os.environ["DOCKER_STUB_LOG"], "a") as log:
    log.write(json.dumps([host, *args]) + "\\n")
daemon = json.load(open(os.environ["DOCKER_STUB_STATE"])).get(host, {})
time.sleep(daemon.get("sleep", 0))
kind = args[0] if args[0] in ("ps", "rm") else " ".join(args[:2])
if kind in daemon.get("fail", {}):
    code, message = daemon["fail"][kind]
    print(message, file=sys.stderr)
    sys.exit(code)
if kind == "volume ls" and any(".Label" in a for a in args):
    print("Error: template: ls:1:23: executing \\"ls\\" at <.Label>: can't evaluate "
          "field Label in type *types.VolumeListReport", file=sys.stderr)
    sys.exit(125)
volumes = dict(daemon.get("volumes", []))
if kind == "volume ls":
    print("\\n".join(volumes))
elif kind == "volume inspect":
    print("\\n".join(f"{n}|{volumes[n]}" for n in args[4:] if n in volumes))
elif kind == "ps":
    print("\\n".join("|".join(row) for row in daemon.get("containers", [])))
"""

FAKE_CLEANUP = """import json, sys
target = sys.argv[1]
open(CALLS, "a").write(target + "\\n")
print("fake cleanup ran for " + target, file=sys.stderr)
sys.exit(json.load(open(CODES)).get(target, 0))
"""


def git(*args: str, cwd: Path) -> str:
    result = subprocess.run(
        ["git", *args], cwd=cwd, capture_output=True, text=True, check=True
    )
    return result.stdout.strip()


def executable(path: Path, content: str) -> None:
    path.write_text(content)
    path.chmod(path.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)


class World:
    """An origin, a checkout, its worktrees, and stubbed gh/docker/cleanup."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.repo = root / "repo"
        self.bin = root / "bin"
        self.gh_data = root / "ghdata"
        self.gh_cwds = root / "gh-cwds"
        self.docker_state_file = root / "docker-state.json"
        self.docker_log = root / "docker-log.jsonl"
        self.manifest = root / "worktree-slots.json"
        self.cleanup_calls_file = root / "cleanup-calls"
        self.cleanup_codes = root / "cleanup-codes.json"
        self.cleanup_script = root / "fake_cleanup.py"
        self.open_slots: set[int] = set()
        self.mp: pytest.MonkeyPatch
        self.capsys: pytest.CaptureFixture[str]
        self.docker: dict[str, dict[str, object]] = {}
        for directory in (self.repo, self.bin, self.gh_data):
            directory.mkdir()
        subprocess.run(
            ["git", "init", "--bare", "-b", "main", str(root / "origin.git")],
            check=True,
            capture_output=True,
        )
        git("init", "-b", "main", cwd=self.repo)
        git("config", "user.email", "test@example.invalid", cwd=self.repo)
        git("config", "user.name", "Test", cwd=self.repo)
        git("config", "commit.gpgsign", "false", cwd=self.repo)
        git("remote", "add", "origin", str(root / "origin.git"), cwd=self.repo)
        self.commit_on_main("README.md", "hello\n")
        executable(self.bin / "gh", GH_STUB)
        executable(self.bin / "docker", DOCKER_STUB.replace("PYTHON", sys.executable))
        self.cleanup_script.write_text(
            f"CALLS = {str(self.cleanup_calls_file)!r}\n"
            f"CODES = {str(self.cleanup_codes)!r}\n" + FAKE_CLEANUP
        )
        self.fake_cleanup({})
        self.save_docker()

    # --- git and gh ---

    def commit_on_main(self, name: str, content: str) -> None:
        (self.repo / name).parent.mkdir(parents=True, exist_ok=True)
        (self.repo / name).write_text(content)
        git("add", name, cwd=self.repo)
        git("commit", "-m", f"main: {name}", cwd=self.repo)
        git("push", "-u", "origin", "main", cwd=self.repo)

    def add_worktree(
        self, branch: str, path: Path | None = None, age_hours: float = 48
    ) -> Path:
        """A worktree on a new `branch`, or detached at origin/main for ""."""
        path = path or self.root / "worktrees" / (branch.replace("/", "__") or "head")
        path.parent.mkdir(parents=True, exist_ok=True)
        where = ["-b", branch, str(path)] if branch else ["--detach", str(path)]
        git("worktree", "add", *where, "origin/main", cwd=self.repo)
        stamp = time.time() - age_hours * 3600  # reap reads `.git`'s mtime as age
        os.utime(path / ".git", (stamp, stamp))
        return path

    def commit_in(self, worktree: Path, name: str, content: str) -> str:
        (worktree / name).write_text(content)
        git("add", name, cwd=worktree)
        git("commit", "-m", f"work: {name}", cwd=worktree)
        return git("rev-parse", "HEAD", cwd=worktree)

    def set_prs(self, branch: str, *prs: dict[str, object]) -> None:
        target = self.gh_data / f"{branch.replace('/', '__')}.json"
        target.write_text(json.dumps(list(prs)))

    def add_prototype_scaffold_to_main(self) -> None:
        self.commit_on_main("src/app/(dev)/prototype/layout.tsx", "export {};\n")
        self.commit_on_main(
            ".gitignore",
            ".prototype-mode\n"
            "/src/app/(dev)/prototype/**\n"
            "!/src/app/(dev)/prototype/layout.tsx\n",
        )

    def fake_cleanup(self, codes: dict[str, int]) -> None:
        self.cleanup_codes.write_text(json.dumps(codes))

    def cleanup_calls(self) -> list[str]:
        if not self.cleanup_calls_file.exists():
            return []
        return self.cleanup_calls_file.read_text().splitlines()

    # --- docker and slots ---

    def daemon(self, host: str) -> dict[str, object]:
        return self.docker.setdefault(host, {"containers": [], "volumes": []})

    def save_docker(self) -> None:
        self.docker_state_file.write_text(json.dumps(self.docker))

    def add_stack(
        self, pid: str, workdir: str = "", host: str = "local", running: bool = True
    ) -> None:
        """A project with one db volume and, unless stopped, one container."""
        daemon = self.daemon(host)
        if running:
            daemon["containers"].append([f"supabase_db_{pid}", pid, workdir])  # type: ignore[union-attr]
        daemon["volumes"].append([f"supabase_db_{pid}", pid])  # type: ignore[union-attr]
        self.save_docker()

    def fail(self, kind: str, code: int, message: str, host: str = "local") -> None:
        self.daemon(host).setdefault("fail", {})[kind] = [code, message]  # type: ignore[index]
        self.save_docker()

    def docker_calls(self, host: str = "local") -> list[list[str]]:
        if not self.docker_log.exists():
            return []
        rows = [json.loads(line) for line in self.docker_log.read_text().splitlines()]
        return [row[1:] for row in rows if row[0] == host]

    def removals(self, host: str = "local") -> list[list[str]]:
        return [
            call
            for call in self.docker_calls(host)
            if call[0] == "rm" or call[:2] in (["network", "rm"], ["volume", "rm"])
        ]

    def run(self, *extra: str) -> tuple[int, str, str]:
        """Run reap in-process; returns (exit code, stdout, stderr)."""
        argv = ["worktree_reap.py", "--repo-dir", str(self.repo), *extra]
        self.mp.setattr(sys, "argv", argv)
        code = reap.main()
        captured = self.capsys.readouterr()
        return code, captured.out, captured.err

    def gone(self, name: str) -> str:
        """A worktree path on this machine (under HOME) that no longer exists."""
        return str(self.root / "gone" / name)

    def set_slots(self, slots: dict[str, int]) -> None:
        self.manifest.write_text(json.dumps({"version": 1, "slots": slots}))

    def slots(self) -> dict[str, int]:
        return json.loads(self.manifest.read_text())["slots"]


@pytest.fixture
def world(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> World:
    built = World(tmp_path)
    monkeypatch.setenv("PATH", f"{built.bin}{os.pathsep}{os.environ['PATH']}")
    monkeypatch.setenv("GH_STUB_DIR", str(built.gh_data))
    monkeypatch.setenv("GH_STUB_CWDS", str(built.gh_cwds))
    monkeypatch.setenv("DOCKER_STUB_STATE", str(built.docker_state_file))
    monkeypatch.setenv("DOCKER_STUB_LOG", str(built.docker_log))
    # Gone worktree paths under tmp_path count as this machine's.
    monkeypatch.setenv("HOME", str(tmp_path))
    for name in (
        "GH_STUB_FAIL",
        "DOCKER_HOST",
        "DOCKER_CONTEXT",
        "PINPOINT_REMOTE_DOCKER_HOST",
        "PINPOINT_REMOTE_SUPABASE_HOST",
        "PINPOINT_SUPABASE_BACKEND",
    ):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(worktree_cleanup, "MANIFEST_PATH", built.manifest)
    monkeypatch.setattr(reap, "CLEANUP_SCRIPT", built.cleanup_script)
    monkeypatch.setattr(
        reap, "slot_ports_in_use", lambda slot: slot in built.open_slots
    )
    # A real /proc scan depends on the host; tests that care patch it back.
    monkeypatch.setattr(reap, "live_process_cwds", lambda: (set(), None))
    monkeypatch.chdir(tmp_path)  # the cwd guard must not see pytest's cwd
    built.mp, built.capsys = monkeypatch, capsys
    return built


def tier_of(stderr: str, branch: str) -> str:
    """Read one branch's tier back out of the report."""
    section = None
    for line in stderr.splitlines():
        for tier in (reap.TIER_REAP, reap.TIER_REVIEW, reap.TIER_KEEP):
            if line.startswith(f"{tier} ") or line.startswith(f"{tier}:"):
                section = tier
        if line.strip().startswith(f"- {branch} ["):
            assert section is not None
            return section
    raise AssertionError(f"{branch} not present in report:\n{stderr}")


def merged(number: int, sha: str) -> dict[str, object]:
    return {"number": number, "state": "MERGED", "headRefOid": sha}


# --- Finished worktrees ------------------------------------------------------


def squash_merged(w: World) -> None:
    """The regression guard: an is-ancestor implementation fails this one."""
    wt = w.add_worktree("feat/squashed")
    sha = w.commit_in(wt, "feature.py", "print(1)\n")
    w.set_prs("feat/squashed", merged(11, sha))
    w.commit_on_main("feature.py", "print(1)\n")  # the squash: same content, new SHA
    premise = subprocess.run(
        ["git", "-C", str(wt), "merge-base", "--is-ancestor", sha, "origin/main"]
    )
    assert premise.returncode != 0, "a squashed tip is not an ancestor of main"


def commits_after_merge(w: World) -> None:
    wt = w.add_worktree("feat/kept-going")
    w.set_prs("feat/kept-going", merged(12, w.commit_in(wt, "a.py", "1\n")))
    w.commit_in(wt, "b.py", "2\n")


def dirty_merged(w: World) -> None:
    wt = w.add_worktree("feat/dirty")
    w.set_prs("feat/dirty", merged(13, w.commit_in(wt, "a.py", "1\n")))
    (wt / "a.py").write_text("uncommitted\n")


def untracked_only(w: World) -> None:
    """Empty and old, but a plan doc that exists nowhere else blocks the reap."""
    (w.add_worktree("worktree-notes") / "PLAN.md").write_text("the only copy\n")


def gitignored_generated(w: World) -> None:
    """Every worktree has generated `.env.local`; if it were dirt, nothing reaps."""
    w.commit_on_main(".gitignore", ".env.local\n")
    (w.add_worktree("worktree-generated") / ".env.local").write_text("PORT=3010\n")


def prototype_layout(w: World) -> None:
    w.add_prototype_scaffold_to_main()
    w.add_worktree("worktree-proto-layout")


def prototype_marker(w: World) -> None:
    w.add_prototype_scaffold_to_main()
    wt = w.add_worktree("worktree-proto-marker")
    (wt / ".prototype-mode").write_text("# Prototype mode\n")
    assert git("status", "--porcelain", cwd=wt) == "", "premise: the marker is ignored"


def prototype_route(w: World) -> None:
    w.add_prototype_scaffold_to_main()
    wt = w.add_worktree("worktree-proto-route")
    route = wt / "src/app/(dev)/prototype/alerts/page.tsx"
    route.parent.mkdir()
    route.write_text("export default null;\n")
    assert git("status", "--porcelain", cwd=wt) == "", "premise: the route is ignored"


def open_pr(w: World) -> None:
    wt = w.add_worktree("feat/review")
    sha = w.commit_in(wt, "a.py", "1\n")
    w.set_prs("feat/review", {"number": 20, "state": "OPEN", "headRefOid": sha})


def open_outranks_merged(w: World) -> None:
    sha = w.commit_in(w.add_worktree("feat/reused"), "a.py", "1\n")
    w.set_prs(
        "feat/reused",
        merged(21, sha),
        {"number": 22, "state": "OPEN", "headRefOid": sha},
    )


def commit_without_pr(w: World) -> None:
    """An agent mid-task: commits, no PR yet. It must survive."""
    w.commit_in(w.add_worktree("feat/wip"), "wip.py", "1\n")


def closed_unmerged(w: World) -> None:
    sha = w.commit_in(w.add_worktree("feat/abandoned"), "wip.py", "1\n")
    w.set_prs("feat/abandoned", {"number": 14, "state": "CLOSED", "headRefOid": sha})


def young_empty(w: World) -> None:
    """A running agent's brand-new worktree has no commits yet."""
    w.add_worktree("worktree-just-started", age_hours=1)


def detached_empty(w: World) -> None:
    w.add_worktree("")


def live_process(w: World) -> None:
    wt = w.add_worktree("worktree-busy")
    w.mp.setattr(reap, "live_process_cwds", lambda: ({str(wt / "src")}, None))


def own_cwd(w: World) -> None:
    w.mp.chdir(w.add_worktree("worktree-self"))


Setup = Callable[[World], None]
SCENARIOS: list[tuple[Setup, str, str, str]] = [
    (squash_merged, "feat/squashed", reap.TIER_REAP, "[merged]"),
    (commits_after_merge, "feat/kept-going", reap.TIER_REVIEW, "after the merge"),
    (dirty_merged, "feat/dirty", reap.TIER_REVIEW, "working tree is dirty"),
    (untracked_only, "worktree-notes", reap.TIER_REVIEW, "working tree is dirty"),
    (gitignored_generated, "worktree-generated", reap.TIER_REAP, "[empty]"),
    (prototype_layout, "worktree-proto-layout", reap.TIER_REAP, "[empty]"),
    (prototype_marker, "worktree-proto-marker", reap.TIER_REVIEW, "dirty"),
    (prototype_route, "worktree-proto-route", reap.TIER_REVIEW, "dirty"),
    (open_pr, "feat/review", reap.TIER_KEEP, "open PR #20"),
    (open_outranks_merged, "feat/reused", reap.TIER_KEEP, "open PR #22"),
    (commit_without_pr, "feat/wip", reap.TIER_REVIEW, "1 commit(s) ahead"),
    (closed_unmerged, "feat/abandoned", reap.TIER_REVIEW, "1 commit(s) ahead"),
    (young_empty, "worktree-just-started", reap.TIER_KEEP, "created 1h ago"),
    (detached_empty, "(detached)", reap.TIER_REAP, "[empty]"),
    (live_process, "worktree-busy", reap.TIER_KEEP, "live process cwd"),
    (own_cwd, "worktree-self", reap.TIER_KEEP, "invoking process's cwd"),
]


@pytest.mark.parametrize(
    ("setup", "branch", "tier", "reason"),
    SCENARIOS,
    ids=[scenario[0].__name__ for scenario in SCENARIOS],
)
def test_classification(
    world: World,
    setup: Setup,
    branch: str,
    tier: str,
    reason: str,
) -> None:
    setup(world)

    code, _, err = world.run()

    assert code == reap.EXIT_OK, err
    assert tier_of(err, branch) == tier, err
    assert reason in err


def test_every_harness_path_is_inventoried_and_the_main_worktree_never(
    world: World,
) -> None:
    paths = {
        "claude-task": world.root / ".claude/worktrees/agent-123",
        "codex-task": world.root / ".codex/worktrees/74f7/PinPoint",
        "antigravity-task": world.root / ".gemini/antigravity/worktrees/PinPoint/x",
    }
    for branch, path in paths.items():
        world.add_worktree(branch, path)

    code, _, err = world.run()

    assert code == reap.EXIT_OK, err
    report = {line.strip() for line in err.splitlines()}
    for branch, path in paths.items():
        assert tier_of(err, branch) == reap.TIER_REAP
        assert str(path.resolve()) in report
    assert str(world.repo.resolve()) not in report


def test_gh_is_asked_from_the_repo_and_only_when_it_could_matter(world: World) -> None:
    """`gh` picks the repository from its own cwd, and this runs from anywhere:
    another repo's same-named merged branch would read as proof. A settled-empty
    worktree needs no lookup at all — that is the GitHub quota saving."""
    elsewhere = world.root / "somewhere-else"
    elsewhere.mkdir()
    world.mp.chdir(elsewhere)
    wt = world.add_worktree("feat/landed")
    world.set_prs("feat/landed", merged(50, world.commit_in(wt, "a.py", "1\n")))
    world.add_worktree("worktree-idle")

    code, _, err = world.run()

    assert code == reap.EXIT_OK, err
    assert tier_of(err, "feat/landed") == reap.TIER_REAP
    assert tier_of(err, "worktree-idle") == reap.TIER_REAP
    assert world.gh_cwds.read_text().splitlines() == [str(world.repo)]


def test_an_unreachable_gh_reaps_nothing_that_needed_it(world: World) -> None:
    """Unknown is never mergedness. The dry run still exits 0 with its report:
    orchestration-status.sh drops the whole report on a non-zero exit."""
    landed = world.add_worktree("feat/landed")
    world.set_prs("feat/landed", merged(30, world.commit_in(landed, "a.py", "1\n")))
    idle = world.add_worktree("worktree-idle")
    world.mp.setenv("GH_STUB_FAIL", "1")

    code, _, err = world.run()

    assert code == reap.EXIT_OK
    assert "PR state UNKNOWN for 1 branch(es) (feat/landed)" in err
    assert "- feat/landed [PR state UNKNOWN" in err
    assert tier_of(err, "feat/landed") == reap.TIER_REVIEW
    assert tier_of(err, "worktree-idle") == reap.TIER_REAP  # asked nothing of gh

    code, out, _ = world.run("--apply")

    assert code == reap.EXIT_FAILED
    assert world.cleanup_calls() == [str(idle)]
    assert f"REAPED: {landed}" not in out


def test_apply_reaps_through_cleanup_and_a_failure_fails_the_run(world: World) -> None:
    """Cleanup's stderr is the only record of what leaked; --quiet keeps it.
    REAPED goes to stdout, where merge-pr.sh shows it next to `MERGED:`."""
    first = world.add_worktree("worktree-a")
    second = world.add_worktree("worktree-b")
    world.commit_in(world.add_worktree("feat/wip"), "wip.py", "1\n")
    world.fake_cleanup({str(first): 1})

    code, out, err = world.run("--apply", "--quiet")

    assert code == reap.EXIT_FAILED
    assert world.cleanup_calls() == [str(first), str(second)]  # never REVIEW
    assert f"| fake cleanup ran for {first}" in err
    assert f"{first}: worktree_cleanup.py FAILED (exit 1)" in err
    assert out == f"REAPED: {second}\n"


def test_branch_scopes_the_run_to_one_worktree_and_skips_orphans(world: World) -> None:
    """merge-pr.sh reaps exactly the branch it just merged, nothing else."""
    target = world.add_worktree("feat/landed")
    world.set_prs("feat/landed", merged(40, world.commit_in(target, "a.py", "1\n")))
    world.add_worktree("worktree-idle")
    world.add_stack("pinpoint-dead")
    world.set_slots({world.gone("dead"): 5})

    code, out, _ = world.run("--apply", "--quiet", "--branch", "feat/landed")

    assert code == reap.EXIT_OK
    assert world.cleanup_calls() == [str(target)]
    assert out == f"REAPED: {target}\n"
    assert world.docker_calls() == []
    assert world.slots() == {world.gone("dead"): 5}

    code, out, err = world.run("--apply", "--quiet", "--branch", "feat/gone")

    assert (code, out, err) == (reap.EXIT_OK, "", "")


def test_quiet_prints_one_nudge_line_and_only_when_there_is_something(
    world: World,
) -> None:
    world.commit_in(world.add_worktree("feat/wip"), "wip.py", "1\n")

    assert world.run("--quiet") == (reap.EXIT_OK, "", "")

    world.add_worktree("worktree-idle")

    code, out, err = world.run("--quiet")

    assert (code, out) == (reap.EXIT_OK, "")
    assert err.splitlines() == [
        "worktree-reap: 1 finished worktree(s), 0 orphan stack(s) and 0 orphan "
        "slot(s) reclaimable (dry-run). Run `python3 scripts/worktree_reap.py` for "
        "the report, `--apply` to reclaim."
    ]


# --- Orphans -----------------------------------------------------------------


def test_a_local_orphan_is_reported_then_removed_in_order(world: World) -> None:
    """The local daemon runs only this machine's stacks, so a foreign-looking
    workdir label does not protect one. Volumes are listed by label filter —
    the stub, like Podman, rejects `volume ls --format '{{.Label ...}}'`."""
    world.add_stack("pinpoint-dead", workdir="/Users/someone/Code/PinPoint/x")

    code, _, err = world.run()

    assert code == reap.EXIT_OK, err
    assert "Supabase stacks on local Docker: 1 orphan(s)" in err
    assert "pinpoint-dead: 1 container(s), 1 volume(s)" in err
    assert world.removals() == []
    ls = next(c for c in world.docker_calls() if c[:2] == ["volume", "ls"])
    assert "label=com.supabase.cli.project" in ls
    assert not any(".Label" in arg for arg in ls)

    code, _, err = world.run("--apply")

    assert code == reap.EXIT_OK, err
    assert world.removals() == [
        ["rm", "-f", "supabase_db_pinpoint-dead"],
        ["network", "rm", "supabase_network_pinpoint-dead"],
        ["volume", "rm", "supabase_db_pinpoint-dead"],
    ]


def test_stacks_of_live_worktrees_and_the_main_worktree_are_never_orphans(
    world: World,
) -> None:
    """Every stack here is stopped (volumes only): "no container" must never
    mean orphaned. The config.toml id wins; otherwise setup's derived id. A
    stopped stack's network is already gone, which is not a failure."""
    pinned = world.add_worktree("feat/renamed", age_hours=1)
    (pinned / "supabase").mkdir()
    (pinned / "supabase/config.toml").write_text('project_id = "pinpoint-pinned"\n')
    derived = world.add_worktree("feat/derived", age_hours=1)
    detached = world.add_worktree("")
    for pid in (
        "pinpoint-pinned",
        reap.derive_project_id(derived, "feat/derived"),
        reap.derive_project_id(detached, "HEAD"),
        "pinpoint-main",  # the main worktree's derived id
        "pinpoint-dead",
    ):
        world.add_stack(pid, running=False)
    world.fail("network rm", 1, "Error: network supabase_network_x not found")

    code, _, err = world.run("--apply")

    assert code == reap.EXIT_OK, err
    assert "FAILED" not in err
    assert world.removals() == [
        ["network", "rm", "supabase_network_pinpoint-dead"],
        ["volume", "rm", "supabase_db_pinpoint-dead"],
    ]


def test_a_failed_container_removal_keeps_network_volumes_and_slot(
    world: World,
) -> None:
    gone = world.gone("dead")
    world.add_stack("pinpoint-dead", workdir=gone)
    world.set_slots({gone: 5})
    world.fail("rm", 1, "permission denied")

    code, _, err = world.run("--apply")

    assert code == reap.EXIT_FAILED
    assert "FAILED removing pinpoint-dead's container(s) on local Docker" in err
    assert "permission denied" in err
    assert world.removals() == [["rm", "-f", "supabase_db_pinpoint-dead"]]
    assert world.slots() == {gone: 5}


@pytest.mark.parametrize("query", ["volume ls", "volume inspect", "ps"])
def test_a_failed_docker_query_is_unknown_never_zero(
    world: World,
    query: str,
) -> None:
    """PP-5o7b: a swallowed failure once read as `0 volume(s)`, and ~557 MB of
    orphan volumes piled up behind a silent nudge."""
    gone = world.gone("dead")
    world.add_stack("pinpoint-dead", workdir=gone)
    world.set_slots({gone: 5})
    world.fail(query, 1, "Cannot connect to the Docker daemon")

    code, _, err = world.run()

    assert code == reap.EXIT_OK
    assert "Supabase stacks on local Docker: UNKNOWN, not zero" in err
    assert "Cannot connect to the Docker daemon" in err
    assert "orphan(s)" not in err
    assert f"slot 5 {gone}: held — Docker state UNKNOWN on local Docker" in err

    code, _, err = world.run("--quiet")

    assert code == reap.EXIT_OK
    assert "UNKNOWN, not zero: Supabase stacks on local Docker" in err

    code, _, _ = world.run("--apply")

    assert code == reap.EXIT_FAILED
    assert world.removals() == []
    assert world.slots() == {gone: 5}


def test_a_slot_is_released_only_once_its_stack_is_gone_and_its_ports_closed(
    world: World,
) -> None:
    """A reused slot must never collide with a leftover stack's ports."""
    free, busy, stacked = world.gone("free"), world.gone("busy"), world.gone("stacked")
    live = world.add_worktree("feat/live", age_hours=1)
    world.set_slots({free: 1, busy: 2, stacked: 3, str(live): 4})
    world.open_slots.add(2)
    world.add_stack("pinpoint-stacked", workdir=f"{stacked}/.agent/tmp")

    code, _, err = world.run()

    assert code == reap.EXIT_OK, err
    assert f"slot 1 {free}: reclaimable" in err
    assert f"slot 2 {busy}: held — its Supabase ports are still open" in err
    assert f"slot 3 {stacked}: held — stack pinpoint-stacked still references it" in err
    assert f"slot 4 {live}" not in err
    assert len(world.slots()) == 4

    code, _, err = world.run("--apply")

    assert code == reap.EXIT_OK, err
    assert world.slots() == {busy: 2, str(live): 4}


# --- Remote backend ----------------------------------------------------------


def test_a_remote_orphan_is_removed_through_docker_host_and_its_slot_freed(
    world: World,
) -> None:
    world.mp.setenv("PINPOINT_REMOTE_DOCKER_HOST", REMOTE)
    gone = world.gone("dead")
    world.add_stack("pinpoint-dead", workdir=gone, host=REMOTE)
    world.set_slots({gone: 5})

    code, _, err = world.run("--apply")

    assert code == reap.EXIT_OK, err
    assert f"Supabase stacks on {REMOTE}: 1 orphan(s)" in err
    assert world.removals(REMOTE) == [
        ["rm", "-f", "supabase_db_pinpoint-dead"],
        ["network", "rm", "supabase_network_pinpoint-dead"],
        ["volume", "rm", "supabase_db_pinpoint-dead"],
    ]
    assert world.removals() == []
    assert world.slots() == {}


def test_remote_stacks_that_are_not_this_machines_orphans_are_never_removed(
    world: World,
) -> None:
    """Crabbox runners (even under this machine's paths), the remote host's own
    checkouts, and a live worktree whose labels point at its old path. A stopped
    stack has volumes only and volumes carry no workdir label, so it cannot be
    attributed: it is reported for a person, and it holds no slot."""
    world.mp.setenv("PINPOINT_REMOTE_DOCKER_HOST", REMOTE)
    world.add_stack("pinpoint-stopped", host=REMOTE, running=False)
    world.set_slots({world.gone("stopped"): 6})
    moved = world.add_worktree("feat/moved", age_hours=1)
    (moved / "supabase").mkdir()
    (moved / "supabase/config.toml").write_text('project_id = "pinpoint-moved"\n')
    world.add_stack("pinpoint-moved", workdir=world.gone("old-path"), host=REMOTE)
    world.add_stack(
        "pinpoint-runner-crabbox-2", workdir=world.gone("crabbox"), host=REMOTE
    )
    world.add_stack(
        "pinpoint-bazzite-checkout", workdir="/var/home/froeht/PinPoint", host=REMOTE
    )

    code, _, err = world.run("--apply")

    assert code == reap.EXIT_OK, err
    assert f"Supabase stacks on {REMOTE}: 0 orphan(s)" in err
    assert "pinpoint-stopped: 1 volume(s) with no workdir label" in err
    assert world.removals(REMOTE) == []
    assert "crabbox" not in err
    assert "bazzite-checkout" not in err
    assert world.slots() == {}  # nothing references the path; its ports are closed


@pytest.mark.parametrize(
    ("setup", "reason"),
    [
        ("unreachable", "ssh: connect to host bazzite port 22: Operation timed out"),
        ("docker-host-unset", "PINPOINT_REMOTE_DOCKER_HOST is unset"),
    ],
)
def test_an_unreadable_remote_is_unknown_and_holds_slots(
    world: World,
    setup: str,
    reason: str,
) -> None:
    gone = world.gone("dead")
    world.set_slots({gone: 5})
    if setup == "unreachable":
        world.mp.setenv("PINPOINT_REMOTE_DOCKER_HOST", REMOTE)
        world.add_stack("pinpoint-dead", workdir=gone, host=REMOTE)
        world.fail("volume ls", 255, reason, host=REMOTE)
    else:  # a live worktree's .env.local proves the remote backend is in use
        live = world.add_worktree("feat/remote", age_hours=1)
        (live / ".env.local").write_text("PINPOINT_SUPABASE_BACKEND=remote\n")

    code, _, err = world.run("--quiet")

    assert code == reap.EXIT_OK
    assert "UNKNOWN, not zero: Supabase stacks on" in err

    code, _, err = world.run("--apply")

    assert code == reap.EXIT_FAILED
    assert reason in err
    assert world.removals(REMOTE) == []
    assert world.slots() == {gone: 5}


@pytest.mark.parametrize("flags", [("--quiet",), ()], ids=["session-start", "briefing"])
def test_a_dry_run_bounds_every_docker_call(
    world: World, flags: tuple[str, ...]
) -> None:
    """A hung remote daemon must read as UNKNOWN before the SessionStart hook's
    cap, and must not stall the briefing's plain dry run either."""
    world.mp.setattr(reap, "REPORT_BUDGET_SECONDS", 1.0)
    world.mp.setenv("PINPOINT_REMOTE_DOCKER_HOST", REMOTE)
    world.daemon(REMOTE)["sleep"] = 30
    world.save_docker()
    started = time.monotonic()

    code, _, err = world.run(*flags)

    assert time.monotonic() - started < 10
    assert code == reap.EXIT_OK
    assert f"Supabase stacks on {REMOTE}" in err
    assert "UNKNOWN, not zero" in err

"""Regression tests for worktree_orphan_sweep.py Docker enumeration (PP-5o7b).

The bug these lock down: `docker volume ls --format '{{.Label "…"}}'` blows up on
Podman (`can't evaluate field Label in type *types.VolumeListReport`, exit 125),
and the old code swallowed that into an empty list. The sweep then printed
`0 volume(s)` — a *false zero* that reads as "there are none" — so `--apply`
removed the containers, claimed success, and left ~557 MB of volumes on disk
while the 6-hourly SessionStart nudge stayed silent.

So the invariant under test is not "volumes are listed", it is **a failed query
must report UNKNOWN, never 0**, and `--apply` must not touch Docker when it
can't see. Docker is mocked at the subprocess boundary; these tests never touch
the real daemon.
"""

import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

import worktree_orphan_sweep as sweep  # noqa: E402

LABEL = "com.supabase.cli.project"

# The exact stderr the real Podman CLI emits for the old broken template.
TEMPLATE_ERROR = (
    'Error: template: ls:1:23: executing "ls" at <.Label>: '
    "can't evaluate field Label in type *types.VolumeListReport"
)


def test_git_inventory_keeps_all_harness_worktree_paths(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Claude, Codex, and Antigravity paths need no provider-specific filter."""
    paths = {
        str((tmp_path / ".claude/worktrees/agent-123").resolve()): "claude-task",
        str((tmp_path / ".codex/worktrees/74f7/PinPoint").resolve()): "codex-task",
        str(
            (tmp_path / ".gemini/antigravity/worktrees/PinPoint/feature").resolve()
        ): "antigravity-task",
    }
    porcelain = "".join(
        f"worktree {path}\nHEAD deadbeef\nbranch refs/heads/{branch}\n\n"
        for path, branch in paths.items()
    )

    monkeypatch.setattr(
        sweep.subprocess,
        "run",
        lambda *_args, **_kwargs: subprocess.CompletedProcess(
            _args[0], 0, porcelain, ""
        ),
    )

    assert sweep.get_active_worktree_branches(tmp_path) == paths


def test_git_inventory_failure_aborts_instead_of_reporting_no_worktrees(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """An empty inventory would mark every live stack as an orphan for --apply."""

    def fail(*args, **_kwargs):
        raise subprocess.CalledProcessError(128, args[0], "", "not a git repository")

    monkeypatch.setattr(sweep.subprocess, "run", fail)

    with pytest.raises(SystemExit) as exc:
        sweep.get_active_worktree_branches(tmp_path)
    assert "not a git repository" in str(exc.value.code)


def _kind(args: list[str]) -> str:
    """Classify a docker argv so the stub can answer per-subcommand."""
    if not args or args[0] != "docker":
        return "other"
    head = tuple(args[1:3])
    if head == ("volume", "ls"):
        return "volume_ls"
    if head == ("volume", "inspect"):
        return "volume_inspect"
    if head == ("volume", "rm"):
        return "volume_rm"
    if args[1] == "ps":
        return "ps"
    if args[1] == "rm":
        return "container_rm"
    return "other"


class DockerStub:
    """Stands in for subprocess.run, answering docker calls from a script.

    Calls made with `DOCKER_HOST` in their env are answered from `remote`, so
    one stub can play both the local and the remote daemon.
    """

    def __init__(
        self, remote: dict[str, object] | None = None, **responses: object
    ) -> None:
        # Each response is either a CompletedProcess-ish tuple
        # (returncode, stdout, stderr) or an exception instance to raise.
        self.responses = responses
        self.remote = remote or {}
        self.calls: list[list[str]] = []
        self.remote_calls: list[list[str]] = []
        self.docker_hosts: list[str | None] = []
        self.remote_timeouts: list[object] = []

    def __call__(
        self, args: list[str], **_kwargs: object
    ) -> subprocess.CompletedProcess[str]:
        env = _kwargs.get("env")
        docker_host = env.get("DOCKER_HOST") if isinstance(env, dict) else None
        self.docker_hosts.append(docker_host)
        if docker_host:
            self.remote_calls.append(list(args))
            self.remote_timeouts.append(_kwargs.get("timeout"))
            response = self.remote.get(_kind(args), (0, "", ""))
        else:
            self.calls.append(list(args))
            response = self.responses.get(_kind(args), (0, "", ""))
        if isinstance(response, BaseException):
            raise response
        returncode, stdout, stderr = response  # type: ignore[misc]
        check = bool(_kwargs.get("check"))
        if check and returncode != 0:
            raise subprocess.CalledProcessError(returncode, args, stdout, stderr)
        return subprocess.CompletedProcess(args, returncode, stdout, stderr)

    def calls_of(self, kind: str) -> list[list[str]]:
        return [c for c in self.calls if _kind(c) == kind]

    def remote_calls_of(self, kind: str) -> list[list[str]]:
        return [c for c in self.remote_calls if _kind(c) == kind]


REMOTE_ENV_VARS = (
    "PINPOINT_REMOTE_DOCKER_HOST",
    "PINPOINT_REMOTE_SUPABASE_HOST",
    "PINPOINT_SUPABASE_BACKEND",
)


@pytest.fixture(autouse=True)
def _no_remote_backend_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """The developer's shell may select the remote backend; tests opt in explicitly."""
    for name in REMOTE_ENV_VARS:
        monkeypatch.delenv(name, raising=False)


def install(monkeypatch: pytest.MonkeyPatch, stub: DockerStub) -> DockerStub:
    monkeypatch.setattr(sweep.subprocess, "run", stub)
    return stub


class TestVolumeEnumeration:
    """The enumeration itself has to work on both Docker and Podman."""

    def test_lists_volumes_via_label_filter_not_the_broken_template(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        stub = install(
            monkeypatch,
            DockerStub(
                volume_ls=(0, "supabase_db_pinpoint-alpha\n", ""),
                volume_inspect=(0, "supabase_db_pinpoint-alpha|pinpoint-alpha\n", ""),
            ),
        )

        assert sweep.get_supabase_volumes() == [
            ("supabase_db_pinpoint-alpha", "pinpoint-alpha")
        ]

        ls = stub.calls_of("volume_ls")[0]
        assert f"label={LABEL}" in ls
        # `.Label` on `docker volume ls` is the construct that broke (PP-5o7b).
        assert not any(".Label" in arg for arg in ls)

    def test_ignores_volumes_from_other_projects(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        install(
            monkeypatch,
            DockerStub(
                volume_ls=(0, "supabase_db_other\nsupabase_db_pinpoint-alpha\n", ""),
                volume_inspect=(
                    0,
                    "supabase_db_other|someone-elses-stack\n"
                    "supabase_db_pinpoint-alpha|pinpoint-alpha\n",
                    "",
                ),
            ),
        )

        assert sweep.get_supabase_volumes() == [
            ("supabase_db_pinpoint-alpha", "pinpoint-alpha")
        ]

    def test_no_labelled_volumes_skips_inspect(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        stub = install(monkeypatch, DockerStub(volume_ls=(0, "\n", "")))

        assert sweep.get_supabase_volumes() == []
        assert stub.calls_of("volume_inspect") == []

    def test_volume_removed_mid_sweep_does_not_blind_the_rest(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A racing removal on a busy host is not a reason to report UNKNOWN."""
        install(
            monkeypatch,
            DockerStub(
                volume_ls=(0, "supabase_db_pinpoint-alpha\nsupabase_db_gone\n", ""),
                volume_inspect=(
                    1,
                    "supabase_db_pinpoint-alpha|pinpoint-alpha\n",
                    "Error: no such volume supabase_db_gone",
                ),
            ),
        )

        assert sweep.get_supabase_volumes() == [
            ("supabase_db_pinpoint-alpha", "pinpoint-alpha")
        ]


class TestFailedQueryIsUnknownNotZero:
    """The core of PP-5o7b: unknown must never collapse into zero."""

    @pytest.mark.parametrize(
        ("failure", "expected_fragment"),
        [
            ((125, "", TEMPLATE_ERROR), "can't evaluate field Label"),
            ((1, "", "Cannot connect to the Docker daemon"), "Cannot connect"),
            ((1, "", ""), "exit status 1"),
        ],
    )
    def test_volume_ls_failure_reports_unknown(
        self,
        monkeypatch: pytest.MonkeyPatch,
        failure: tuple[int, str, str],
        expected_fragment: str,
    ) -> None:
        install(monkeypatch, DockerStub(volume_ls=failure))

        result = sweep.get_supabase_resources_by_project(not_quiet=False)

        assert result.is_unknown
        assert expected_fragment in (result.unknown_reason or "")
        assert result.by_project == {}

    def test_volume_inspect_template_failure_reports_unknown(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        install(
            monkeypatch,
            DockerStub(
                volume_ls=(0, "supabase_db_pinpoint-alpha\n", ""),
                volume_inspect=(125, "", "Error: template: unsupported"),
            ),
        )

        result = sweep.get_supabase_resources_by_project(not_quiet=False)

        assert result.is_unknown

    def test_container_query_failure_reports_unknown_even_if_volumes_listed(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Half an answer is still unknown — a partial count is a false count."""
        install(
            monkeypatch,
            DockerStub(
                volume_ls=(0, "supabase_db_pinpoint-alpha\n", ""),
                volume_inspect=(0, "supabase_db_pinpoint-alpha|pinpoint-alpha\n", ""),
                ps=(1, "", "Cannot connect to the Docker daemon"),
            ),
        )

        result = sweep.get_supabase_resources_by_project(not_quiet=False)

        assert result.is_unknown
        assert result.by_project == {}

    def test_docker_not_installed_is_a_real_zero_not_unknown(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """No docker binary means there genuinely are no Docker resources."""
        install(monkeypatch, DockerStub(volume_ls=FileNotFoundError(2, "No such file")))

        result = sweep.get_supabase_resources_by_project(not_quiet=False)

        assert not result.is_unknown
        assert result.by_project == {}

    def test_healthy_query_groups_by_project(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        install(
            monkeypatch,
            DockerStub(
                volume_ls=(
                    0,
                    "supabase_db_pinpoint-alpha\nsupabase_db_pinpoint-beta\n",
                    "",
                ),
                volume_inspect=(
                    0,
                    "supabase_db_pinpoint-alpha|pinpoint-alpha\n"
                    "supabase_db_pinpoint-beta|pinpoint-beta\n",
                    "",
                ),
                ps=(0, "supabase_db_pinpoint-alpha|pinpoint-alpha\n", ""),
            ),
        )

        result = sweep.get_supabase_resources_by_project(not_quiet=False)

        assert not result.is_unknown
        assert result.by_project == {
            "pinpoint-alpha": {
                "volumes": ["supabase_db_pinpoint-alpha"],
                "containers": ["supabase_db_pinpoint-alpha"],
            },
            "pinpoint-beta": {
                "volumes": ["supabase_db_pinpoint-beta"],
                "containers": [],
            },
        }


@pytest.fixture
def isolated_main(monkeypatch: pytest.MonkeyPatch):
    """Run main() without touching the real git worktrees or slot manifest."""

    def _setup(*, active: set[str], orphan_slots: list[str]) -> list[str]:
        deallocated: list[str] = []
        monkeypatch.setattr(sweep, "get_active_worktree_branches", lambda _repo: {})
        monkeypatch.setattr(sweep, "get_active_project_ids", lambda _wt: active)
        monkeypatch.setattr(sweep, "get_orphan_slot_paths", lambda: orphan_slots)
        monkeypatch.setattr(sweep, "_is_main_worktree_path", lambda _p: False)
        monkeypatch.setattr(sweep, "deallocate_slot", deallocated.append)
        return deallocated

    return _setup


def _run_main(monkeypatch: pytest.MonkeyPatch, *argv: str) -> int:
    monkeypatch.setattr(sys, "argv", ["worktree_orphan_sweep.py", *argv])
    return sweep.main()


class TestMainReportsUnknownLoudly:
    def test_dry_run_never_prints_a_false_zero(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        isolated_main,
    ) -> None:
        isolated_main(active=set(), orphan_slots=[])
        install(monkeypatch, DockerStub(volume_ls=(125, "", TEMPLATE_ERROR)))

        exit_code = _run_main(monkeypatch)

        err = capsys.readouterr().err
        assert exit_code == sweep.EXIT_DOCKER_UNKNOWN
        assert "UNKNOWN" in err
        assert "0 volume(s)" not in err
        assert "No orphans found." not in err

    def test_quiet_nudge_says_unknown_not_zero(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        isolated_main,
    ) -> None:
        """The SessionStart hook runs --quiet; its one-liner must not under-report."""
        isolated_main(active=set(), orphan_slots=["/gone/worktree"])
        install(monkeypatch, DockerStub(volume_ls=(125, "", TEMPLATE_ERROR)))

        exit_code = _run_main(monkeypatch, "--quiet")

        err = capsys.readouterr().err
        assert exit_code == sweep.EXIT_DOCKER_UNKNOWN
        assert "UNKNOWN" in err
        assert "0 Supabase Docker project orphan(s)" not in err

    def test_apply_does_not_touch_docker_when_state_is_unknown(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        isolated_main,
    ) -> None:
        deallocated = isolated_main(active=set(), orphan_slots=["/gone/worktree"])
        stub = install(monkeypatch, DockerStub(volume_ls=(125, "", TEMPLATE_ERROR)))

        exit_code = _run_main(monkeypatch, "--apply")

        err = capsys.readouterr().err
        assert exit_code == sweep.EXIT_DOCKER_UNKNOWN
        assert stub.calls_of("container_rm") == []
        assert stub.calls_of("volume_rm") == []
        assert "SKIPPED" in err
        # Slot reclamation is independent of Docker and still runs.
        assert deallocated == ["/gone/worktree"]


class TestMainOrphanClassification:
    def test_volumes_of_an_active_worktree_are_never_orphans(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        isolated_main,
    ) -> None:
        """A live worktree whose Supabase is merely stopped keeps its volume.

        "No container" must not imply orphaned — that heuristic (and
        `docker volume prune`) destroys a live worktree's local database.
        """
        isolated_main(active={"pinpoint-alpha"}, orphan_slots=[])
        stub = install(
            monkeypatch,
            DockerStub(
                volume_ls=(0, "supabase_db_pinpoint-alpha\n", ""),
                volume_inspect=(0, "supabase_db_pinpoint-alpha|pinpoint-alpha\n", ""),
                ps=(0, "", ""),
            ),
        )

        exit_code = _run_main(monkeypatch, "--apply")

        assert exit_code == 0
        assert stub.calls_of("volume_rm") == []
        assert "No orphans found." in capsys.readouterr().err

    def test_apply_removes_volumes_of_a_project_with_no_worktree(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        isolated_main,
    ) -> None:
        isolated_main(active={"pinpoint-alpha"}, orphan_slots=[])
        stub = install(
            monkeypatch,
            DockerStub(
                volume_ls=(0, "supabase_db_pinpoint-dead\n", ""),
                volume_inspect=(0, "supabase_db_pinpoint-dead|pinpoint-dead\n", ""),
                ps=(0, "supabase_db_pinpoint-dead|pinpoint-dead\n", ""),
            ),
        )

        exit_code = _run_main(monkeypatch, "--apply")

        err = capsys.readouterr().err
        assert exit_code == 0
        assert stub.calls_of("volume_rm") == [
            ["docker", "volume", "rm", "supabase_db_pinpoint-dead"]
        ]
        assert stub.calls_of("container_rm") == [
            ["docker", "rm", "-f", "supabase_db_pinpoint-dead"]
        ]
        assert "1 volume(s)" in err

    def test_dry_run_reports_volume_count_without_removing(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        isolated_main,
    ) -> None:
        isolated_main(active=set(), orphan_slots=[])
        stub = install(
            monkeypatch,
            DockerStub(
                volume_ls=(0, "supabase_db_pinpoint-dead\n", ""),
                volume_inspect=(0, "supabase_db_pinpoint-dead|pinpoint-dead\n", ""),
                ps=(0, "", ""),
            ),
        )

        exit_code = _run_main(monkeypatch)

        err = capsys.readouterr().err
        assert exit_code == 0
        assert "pinpoint-dead: 0 container(s), 1 volume(s)" in err
        assert stub.calls_of("volume_rm") == []


# --- Remote backend --------------------------------------------------------
#
# The gap these lock down: a remote worktree deleted with `rm -rf` left its
# stack running on the remote daemon, the sweep only looked at the local
# daemon, and `--apply` freed the slot. The next worktree given that slot then
# failed `supabase start` with "port is already allocated", and the remote
# volumes leaked forever.

REMOTE_HOST = "ssh://bazzite"
WORKDIR_LABEL = "com.supabase.cli.workdir"


def _remote_daemon(
    containers: list[tuple[str, str, str]],
    volumes: list[tuple[str, str, str]] | None = None,
) -> dict[str, object]:
    """Remote responses for `(name, project, workdir)` rows.

    Volumes default to one db volume per project with an EMPTY workdir, which
    is what the real Supabase CLI writes: only containers carry the workdir.
    """
    if volumes is None:
        projects = sorted({project for _name, project, _wd in containers})
        volumes = [(f"supabase_db_{p}", p, "") for p in projects]
    return {
        "volume_ls": (0, "".join(f"{n}\n" for n, _p, _w in volumes), ""),
        "volume_inspect": (
            0,
            "".join(f"{n}|{p}|{w}\n" for n, p, w in volumes),
            "",
        ),
        "ps": (0, "".join(f"{n}|{p}|{w}\n" for n, p, w in containers), ""),
    }


@pytest.fixture
def remote_home(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    """Make tmp_path this machine's home, so its paths count as local workdirs."""
    monkeypatch.setenv("HOME", str(tmp_path))
    return tmp_path


def _gone(home: Path, name: str) -> str:
    return str(home / "Code/PinPoint/.claude/worktrees" / name)


class TestRemoteOrphans:
    def test_apply_removes_remote_orphan_with_docker_host_and_frees_its_slot(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        isolated_main,
        remote_home: Path,
    ) -> None:
        gone = _gone(remote_home, "dead")
        deallocated = isolated_main(active=set(), orphan_slots=[gone])
        monkeypatch.setenv("PINPOINT_REMOTE_DOCKER_HOST", REMOTE_HOST)
        stub = install(
            monkeypatch,
            DockerStub(
                remote=_remote_daemon(
                    [
                        ("supabase_db_pinpoint-dead", "pinpoint-dead", gone),
                        ("supabase_kong_pinpoint-dead", "pinpoint-dead", gone),
                    ]
                )
            ),
        )

        exit_code = _run_main(monkeypatch, "--apply")

        err = capsys.readouterr().err
        assert exit_code == 0
        assert stub.remote_calls_of("container_rm") == [
            [
                "docker",
                "rm",
                "-f",
                "supabase_db_pinpoint-dead",
                "supabase_kong_pinpoint-dead",
            ]
        ]
        assert stub.remote_calls_of("volume_rm") == [
            ["docker", "volume", "rm", "supabase_db_pinpoint-dead"]
        ]
        # Every remote call went to the remote daemon, never the local one.
        assert stub.calls_of("container_rm") == []
        assert stub.calls_of("volume_rm") == []
        assert REMOTE_HOST in stub.docker_hosts
        # The stack holding the slot's ports is gone, so the slot is released.
        assert deallocated == [gone]
        assert f"on {REMOTE_HOST}" in err

    def test_dry_run_reports_remote_orphan_without_removing(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        isolated_main,
        remote_home: Path,
    ) -> None:
        gone = _gone(remote_home, "dead")
        deallocated = isolated_main(active=set(), orphan_slots=[])
        monkeypatch.setenv("PINPOINT_REMOTE_DOCKER_HOST", REMOTE_HOST)
        stub = install(
            monkeypatch,
            DockerStub(
                remote=_remote_daemon(
                    [("supabase_db_pinpoint-dead", "pinpoint-dead", gone)]
                )
            ),
        )

        exit_code = _run_main(monkeypatch)

        err = capsys.readouterr().err
        assert exit_code == 0
        assert "pinpoint-dead: 1 container(s), 1 volume(s)" in err
        assert stub.remote_calls_of("container_rm") == []
        assert stub.remote_calls_of("volume_rm") == []
        assert deallocated == []

    def test_quiet_nudge_counts_remote_orphans(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        isolated_main,
        remote_home: Path,
    ) -> None:
        gone = _gone(remote_home, "dead")
        isolated_main(active=set(), orphan_slots=[])
        monkeypatch.setenv("PINPOINT_REMOTE_DOCKER_HOST", REMOTE_HOST)
        install(
            monkeypatch,
            DockerStub(
                remote=_remote_daemon(
                    [("supabase_db_pinpoint-dead", "pinpoint-dead", gone)]
                )
            ),
        )

        _run_main(monkeypatch, "--quiet")

        assert "1 remote Supabase project orphan(s)" in capsys.readouterr().err

    def test_crabbox_and_remote_host_paths_are_never_touched(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        isolated_main,
        remote_home: Path,
    ) -> None:
        """The remote host's own stacks: not orphans, not reported, not removed."""
        isolated_main(active=set(), orphan_slots=[])
        monkeypatch.setenv("PINPOINT_REMOTE_DOCKER_HOST", REMOTE_HOST)
        # Crabbox runner under this machine's home too, to prove the project
        # prefix alone excludes it.
        stub = install(
            monkeypatch,
            DockerStub(
                remote=_remote_daemon(
                    [
                        (
                            "supabase_db_pinpoint-runner-crabbox",
                            "pinpoint-runner-crabbox",
                            "/var/home/froeht/Code/PinPoint/.claude/worktrees/crabbox-runner",
                        ),
                        (
                            "supabase_db_pinpoint-runner-crabbox-2",
                            "pinpoint-runner-crabbox-2",
                            _gone(remote_home, "crabbox-runner-2"),
                        ),
                        (
                            "supabase_db_pinpoint-bazzite-checkout",
                            "pinpoint-bazzite-checkout",
                            "/var/home/froeht/Code/PinPoint",
                        ),
                    ]
                )
            ),
        )

        exit_code = _run_main(monkeypatch, "--apply")

        err = capsys.readouterr().err
        assert exit_code == 0
        assert stub.remote_calls_of("container_rm") == []
        assert stub.remote_calls_of("volume_rm") == []
        assert "crabbox" not in err
        assert "bazzite-checkout" not in err
        assert "No orphans found." in err

    def test_remote_project_of_a_live_worktree_is_not_an_orphan(
        self,
        monkeypatch: pytest.MonkeyPatch,
        isolated_main,
        remote_home: Path,
    ) -> None:
        """A moved worktree's labels point at the old path; its project is still active."""
        isolated_main(active={"pinpoint-moved"}, orphan_slots=[])
        monkeypatch.setenv("PINPOINT_REMOTE_DOCKER_HOST", REMOTE_HOST)
        stub = install(
            monkeypatch,
            DockerStub(
                remote=_remote_daemon(
                    [
                        (
                            "supabase_db_pinpoint-moved",
                            "pinpoint-moved",
                            _gone(remote_home, "old-path"),
                        )
                    ]
                )
            ),
        )

        assert _run_main(monkeypatch, "--apply") == 0
        assert stub.remote_calls_of("volume_rm") == []

    def test_volume_only_remote_project_is_reported_but_never_removed(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        isolated_main,
        remote_home: Path,
    ) -> None:
        """Volumes carry no workdir label, so a stopped stack can't be attributed."""
        gone = _gone(remote_home, "stopped")
        deallocated = isolated_main(active=set(), orphan_slots=[gone])
        monkeypatch.setenv("PINPOINT_REMOTE_DOCKER_HOST", REMOTE_HOST)
        stub = install(
            monkeypatch,
            DockerStub(
                remote=_remote_daemon(
                    [],
                    volumes=[("supabase_db_pinpoint-stopped", "pinpoint-stopped", "")],
                )
            ),
        )

        exit_code = _run_main(monkeypatch, "--apply")

        err = capsys.readouterr().err
        assert exit_code == 0
        assert stub.remote_calls_of("volume_rm") == []
        assert "pinpoint-stopped: 1 volume(s)" in err
        # No container, so nothing holds the slot's ports: it is freed.
        assert deallocated == [gone]


class TestRemoteSlotSafety:
    def test_slot_kept_when_remote_project_still_references_it(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        isolated_main,
        remote_home: Path,
    ) -> None:
        """Workdir *inside* the worktree still counts (older pilot stacks did this)."""
        gone = _gone(remote_home, "dead")
        deallocated = isolated_main(active=set(), orphan_slots=[gone])
        monkeypatch.setenv("PINPOINT_REMOTE_DOCKER_HOST", REMOTE_HOST)
        install(
            monkeypatch,
            DockerStub(
                remote=_remote_daemon(
                    [
                        (
                            "supabase_db_pinpoint-dead",
                            "pinpoint-dead",
                            gone + "/.agent/tmp/runtime",
                        )
                    ]
                )
            ),
        )

        exit_code = _run_main(monkeypatch)

        err = capsys.readouterr().err
        assert exit_code == 0
        assert deallocated == []
        assert f"keeping slot for {gone}: remote project(s) pinpoint-dead" in err

    def test_slot_kept_when_remote_removal_fails(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        isolated_main,
        remote_home: Path,
    ) -> None:
        gone = _gone(remote_home, "dead")
        deallocated = isolated_main(active=set(), orphan_slots=[gone])
        monkeypatch.setenv("PINPOINT_REMOTE_DOCKER_HOST", REMOTE_HOST)
        daemon = _remote_daemon([("supabase_db_pinpoint-dead", "pinpoint-dead", gone)])
        daemon["container_rm"] = (1, "", "permission denied")
        install(monkeypatch, DockerStub(remote=daemon))

        _run_main(monkeypatch, "--apply")

        err = capsys.readouterr().err
        assert deallocated == []
        assert f"kept slot for {gone}" in err

    def test_unrelated_orphan_slot_is_still_freed(
        self,
        monkeypatch: pytest.MonkeyPatch,
        isolated_main,
        remote_home: Path,
    ) -> None:
        """A healthy remote query that finds nothing for a path proves it's free."""
        gone = _gone(remote_home, "was-local")
        deallocated = isolated_main(active=set(), orphan_slots=[gone])
        monkeypatch.setenv("PINPOINT_REMOTE_DOCKER_HOST", REMOTE_HOST)
        install(monkeypatch, DockerStub(remote=_remote_daemon([])))

        assert _run_main(monkeypatch, "--apply") == 0
        assert deallocated == [gone]

    @pytest.mark.parametrize(
        "failure",
        [
            (255, "", "ssh: connect to host bazzite port 22: Operation timed out"),
            subprocess.TimeoutExpired(["docker"], 60),
        ],
    )
    def test_unreachable_remote_is_unknown_and_keeps_slots(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        isolated_main,
        remote_home: Path,
        failure: object,
    ) -> None:
        gone = _gone(remote_home, "dead")
        deallocated = isolated_main(active=set(), orphan_slots=[gone])
        monkeypatch.setenv("PINPOINT_REMOTE_DOCKER_HOST", REMOTE_HOST)
        stub = install(monkeypatch, DockerStub(remote={"volume_ls": failure}))

        exit_code = _run_main(monkeypatch, "--apply")

        err = capsys.readouterr().err
        assert exit_code == sweep.EXIT_DOCKER_UNKNOWN
        assert "UNKNOWN" in err
        assert deallocated == []
        assert stub.remote_calls_of("container_rm") == []
        assert stub.remote_calls_of("volume_rm") == []

    def test_quiet_remote_query_fits_the_session_start_budget(
        self,
        monkeypatch: pytest.MonkeyPatch,
        isolated_main,
        remote_home: Path,
    ) -> None:
        """The hook kills the sweep at 10 s; the remote half must give up first."""
        isolated_main(active=set(), orphan_slots=[])
        monkeypatch.setenv("PINPOINT_REMOTE_DOCKER_HOST", REMOTE_HOST)
        stub = install(
            monkeypatch,
            DockerStub(
                remote=_remote_daemon(
                    [
                        (
                            "supabase_db_pinpoint-x",
                            "pinpoint-x",
                            _gone(remote_home, "x"),
                        )
                    ]
                )
            ),
        )

        _run_main(monkeypatch, "--quiet")

        assert stub.remote_timeouts
        assert all(
            isinstance(t, float) and t <= sweep.QUIET_REMOTE_QUERY_BUDGET_SECONDS
            for t in stub.remote_timeouts
        )

    def test_remote_worktree_present_but_docker_host_unset_is_unknown(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        isolated_main,
        tmp_path: Path,
    ) -> None:
        """A live remote worktree proves the backend is in use even without env."""
        live = tmp_path / "live"
        live.mkdir()
        (live / ".env.local").write_text("PINPOINT_SUPABASE_BACKEND=remote\n")
        deallocated = isolated_main(active=set(), orphan_slots=["/gone/worktree"])
        monkeypatch.setattr(
            sweep, "get_active_worktree_branches", lambda _repo: {str(live): "x"}
        )
        install(monkeypatch, DockerStub())

        exit_code = _run_main(monkeypatch, "--apply", "--quiet")

        err = capsys.readouterr().err
        assert exit_code == sweep.EXIT_DOCKER_UNKNOWN
        assert "PINPOINT_REMOTE_DOCKER_HOST is unset" in err
        assert deallocated == []

    def test_quiet_dry_run_names_remote_unknown(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        isolated_main,
    ) -> None:
        isolated_main(active=set(), orphan_slots=["/gone/worktree"])
        monkeypatch.setenv("PINPOINT_SUPABASE_BACKEND", "remote")
        install(monkeypatch, DockerStub())

        exit_code = _run_main(monkeypatch, "--quiet")

        err = capsys.readouterr().err
        assert exit_code == sweep.EXIT_DOCKER_UNKNOWN
        assert "remote Supabase project orphans UNKNOWN" in err


class TestNoRemoteBackendIsUnchanged:
    def test_env_unset_never_queries_a_remote_and_frees_slots(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        isolated_main,
    ) -> None:
        deallocated = isolated_main(active=set(), orphan_slots=["/gone/worktree"])
        stub = install(monkeypatch, DockerStub())

        exit_code = _run_main(monkeypatch, "--apply")

        err = capsys.readouterr().err
        assert exit_code == 0
        assert stub.remote_calls == []
        assert set(stub.docker_hosts) == {None}
        assert deallocated == ["/gone/worktree"]
        assert "remote" not in err.lower()

    def test_quiet_nudge_text_is_unchanged(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        isolated_main,
    ) -> None:
        isolated_main(active=set(), orphan_slots=["/gone/worktree"])
        install(monkeypatch, DockerStub())

        _run_main(monkeypatch, "--quiet")

        assert capsys.readouterr().err == (
            "worktree-orphan-sweep: found 1 slot orphan(s), "
            "0 Supabase Docker project orphan(s) (dry-run). "
            "Run: python3 scripts/worktree_orphan_sweep.py --apply\n"
        )

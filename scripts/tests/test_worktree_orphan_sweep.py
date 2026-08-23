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
    """Stands in for subprocess.run, answering docker calls from a script."""

    def __init__(self, **responses: object) -> None:
        # Each response is either a CompletedProcess-ish tuple
        # (returncode, stdout, stderr) or an exception instance to raise.
        self.responses = responses
        self.calls: list[list[str]] = []

    def __call__(
        self, args: list[str], **_kwargs: object
    ) -> subprocess.CompletedProcess[str]:
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

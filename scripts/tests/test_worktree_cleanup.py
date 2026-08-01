"""Regression tests for worktree_cleanup.py's two silent-failure bugs.

**PP-omz3 — a missing target used to be a silent success.** Handed a path that
isn't on disk, the script warned and returned, i.e. exit 0. Nothing ran: no
`supabase stop`, no volume removal, no slot deallocation. The WorktreeRemove
hook read that 0 as "cleaned", so a wrong or mangled path leaked the slot entry
and the Docker volumes while reporting success. Exit 0 now requires evidence:
the path absent from BOTH `git worktree list` and the slot manifest.

**PP-3w4g — a failed `docker volume ls` used to mean zero volumes.** The
non-zero exit was warned about and then collapsed into `volumes = []`,
indistinguishable from "this project has no volumes". Teardown continued,
removed the worktree, deallocated the slot, and exited 0 while the volumes
stayed on disk. Same false-zero class as PP-5o7b / PR #1746 in
`worktree_orphan_sweep.py`, whose UNKNOWN-not-zero shape this follows.

Everything is mocked at the subprocess boundary: these tests never touch the
real Docker daemon, Supabase, git worktrees, or the slot manifest.
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

import worktree_cleanup as cleanup  # noqa: E402

LABEL = "com.supabase.cli.project"
BRANCH = "agent-alpha"
PROJECT_ID = "pinpoint-agent-alpha"


def _kind(args: list[str]) -> str:
    """Classify an argv so the stub can answer per-command."""
    head = tuple(args[:3])
    if head[:3] == ("docker", "volume", "ls"):
        return "volume_ls"
    if head[:3] == ("docker", "volume", "rm"):
        return "volume_rm"
    if args[:1] == ["supabase"]:
        return "supabase"
    if args[:1] == ["git"]:
        # Skip over a leading `-C <dir>`.
        rest = args[3:] if args[1:2] == ["-C"] else args[1:]
        if rest[:1] == ["rev-parse"]:
            return "rev_parse"
        if rest[:2] == ["worktree", "list"]:
            return "worktree_list"
        if rest[:2] == ["worktree", "unlock"]:
            return "worktree_unlock"
        if rest[:2] == ["worktree", "remove"]:
            return "worktree_remove"
        if rest[:2] == ["worktree", "prune"]:
            return "worktree_prune"
    return "other"


class RunStub:
    """Stands in for subprocess.run, answering each command from a script."""

    def __init__(self, **responses: object) -> None:
        # Each response is either a (returncode, stdout, stderr) tuple or an
        # exception instance to raise.
        self.responses = responses
        self.calls: list[list[str]] = []

    def __call__(
        self, args: list[str], **kwargs: object
    ) -> subprocess.CompletedProcess[str]:
        self.calls.append(list(args))
        response = self.responses.get(_kind(args), (0, "", ""))
        if isinstance(response, BaseException):
            raise response
        returncode, stdout, stderr = response  # type: ignore[misc]
        if kwargs.get("check") and returncode != 0:
            raise subprocess.CalledProcessError(returncode, args, stdout, stderr)
        return subprocess.CompletedProcess(args, returncode, stdout, stderr)

    def calls_of(self, kind: str) -> list[list[str]]:
        return [call for call in self.calls if _kind(call) == kind]


def install(monkeypatch: pytest.MonkeyPatch, stub: RunStub) -> RunStub:
    monkeypatch.setattr(cleanup.subprocess, "run", stub)
    return stub


# --------------------------------------------------------------------------- #
# PP-3w4g: the volume query itself
# --------------------------------------------------------------------------- #


class TestVolumeQueryInvariant:
    def test_unknown_cannot_also_carry_volumes(self) -> None:
        """Structural, not conventional: an unknown result has no volumes to act on."""
        with pytest.raises(ValueError):
            cleanup.VolumeQuery(
                volumes=("supabase_db_x",), unknown_reason="daemon down"
            )

    def test_empty_default_is_known(self) -> None:
        assert not cleanup.VolumeQuery().is_unknown


class TestListProjectVolumes:
    def test_uses_the_portable_label_filter_and_returns_names(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        stub = install(
            monkeypatch,
            RunStub(volume_ls=(0, f"supabase_db_{PROJECT_ID}\nsupabase_storage\n", "")),
        )

        query = cleanup.list_project_volumes(PROJECT_ID)

        assert not query.is_unknown
        assert query.volumes == (f"supabase_db_{PROJECT_ID}", "supabase_storage")
        ls = stub.calls_of("volume_ls")[0]
        assert f"label={LABEL}={PROJECT_ID}" in ls
        assert "-q" in ls
        # The `{{.Label …}}` template is the Podman-incompatible form PP-5o7b hit;
        # this script never used it and must not acquire it.
        assert not any(".Label" in arg for arg in ls)

    def test_genuinely_empty_is_known_zero(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        install(monkeypatch, RunStub(volume_ls=(0, "\n", "")))

        query = cleanup.list_project_volumes(PROJECT_ID)

        assert not query.is_unknown
        assert query.volumes == ()

    @pytest.mark.parametrize(
        ("failure", "expected_fragment"),
        [
            ((1, "", "Cannot connect to the Docker daemon"), "Cannot connect"),
            ((125, "", "Error: unrecognized filter"), "unrecognized filter"),
            ((1, "", ""), "exit status 1"),
        ],
    )
    def test_failed_query_is_unknown_not_empty(
        self,
        monkeypatch: pytest.MonkeyPatch,
        failure: tuple[int, str, str],
        expected_fragment: str,
    ) -> None:
        install(monkeypatch, RunStub(volume_ls=failure))

        query = cleanup.list_project_volumes(PROJECT_ID)

        assert query.is_unknown
        assert query.volumes == ()
        assert expected_fragment in (query.unknown_reason or "")

    def test_unrunnable_docker_is_unknown(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        install(monkeypatch, RunStub(volume_ls=OSError("Permission denied")))

        query = cleanup.list_project_volumes(PROJECT_ID)

        assert query.is_unknown
        assert "Permission denied" in (query.unknown_reason or "")

    def test_docker_not_installed_is_a_real_zero(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """No docker binary means there genuinely are no volumes on this host."""
        install(
            monkeypatch, RunStub(volume_ls=FileNotFoundError(2, "No such file: docker"))
        )

        query = cleanup.list_project_volumes(PROJECT_ID)

        assert not query.is_unknown
        assert query.volumes == ()


# --------------------------------------------------------------------------- #
# PP-omz3: the residue check for a path that isn't there
# --------------------------------------------------------------------------- #


@pytest.fixture
def manifest(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    """Point MANIFEST_PATH at a temp file; returns a writer for its slot paths."""
    path = tmp_path / "worktree-slots.json"
    monkeypatch.setattr(cleanup, "MANIFEST_PATH", path)

    def _write(*worktree_paths: str, raw: str | None = None) -> Path:
        if raw is not None:
            path.write_text(raw)
        else:
            slots = {p: i for i, p in enumerate(worktree_paths, start=1)}
            path.write_text(json.dumps({"version": 1, "slots": slots}))
        return path

    return _write


def _run_main(monkeypatch: pytest.MonkeyPatch, target: Path | str) -> int:
    monkeypatch.setattr(sys, "argv", ["worktree_cleanup.py", str(target)])
    return cleanup.main()


class TestMissingTarget:
    def test_absent_from_both_sources_is_an_idempotent_success(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        tmp_path: Path,
        manifest,
    ) -> None:
        """Re-invoking cleanup on an already-cleaned worktree is legitimately fine."""
        manifest()
        install(monkeypatch, RunStub(worktree_list=(0, "worktree /repo\n", "")))

        exit_code = _run_main(monkeypatch, tmp_path / "gone")

        err = capsys.readouterr().err
        assert exit_code == cleanup.EXIT_OK
        assert "already cleaned up" in err

    def test_lingering_slot_entry_is_not_success(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        tmp_path: Path,
        manifest,
    ) -> None:
        gone = (tmp_path / "gone").resolve()
        manifest(str(gone))
        stub = install(monkeypatch, RunStub(worktree_list=(0, "worktree /repo\n", "")))

        exit_code = _run_main(monkeypatch, gone)

        err = capsys.readouterr().err
        assert exit_code == cleanup.EXIT_STALE_TARGET
        assert "slot manifest" in err
        assert "worktree_orphan_sweep.py --apply" in err
        # Nothing was reclaimed, and nothing was claimed to be.
        assert stub.calls_of("volume_ls") == []
        assert stub.calls_of("worktree_remove") == []
        assert "Cleaned up worktree" not in err

    def test_lingering_git_registration_is_not_success(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        tmp_path: Path,
        manifest,
    ) -> None:
        """`rm -rf` leaves a prunable registration behind — that is residue."""
        gone = (tmp_path / "gone").resolve()
        manifest()
        install(
            monkeypatch,
            RunStub(
                worktree_list=(0, f"worktree /repo\nworktree {gone}\nprunable\n", "")
            ),
        )

        exit_code = _run_main(monkeypatch, gone)

        err = capsys.readouterr().err
        assert exit_code == cleanup.EXIT_STALE_TARGET
        assert "registered as a worktree" in err

    def test_unreadable_manifest_is_unknown_not_clean(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        tmp_path: Path,
        manifest,
    ) -> None:
        manifest(raw="{not json")
        install(monkeypatch, RunStub(worktree_list=(0, "worktree /repo\n", "")))

        exit_code = _run_main(monkeypatch, tmp_path / "gone")

        assert exit_code == cleanup.EXIT_STALE_TARGET
        assert "could not be read" in capsys.readouterr().err

    def test_failed_git_worktree_list_is_unknown_not_clean(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        tmp_path: Path,
        manifest,
    ) -> None:
        manifest()
        install(monkeypatch, RunStub(worktree_list=(128, "", "fatal: not a git repo")))

        exit_code = _run_main(monkeypatch, tmp_path / "gone")

        assert exit_code == cleanup.EXIT_STALE_TARGET
        assert "`git worktree list` could not be read" in capsys.readouterr().err


# --------------------------------------------------------------------------- #
# main() end to end, with a real (fake) additional worktree on disk
# --------------------------------------------------------------------------- #


@pytest.fixture
def fake_worktree(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    """A directory shaped like an additional worktree: `.git` is a FILE.

    (A main worktree has `.git` as a directory; the script refuses those.)
    Pair with the `deallocated` fixture so the real slot manifest is untouched.
    """
    worktree = tmp_path / "agent-alpha"
    worktree.mkdir()
    (worktree / ".git").write_text("gitdir: /repo/.git/worktrees/agent-alpha\n")
    return worktree.resolve()


@pytest.fixture
def deallocated(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    recorded: list[str] = []
    monkeypatch.setattr(cleanup, "deallocate_slot", recorded.append)
    return recorded


class TestMainTeardown:
    def test_healthy_teardown_removes_volumes_and_succeeds(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        fake_worktree: Path,
        deallocated: list[str],
    ) -> None:
        stub = install(
            monkeypatch,
            RunStub(
                rev_parse=(0, f"{BRANCH}\n", ""),
                volume_ls=(0, f"supabase_db_{PROJECT_ID}\n", ""),
            ),
        )

        exit_code = _run_main(monkeypatch, fake_worktree)

        err = capsys.readouterr().err
        assert exit_code == cleanup.EXIT_OK
        assert stub.calls_of("volume_rm") == [
            ["docker", "volume", "rm", f"supabase_db_{PROJECT_ID}"]
        ]
        assert "Removed 1 Docker volume(s)" in err
        assert f"Cleaned up worktree: {fake_worktree}" in err
        assert deallocated == [str(fake_worktree)]

    def test_no_volumes_is_a_clean_success(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        fake_worktree: Path,
        deallocated: list[str],
    ) -> None:
        stub = install(
            monkeypatch,
            RunStub(rev_parse=(0, f"{BRANCH}\n", ""), volume_ls=(0, "", "")),
        )

        exit_code = _run_main(monkeypatch, fake_worktree)

        err = capsys.readouterr().err
        assert exit_code == cleanup.EXIT_OK
        assert stub.calls_of("volume_rm") == []
        assert "UNKNOWN" not in err
        assert deallocated == [str(fake_worktree)]

    def test_failed_volume_ls_does_not_report_success(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        fake_worktree: Path,
        deallocated: list[str],
    ) -> None:
        """The PP-3w4g core: unknown volumes must not read as zero volumes."""
        stub = install(
            monkeypatch,
            RunStub(
                rev_parse=(0, f"{BRANCH}\n", ""),
                volume_ls=(1, "", "Cannot connect to the Docker daemon"),
            ),
        )

        exit_code = _run_main(monkeypatch, fake_worktree)

        err = capsys.readouterr().err
        assert exit_code == cleanup.EXIT_DOCKER_UNKNOWN
        assert "UNKNOWN, not zero" in err
        assert "Cannot connect to the Docker daemon" in err
        assert "Docker volume(s)" not in err  # no "Removed 0 Docker volume(s)"
        assert "Cleaned up worktree" not in err
        assert "worktree_orphan_sweep.py --apply" in err
        # No volume removal was attempted against a set we couldn't enumerate...
        assert stub.calls_of("volume_rm") == []
        # ...but the worktree and slot are still reclaimed, so the sweep can
        # find the leaked project by its Docker label (delayed, not permanent).
        assert stub.calls_of("worktree_remove") != []
        assert deallocated == [str(fake_worktree)]

    def test_docker_not_installed_still_reports_success(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        fake_worktree: Path,
        deallocated: list[str],
    ) -> None:
        install(
            monkeypatch,
            RunStub(
                rev_parse=(0, f"{BRANCH}\n", ""),
                volume_ls=FileNotFoundError(2, "No such file: docker"),
            ),
        )

        exit_code = _run_main(monkeypatch, fake_worktree)

        assert exit_code == cleanup.EXIT_OK
        assert "Cleaned up worktree" in capsys.readouterr().err

    def test_failed_worktree_removal_keeps_the_slot(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        fake_worktree: Path,
        deallocated: list[str],
    ) -> None:
        """Pre-existing contract: don't free ports a live directory still claims."""
        install(
            monkeypatch,
            RunStub(
                rev_parse=(0, f"{BRANCH}\n", ""),
                volume_ls=(0, "", ""),
                worktree_remove=(1, "", "fatal: validation failed"),
            ),
        )

        exit_code = _run_main(monkeypatch, fake_worktree)

        assert exit_code == cleanup.EXIT_FAILED
        assert deallocated == []
        assert "keeping slot manifest entry" in capsys.readouterr().err

    def test_main_worktree_is_refused(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        tmp_path: Path,
        deallocated: list[str],
    ) -> None:
        """`.git` as a DIRECTORY means main checkout — never touch it."""
        main_wt = tmp_path / "PinPoint"
        (main_wt / ".git").mkdir(parents=True)
        stub = install(monkeypatch, RunStub())

        exit_code = _run_main(monkeypatch, main_wt)

        assert exit_code == cleanup.EXIT_MAIN_WORKTREE
        assert "Refusing to clean up the main worktree" in capsys.readouterr().err
        assert stub.calls == []
        assert deallocated == []

    def test_missing_argument_is_a_usage_error(
        self, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
    ) -> None:
        monkeypatch.setattr(sys, "argv", ["worktree_cleanup.py"])

        assert cleanup.main() == cleanup.EXIT_FAILED
        assert "Usage:" in capsys.readouterr().err

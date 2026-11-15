"""Tests for claude-review-level.sh (spec pr-lifecycle-monitoring §8.14–8.15).

The script picks the /code-review level from the weighted diff size; the Claude
Review CI job reaches it through claude-review-range.sh's `--from` mode.
"""

import os
import subprocess
from pathlib import Path

import pytest

pytestmark = pytest.mark.integration

WORKFLOW = Path(__file__).parent.parent / "workflow"
LEVEL_SCRIPT = WORKFLOW / "claude-review-level.sh"


def git(*args: str, cwd: Path) -> str:
    return subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=True,
        capture_output=True,
        text=True,
        env={
            **os.environ,
            "GIT_AUTHOR_NAME": "t",
            "GIT_AUTHOR_EMAIL": "t@example.com",
            "GIT_COMMITTER_NAME": "t",
            "GIT_COMMITTER_EMAIL": "t@example.com",
        },
    ).stdout.strip()


def make_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    repo.mkdir()
    git("init", "-q", "-b", "main", cwd=repo)
    (repo / "README.md").write_text("base\n")
    git("add", "-A", cwd=repo)
    git("commit", "-qm", "base", cwd=repo)
    git("checkout", "-qb", "feat", cwd=repo)
    return repo


def commit_lines(repo: Path, files: dict[str, int], message: str = "change") -> str:
    for path, count in files.items():
        target = repo / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("".join(f"line {i}\n" for i in range(count)))
    git("add", "-A", cwd=repo)
    git("commit", "-qm", message, cwd=repo)
    return git("rev-parse", "HEAD", cwd=repo)


def level(repo: Path) -> list[str]:
    result = subprocess.run(
        ["bash", str(LEVEL_SCRIPT), "main"],
        cwd=repo,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    return result.stdout.splitlines()


@pytest.mark.parametrize(
    ("code_lines", "expected"),
    [
        (49, "low"),
        (50, "medium"),
        (1499, "medium"),
        (1500, "high"),
        (3000, "high"),
        (3001, "ask"),
    ],
)
def test_level_bands_are_exclusive(
    tmp_path: Path, code_lines: int, expected: str
) -> None:
    repo = make_repo(tmp_path)
    commit_lines(repo, {"src/app.ts": code_lines})
    assert level(repo)[0] == expected


def test_ask_names_the_levels_to_offer(tmp_path: Path) -> None:
    repo = make_repo(tmp_path)
    commit_lines(repo, {"src/app.ts": 3001})
    word, detail = level(repo)
    assert word == "ask"
    assert detail.endswith("; ask Tim: xhigh, max, or split the PR")


def test_tests_count_at_half_weight(tmp_path: Path) -> None:
    repo = make_repo(tmp_path)
    commit_lines(
        repo,
        {
            "src/app.ts": 20,
            "src/app.test.ts": 40,
            "e2e/smoke/page.spec.ts": 20,
            "scripts/tests/test_x.py": 20,
        },
    )
    word, detail = level(repo)
    assert word == "medium"
    assert detail.startswith("weighted 60 lines: code 20, tests 80 at half weight")


def test_generated_fixture_and_spec_files_are_left_out(tmp_path: Path) -> None:
    repo = make_repo(tmp_path)
    commit_lines(
        repo,
        {
            "pnpm-lock.yaml": 5000,
            "drizzle/meta/0099_snapshot.json": 3000,
            "src/lib/pinballmap/fixtures/region.json": 4000,
            "eslint-rules/__fixtures__/case.ts": 500,
            "docs/feature-specs/thing.md": 900,
            "src/app.ts": 10,
        },
    )
    word, detail = level(repo)
    assert word == "low"
    assert (
        detail == "weighted 10 lines: code 10, tests 0 at half weight, 13400 left out"
    )


def test_non_ascii_paths_still_match_the_exclusions(tmp_path: Path) -> None:
    repo = make_repo(tmp_path)
    commit_lines(repo, {"docs/feature-specs/caf\u00e9.md": 900, "src/app.ts": 10})
    assert level(repo)[0] == "low"


def test_binary_files_drop_out(tmp_path: Path) -> None:
    repo = make_repo(tmp_path)
    (repo / "logo.png").write_bytes(bytes(range(256)) * 50)
    git("add", "-A", cwd=repo)
    git("commit", "-qm", "binary", cwd=repo)
    assert level(repo)[0] == "low"

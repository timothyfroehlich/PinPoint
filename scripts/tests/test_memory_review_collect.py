"""Unit tests for the memory-review store collector.

The collector must run unchanged on macOS and on Fedora Atomic, and must survive
being piped to a remote interpreter over SSH - so these tests build synthetic
store trees under tmp_path and drive the script as a subprocess. Nothing here
touches a real ~/.claude.
"""

import ast
import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent.parent / "memory_review" / "collect_stores.py"


def _memory_file(
    store: Path, name: str, *, description: str, mtype: str, body: str = "body"
) -> None:
    store.mkdir(parents=True, exist_ok=True)
    (store / f"{name}.md").write_text(
        f'---\nname: {name}\ndescription: "{description}"\n'
        f"metadata:\n  type: {mtype}\n---\n\n{body}\n",
        encoding="utf-8",
    )


@pytest.fixture
def machine(tmp_path: Path) -> dict[str, Path]:
    """A synthetic machine: a home, a ~/.claude with three stores, and a repo."""
    home = tmp_path / "home" / "someone"
    claude = home / ".claude"
    repo = home / "Code" / "PinPoint"
    repo.mkdir(parents=True)

    projects = claude / "projects"
    home_slug = str(home).replace("/", "-")
    # Claude derives a store's directory name from the project's ABSOLUTE path,
    # so the in-scope slug has to be computed from the fixture's real repo path -
    # a hardcoded name would never match --repo and every test would see
    # "other-project".
    repo_slug = str(repo).replace("/", "-")

    project_store = projects / repo_slug / "memory"
    _memory_file(
        project_store,
        "keeper",
        description="a project fact",
        mtype="project",
        body="links to [[other]] and [[keeper]]",
    )
    (project_store / "MEMORY.md").write_text(
        "# Memory Index\n\n- [Keeper](keeper.md) - a project fact\n"
        "- [Ghost](ghost.md) - deleted\n",
        encoding="utf-8",
    )

    _memory_file(
        projects / home_slug / "memory",
        "machine_fact",
        description="a home-scope fact",
        mtype="reference",
    )

    _memory_file(
        projects / f"{repo_slug}--claude-worktrees-agent-abc" / "memory",
        "orphan",
        description="written in a worktree",
        mtype="project",
    )

    # A different repo's store. Must never be mistaken for in-scope: the review
    # would otherwise verify, dedupe and propose deleting another project's
    # memories.
    _memory_file(
        projects / "-home-someone-Code-SomeOtherRepo" / "memory",
        "foreign",
        description="belongs to a different project entirely",
        mtype="project",
    )

    (projects / "no-memory-dir").mkdir(parents=True)

    (repo / "CLAUDE.md").write_text("# project\nline two\n", encoding="utf-8")
    (repo / "AGENTS.md").write_text("stub\n", encoding="utf-8")
    claude.mkdir(parents=True, exist_ok=True)
    (claude / "CLAUDE.md").write_text("# global\n", encoding="utf-8")

    skill = repo / ".agents" / "skills" / "pinpoint-ui"
    skill.mkdir(parents=True)
    (skill / "SKILL.md").write_text("# ui\n", encoding="utf-8")
    (skill / "extra.md").write_text("# more\n", encoding="utf-8")

    return {"home": home, "claude": claude, "repo": repo}


def _run(machine: dict[str, Path]) -> dict:
    proc = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--repo",
            str(machine["repo"]),
            "--home",
            str(machine["home"]),
            "--claude-dir",
            str(machine["claude"]),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(proc.stdout)


def _store(doc: dict, scope: str) -> dict:
    matches = [s for s in doc["memory_stores"] if s["scope"] == scope]
    assert len(matches) == 1, f"expected exactly one {scope} store, got {len(matches)}"
    return matches[0]


def test_classifies_project_home_and_worktree_scopes(machine):
    doc = _run(machine)
    assert {s["scope"] for s in doc["memory_stores"]} == {
        "project",
        "home",
        "worktree",
        "other-project",
    }


def test_only_the_repo_passed_in_is_scoped_project(machine):
    """--repo has to actually scope the corpus. Without this, every unrelated
    repo's memory store under ~/.claude/projects is indistinguishable from the
    one under review, and a pass could propose deleting another project's
    memories."""
    doc = _run(machine)
    in_scope = [s for s in doc["memory_stores"] if s["scope"] == "project"]
    assert len(in_scope) == 1
    assert in_scope[0]["slug"] == str(machine["repo"]).replace("/", "-")

    foreign = [s for s in doc["memory_stores"] if s["scope"] == "other-project"]
    assert [s["slug"] for s in foreign] == ["-home-someone-Code-SomeOtherRepo"]


def test_a_worktree_path_still_scopes_to_the_main_checkout(machine):
    """The review is usually run from a worktree. Passing that path as --repo
    must still put the MAIN checkout's memories in scope - otherwise the corpus
    that matters is silently labelled other-project and dropped."""
    worktree = machine["repo"] / ".claude" / "worktrees" / "some-branch"
    worktree.mkdir(parents=True)
    proc = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--repo",
            str(worktree),
            "--home",
            str(machine["home"]),
            "--claude-dir",
            str(machine["claude"]),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    doc = json.loads(proc.stdout)
    in_scope = [s for s in doc["memory_stores"] if s["scope"] == "project"]
    assert [s["slug"] for s in in_scope] == [str(machine["repo"]).replace("/", "-")]


def test_worktree_scope_is_repo_relative(machine):
    """A worktree slug belonging to a different repo is that repo's problem, not
    ours - it must not land in this review's worktree bucket."""
    other_wt = (
        machine["claude"]
        / "projects"
        / "-home-someone-Code-SomeOtherRepo--claude-worktrees-agent-zzz"
        / "memory"
    )
    _memory_file(
        other_wt, "far", description="another repo's worktree", mtype="project"
    )
    doc = _run(machine)
    worktrees = [s for s in doc["memory_stores"] if s["scope"] == "worktree"]
    assert all(
        s["slug"].startswith(str(machine["repo"]).replace("/", "-")) for s in worktrees
    )
    assert len(worktrees) == 1


def test_skips_slug_dirs_without_a_memory_subdir(machine):
    doc = _run(machine)
    assert all("no-memory-dir" not in s["slug"] for s in doc["memory_stores"])


def test_parses_frontmatter_and_wiki_links(machine):
    entry = _store(_run(machine), "project")["entries"][0]
    assert entry["name"] == "keeper"
    assert entry["description"] == "a project fact"
    assert entry["type"] == "project"
    assert entry["links"] == ["keeper", "other"]


def test_excludes_the_index_from_entries(machine):
    store = _store(_run(machine), "project")
    assert [e["file"] for e in store["entries"]] == ["keeper.md"]
    assert store["entry_count"] == 1


def test_index_pointers_expose_drift_in_both_directions(machine):
    store = _store(_run(machine), "project")
    pointers = set(store["index"]["pointers"])
    files = {e["file"] for e in store["entries"]}
    assert pointers == {"keeper.md", "ghost.md"}
    assert pointers - files == {"ghost.md"}, (
        "an index line pointing at a deleted memory"
    )


def test_reports_absent_rules_dir_rather_than_assuming(machine):
    assert _run(machine)["rules"] == {"exists": False, "files": []}


def test_collects_context_files_and_skills(machine):
    doc = _run(machine)
    kinds = {c["kind"]: c for c in doc["context_files"]}
    assert kinds["project-claude-md"]["exists"] is True
    # "# project\nline two\n" is TWO lines. A trailing newline terminates the
    # last line, it does not start a new one - and AGENTS.md's <=10-line CI gate
    # is the stated consumer of this number, so an off-by-one reads a compliant
    # 10-line stub as a violation.
    assert kinds["project-claude-md"]["lines"] == 2
    assert kinds["global-claude-md"]["exists"] is True
    assert kinds["review-md"]["exists"] is False
    assert doc["skills"] == [
        {
            "name": "pinpoint-ui",
            "path": str(machine["repo"] / ".agents/skills/pinpoint-ui"),
            "file_count": 2,
            "bytes": doc["skills"][0]["bytes"],
        }
    ]


@pytest.mark.parametrize(
    ("content", "expected"),
    [
        ("", 0),
        ("one\n", 1),
        ("one", 1),
        ("one\ntwo\n", 2),
        ("one\ntwo", 2),
        ("one\n\nthree\n", 3),
    ],
)
def test_line_count_matches_wc_l_semantics(machine, content, expected):
    """Line counts feed a CI gate expressed in `wc -l` terms, so they have to
    agree with it rather than counting the terminating newline as a line."""
    (machine["repo"] / "CLAUDE.md").write_text(content, encoding="utf-8")
    kinds = {c["kind"]: c for c in _run(machine)["context_files"]}
    assert kinds["project-claude-md"]["lines"] == expected


def test_imports_only_dependency_free_stdlib():
    """Hard constraint: this file gets piped to a remote python3 with no PATH.

    Checked via the AST rather than a substring scan - the module docstring
    legitimately mentions subprocess while explaining why it uses none, and a
    naive `"subprocess" not in source` fails on that prose while still missing
    a real `from subprocess import run`.
    """
    tree = ast.parse(SCRIPT.read_text(encoding="utf-8"))
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            imported.add(node.module.split(".")[0])

    allowed = {"__future__", "argparse", "json", "re", "socket", "sys", "pathlib"}
    assert imported <= allowed, f"unexpected imports: {sorted(imported - allowed)}"
    assert "subprocess" not in imported

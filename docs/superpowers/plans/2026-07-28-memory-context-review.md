# Memory & Context Review Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a weekly human-in-the-loop pass that reviews every store of recorded context across Tim's Mac and Bazzite, proposes prunes/promotions/dedupes, and applies only what he approves.

**Architecture:** Two deterministic Python collectors (dependency-free so they can be piped to a remote `python3` over SSH), one Bash dispatcher that hands the remote half to Bazzite's own Claude, and a skill document carrying the judgment layer. The skill is invoked from the existing weekly `chores` pass — no new scheduler.

**Tech Stack:** Python 3 standard library only (no PyYAML, no `subprocess`), Bash + `ssh`/`scp`, pytest for coverage, `bd` for beads memories and the chores bead, `ruff` + `shellcheck` for lint.

**Spec:** `/Users/froeht/Code/PinPoint/.claude/worktrees/memory-context-review-PP-uoqg/docs/superpowers/specs/2026-07-28-memory-context-review-design.md` · **Bead:** PP-uoqg

## Global Constraints

- **Python scripts must use only the standard library and must never call `subprocess`.** Two reasons, both hard: the Claude Code sandbox blocks Python subprocess calls, and these scripts get piped to a remote interpreter (`ssh bazzite 'python3 - --repo …' < script.py`) where brew is absent from the non-interactive PATH.
- **No `stat(1)` shellouts.** Use `Path.stat().st_mtime`. BSD `stat -f %m` and GNU `stat -c %Y` differ, and this code runs on both macOS and Fedora Atomic.
- **`localhost`, never `127.0.0.1`** (CORE-SEC-008).
- **Path aliases `~/` for TypeScript imports** (CORE-TS-008) — not applicable here, no TS in this plan.
- **`ruff check && ruff format`** must be clean on every Python file; **`shellcheck`** clean on every shell file. Both run inside `pnpm run check`.
- **New pytest files go in `scripts/tests/`** and are picked up automatically by `check:pytest` (`pytest scripts/tests/`).
- **`.claude/rules/` does not exist yet** — it lands in PP-22e4 PR 8. Code must report its absence, never assume it.
- **`AGENTS.md` is being reduced to a ≤10-line stub with a CI gate** (PP-22e4 PR 10). It is collected for measurement only; it is never a promotion destination.
- **Bazzite paths:** home is `/var/home/froeht` (`/home/froeht` is a symlink; Claude's store slug resolves to `-var-home-froeht-…`). Repo is `/var/home/froeht/Code/PinPoint`. `claude` is at `$HOME/.local/bin/claude`.
- **Never `--no-verify`.** Never `pkill`/`killall` by name.
- **Commit messages end with:** `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

---

## File Structure

| File                                                          | Responsibility                                                                                                                    |
| :------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/memory_review/collect_stores.py`                     | **Create.** Enumerate one machine's memory stores + canonical context files → JSON on stdout. Deterministic, no judgment.         |
| `scripts/memory_review/snapshot_stores.py`                    | **Create.** Timestamped one-way copy of one machine's memory stores, with retention pruning. The undo the store otherwise lacks.  |
| `scripts/memory_review/apply_remote.sh`                       | **Create.** Ship an approved manifest to Bazzite, snapshot there, dispatch headless `claude -p`, retrieve the result document.    |
| `scripts/tests/test_memory_review_collect.py`                 | **Create.** pytest for the collector against synthetic store trees.                                                               |
| `scripts/tests/test_memory_review_snapshot.py`                | **Create.** pytest for the snapshotter, including retention pruning.                                                              |
| `scripts/tests/test_memory_review_apply_remote.py`            | **Create.** pytest for the dispatcher with `ssh`/`scp` stubbed on PATH.                                                           |
| `.agents/skills/pinpoint-memory-review/SKILL.md`              | **Create.** The runbook: phases, subagent batching, veto protocol.                                                                |
| `.agents/skills/pinpoint-memory-review/references/routing.md` | **Create.** Cost table, three-defect taxonomy, worked routing examples. Progressive disclosure — loaded only when routing a fact. |
| `.agents/skills/pinpoint-chores/SKILL.md`                     | **Modify.** Add the review as a checklist item.                                                                                   |
| `AGENTS.md` §3 skills table                                   | **Modify.** Register the new skill.                                                                                               |

Deliberately **not** creating: a scheduler, a daemon, a git-backed store, or any continuous sync. All rejected in the spec.

---

### Task 1: Store collector

The foundation — every later task consumes its output. Pure enumeration, zero judgment, so it is fully unit-testable.

**Files:**

- Create: `scripts/memory_review/collect_stores.py`
- Test: `scripts/tests/test_memory_review_collect.py`

**Interfaces:**

- Consumes: nothing.
- Produces: a JSON document on stdout with this exact shape. Later tasks and the skill depend on these key names.

```json
{
  "schema_version": 1,
  "machine": "<hostname>",
  "home": "/Users/froeht",
  "repo": "/Users/froeht/Code/PinPoint",
  "memory_stores": [
    {
      "slug": "-Users-froeht-Code-PinPoint",
      "scope": "project",
      "path": "/Users/froeht/.claude/projects/-Users-froeht-Code-PinPoint/memory",
      "index": {
        "exists": true,
        "lines": 24,
        "bytes": 4330,
        "pointers": ["feedback_x.md"]
      },
      "entry_count": 22,
      "entries": [
        {
          "file": "feedback_x.md",
          "name": "feedback_x",
          "description": "one-line summary",
          "type": "feedback",
          "bytes": 1482,
          "mtime": 1753000000,
          "lines": 18,
          "links": ["other_memory_name"]
        }
      ]
    }
  ],
  "context_files": [
    {
      "kind": "project-claude-md",
      "path": "…/CLAUDE.md",
      "exists": true,
      "lines": 42,
      "bytes": 1234
    }
  ],
  "rules": { "exists": false, "files": [] },
  "skills": [
    { "name": "pinpoint-ui", "path": "…", "file_count": 3, "bytes": 12345 }
  ]
}
```

`scope` is one of `project`, `home`, `worktree`. `pointers` are the `.md` targets of markdown links in `MEMORY.md`, so the review can detect index/file drift in both directions.

- [ ] **Step 1: Write the failing tests**

Create `scripts/tests/test_memory_review_collect.py`:

```python
"""Unit tests for the memory-review store collector.

The collector must run unchanged on macOS and on Fedora Atomic, and must survive
being piped to a remote interpreter over SSH - so these tests build synthetic
store trees under tmp_path and drive the module in-process. Nothing here touches
a real ~/.claude.
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent.parent / "memory_review" / "collect_stores.py"


def _memory_file(store: Path, name: str, *, description: str, mtype: str, body: str = "body") -> None:
    store.mkdir(parents=True, exist_ok=True)
    (store / f"{name}.md").write_text(
        f"---\nname: {name}\ndescription: \"{description}\"\nmetadata:\n  type: {mtype}\n---\n\n{body}\n",
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

    project_store = projects / "-home-someone-Code-PinPoint" / "memory"
    _memory_file(project_store, "keeper", description="a project fact", mtype="project",
                 body="links to [[other]] and [[keeper]]")
    (project_store / "MEMORY.md").write_text(
        "# Memory Index\n\n- [Keeper](keeper.md) - a project fact\n- [Ghost](ghost.md) - deleted\n",
        encoding="utf-8",
    )

    _memory_file(projects / home_slug / "memory", "machine_fact",
                 description="a home-scope fact", mtype="reference")

    _memory_file(projects / "-home-someone-Code-PinPoint--claude-worktrees-agent-abc" / "memory",
                 "orphan", description="written in a worktree", mtype="project")

    (projects / "no-memory-dir").mkdir(parents=True)

    (repo / "CLAUDE.md").write_text("# project\nline two\n", encoding="utf-8")
    (repo / "AGENTS.md").write_text("stub\n", encoding="utf-8")
    (claude / "CLAUDE.md").parent.mkdir(parents=True, exist_ok=True)
    (claude / "CLAUDE.md").write_text("# global\n", encoding="utf-8")

    skill = repo / ".agents" / "skills" / "pinpoint-ui"
    skill.mkdir(parents=True)
    (skill / "SKILL.md").write_text("# ui\n", encoding="utf-8")
    (skill / "extra.md").write_text("# more\n", encoding="utf-8")

    return {"home": home, "claude": claude, "repo": repo}


def _run(machine: dict[str, Path]) -> dict:
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), "--repo", str(machine["repo"]),
         "--home", str(machine["home"]), "--claude-dir", str(machine["claude"])],
        capture_output=True, text=True, check=True,
    )
    return json.loads(proc.stdout)


def _store(doc: dict, scope: str) -> dict:
    matches = [s for s in doc["memory_stores"] if s["scope"] == scope]
    assert len(matches) == 1, f"expected exactly one {scope} store, got {len(matches)}"
    return matches[0]


def test_classifies_project_home_and_worktree_scopes(machine):
    doc = _run(machine)
    assert {s["scope"] for s in doc["memory_stores"]} == {"project", "home", "worktree"}


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
    assert pointers - files == {"ghost.md"}, "an index line pointing at a deleted memory"


def test_reports_absent_rules_dir_rather_than_assuming(machine):
    assert _run(machine)["rules"] == {"exists": False, "files": []}


def test_collects_context_files_and_skills(machine):
    doc = _run(machine)
    kinds = {c["kind"]: c for c in doc["context_files"]}
    assert kinds["project-claude-md"]["exists"] is True
    assert kinds["project-claude-md"]["lines"] == 3
    assert kinds["global-claude-md"]["exists"] is True
    assert kinds["review-md"]["exists"] is False
    assert doc["skills"] == [
        {"name": "pinpoint-ui", "path": str(machine["repo"] / ".agents/skills/pinpoint-ui"),
         "file_count": 2, "bytes": doc["skills"][0]["bytes"]}
    ]


def test_no_subprocess_or_third_party_imports():
    """Hard constraint: this file gets piped to a remote python3 with no PATH."""
    source = SCRIPT.read_text(encoding="utf-8")
    assert "subprocess" not in source
    assert "import yaml" not in source
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest scripts/tests/test_memory_review_collect.py -v`
Expected: FAIL — collection error, `scripts/memory_review/collect_stores.py` does not exist.

- [ ] **Step 3: Write the collector**

Create `scripts/memory_review/collect_stores.py`:

```python
#!/usr/bin/env python3
"""Enumerate this machine's Claude auto-memory stores and canonical context files.

Emits one JSON document on stdout. Uses only the standard library and performs no
subprocess, network, or third-party calls, which is what lets it be piped to a
remote interpreter over SSH - non-interactive SSH on Bazzite sources no shell
config, so brew and everything it provides are absent from PATH:

    python3 scripts/memory_review/collect_stores.py --repo "$PWD"
    ssh bazzite 'python3 - --repo /var/home/froeht/Code/PinPoint' \
        < scripts/memory_review/collect_stores.py

Beads memories are NOT collected here - reading them needs `bd`, a subprocess.
The review skill collects those separately.
"""

from __future__ import annotations

import argparse
import json
import re
import socket
import sys
from pathlib import Path

WORKTREE_MARKER = "--claude-worktrees-"
LINK_RE = re.compile(r"\[\[([^\]]+)\]\]")
INDEX_POINTER_RE = re.compile(r"\(([^)]+\.md)\)")
FRONTMATTER_KEY_RE = re.compile(r"^\s*([A-Za-z_]+):\s*(.*)$")
WANTED_KEYS = ("name", "description", "type")

CONTEXT_TARGETS = (
    ("global-claude-md", "{home}/.claude/CLAUDE.md"),
    ("project-claude-md", "{repo}/CLAUDE.md"),
    ("project-agents-md", "{repo}/AGENTS.md"),
    ("review-md", "{repo}/REVIEW.md"),
)


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def _line_count(text: str) -> int:
    return text.count("\n") + 1


def _parse_frontmatter(text: str) -> dict[str, str]:
    """Pull the flat keys we care about out of a memory file's frontmatter.

    Deliberately not a YAML parser: PyYAML is not in the standard library and this
    module must stay dependency-free. Memory frontmatter is a fixed shape - `name`,
    `description`, and a nested `metadata` block whose only interesting key is
    `type` - so a line-oriented read is sufficient and cannot raise on an
    unexpected document. `setdefault` means a top-level key wins over a nested one
    of the same name.
    """
    out: dict[str, str] = {}
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return out
    for line in lines[1:]:
        if line.strip() == "---":
            break
        match = FRONTMATTER_KEY_RE.match(line)
        if not match:
            continue
        key, value = match.group(1), match.group(2).strip()
        if len(value) > 1 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        if key in WANTED_KEYS and value:
            out.setdefault(key, value)
    return out


def _entry(path: Path) -> dict:
    text = _read(path)
    frontmatter = _parse_frontmatter(text)
    # Path.stat().st_mtime rather than a stat(1) shellout: BSD and GNU stat take
    # different flags, and this runs on both macOS and Fedora Atomic.
    stat = path.stat()
    return {
        "file": path.name,
        "name": frontmatter.get("name", path.stem),
        "description": frontmatter.get("description", ""),
        "type": frontmatter.get("type", ""),
        "bytes": stat.st_size,
        "mtime": int(stat.st_mtime),
        "lines": _line_count(text),
        "links": sorted(set(LINK_RE.findall(text))),
    }


def _index_info(index: Path) -> dict:
    if not index.is_file():
        return {"exists": False, "lines": 0, "bytes": 0, "pointers": []}
    text = _read(index)
    return {
        "exists": True,
        "lines": _line_count(text),
        "bytes": index.stat().st_size,
        "pointers": sorted(set(INDEX_POINTER_RE.findall(text))),
    }


def _encode_path(path: Path) -> str:
    """Reproduce how Claude names a store directory: the absolute path with every
    '/' replaced by '-'. Used only to recognise the home-scope store."""
    return str(path).replace("/", "-")


def _classify(slug: str, home: Path) -> str:
    if WORKTREE_MARKER in slug:
        return "worktree"
    if slug == _encode_path(home):
        return "home"
    return "project"


def collect_memory_stores(claude_dir: Path, home: Path) -> list[dict]:
    projects = claude_dir / "projects"
    if not projects.is_dir():
        return []
    stores = []
    for slug_dir in sorted(projects.iterdir()):
        memory = slug_dir / "memory"
        if not memory.is_dir():
            continue
        entries = [_entry(p) for p in sorted(memory.glob("*.md")) if p.name != "MEMORY.md"]
        stores.append(
            {
                "slug": slug_dir.name,
                "scope": _classify(slug_dir.name, home),
                "path": str(memory),
                "index": _index_info(memory / "MEMORY.md"),
                "entry_count": len(entries),
                "entries": entries,
            }
        )
    return stores


def collect_context_files(repo: Path, home: Path) -> list[dict]:
    """AGENTS.md is collected for measurement only - PP-22e4 reduces it to a
    <=10-line stub with a CI gate, so tracking its size is how a review notices
    that gate's state. It is never a promotion destination."""
    out = []
    for kind, template in CONTEXT_TARGETS:
        path = Path(template.format(home=home, repo=repo))
        info: dict = {"kind": kind, "path": str(path), "exists": path.is_file()}
        if info["exists"]:
            text = _read(path)
            info["lines"] = _line_count(text)
            info["bytes"] = path.stat().st_size
        out.append(info)
    return out


def collect_rules(repo: Path) -> dict:
    """Path-scoped rules arrive in PP-22e4 PR 8. Report absence; never assume."""
    rules = repo / ".claude" / "rules"
    if not rules.is_dir():
        return {"exists": False, "files": []}
    files = [
        {"file": p.name, "bytes": p.stat().st_size, "lines": _line_count(_read(p))}
        for p in sorted(rules.glob("*.md"))
    ]
    return {"exists": True, "files": files}


def collect_skills(repo: Path) -> list[dict]:
    root = repo / ".agents" / "skills"
    if not root.is_dir():
        return []
    out = []
    for skill_dir in sorted(root.iterdir()):
        if not (skill_dir / "SKILL.md").is_file():
            continue
        files = [p for p in sorted(skill_dir.rglob("*.md")) if p.is_file()]
        out.append(
            {
                "name": skill_dir.name,
                "path": str(skill_dir),
                "file_count": len(files),
                "bytes": sum(p.stat().st_size for p in files),
            }
        )
    return out


def build_document(repo: Path, home: Path, claude_dir: Path) -> dict:
    return {
        "schema_version": 1,
        "machine": socket.gethostname(),
        "home": str(home),
        "repo": str(repo),
        "memory_stores": collect_memory_stores(claude_dir, home),
        "context_files": collect_context_files(repo, home),
        "rules": collect_rules(repo),
        "skills": collect_skills(repo),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Enumerate this machine's recorded-context stores.")
    parser.add_argument("--repo", required=True, help="absolute path to the PinPoint checkout on THIS machine")
    parser.add_argument("--home", default=None, help="override the home directory (tests)")
    parser.add_argument("--claude-dir", default=None, help="override ~/.claude (tests)")
    args = parser.parse_args(argv)

    home = Path(args.home) if args.home else Path.home()
    claude_dir = Path(args.claude_dir) if args.claude_dir else home / ".claude"
    json.dump(build_document(Path(args.repo), home, claude_dir), sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest scripts/tests/test_memory_review_collect.py -v`
Expected: PASS, 8 tests.

- [ ] **Step 5: Lint**

Run: `ruff check scripts/memory_review/ scripts/tests/test_memory_review_collect.py && ruff format scripts/memory_review/ scripts/tests/test_memory_review_collect.py`
Expected: clean, no reformatting after the first pass.

- [ ] **Step 6: Smoke it against the real Mac store**

Run: `python3 scripts/memory_review/collect_stores.py --repo "$(git rev-parse --show-toplevel)" | python3 -c 'import json,sys; d=json.load(sys.stdin); print({s["scope"]: s["entry_count"] for s in d["memory_stores"]})'`
Expected: a `project` store with ~22 entries and a `home` store with ~2. Confirms the real frontmatter parses.

- [ ] **Step 7: Commit**

```bash
git add scripts/memory_review/collect_stores.py scripts/tests/test_memory_review_collect.py
git commit -m "feat(memory-review): dependency-free store collector (PP-uoqg)

Enumerates one machine's Claude auto-memory stores plus the canonical
context files as JSON. Standard library only and no subprocess, so it can
be piped to a remote python3 over SSH where brew is off the PATH.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Store snapshotter

The undo. Must exist and be proven before any code can delete a memory.

**Files:**

- Create: `scripts/memory_review/snapshot_stores.py`
- Test: `scripts/tests/test_memory_review_snapshot.py`

**Interfaces:**

- Consumes: nothing (reads the filesystem directly, same override flags as Task 1).
- Produces: a JSON receipt on stdout — `{"schema_version": 1, "snapshot_dir": str, "stores": [{"slug": str, "files": int, "bytes": int}], "pruned": [str]}` — and a directory tree at `<dest-root>/<timestamp>/<slug>/`.

- [ ] **Step 1: Write the failing tests**

Create `scripts/tests/test_memory_review_snapshot.py`:

```python
"""Unit tests for the memory-review snapshotter.

The Claude memory store has no history and no undo, so this script is the only
way back from a bad review pass. These tests pin the two properties that matter:
every store is copied byte-for-byte, and retention pruning never deletes the
snapshot just taken.
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent.parent / "memory_review" / "snapshot_stores.py"


@pytest.fixture
def machine(tmp_path: Path) -> dict[str, Path]:
    home = tmp_path / "home" / "someone"
    claude = home / ".claude"
    store = claude / "projects" / "-home-someone-Code-PinPoint" / "memory"
    store.mkdir(parents=True)
    (store / "one.md").write_text("---\nname: one\n---\nalpha\n", encoding="utf-8")
    (store / "MEMORY.md").write_text("- [One](one.md)\n", encoding="utf-8")
    return {"home": home, "claude": claude, "dest": tmp_path / "snapshots"}


def _run(machine: dict[str, Path], *extra: str) -> dict:
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), "--home", str(machine["home"]),
         "--claude-dir", str(machine["claude"]), "--dest-root", str(machine["dest"]), *extra],
        capture_output=True, text=True, check=True,
    )
    return json.loads(proc.stdout)


def test_copies_every_file_byte_for_byte(machine):
    receipt = _run(machine, "--stamp", "20260728-120000")
    copied = Path(receipt["snapshot_dir"]) / "-home-someone-Code-PinPoint" / "memory"
    assert (copied / "one.md").read_text(encoding="utf-8") == "---\nname: one\n---\nalpha\n"
    assert (copied / "MEMORY.md").read_text(encoding="utf-8") == "- [One](one.md)\n"
    assert receipt["stores"][0]["files"] == 2


def test_snapshot_dir_is_named_for_the_stamp(machine):
    receipt = _run(machine, "--stamp", "20260728-120000")
    assert Path(receipt["snapshot_dir"]).name == "20260728-120000"


def test_refuses_to_overwrite_an_existing_snapshot(machine):
    _run(machine, "--stamp", "20260728-120000")
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), "--home", str(machine["home"]),
         "--claude-dir", str(machine["claude"]), "--dest-root", str(machine["dest"]),
         "--stamp", "20260728-120000"],
        capture_output=True, text=True,
    )
    assert proc.returncode != 0
    assert "already exists" in proc.stderr


def test_pruning_keeps_the_newest_and_never_the_current(machine):
    for stamp in ("20260701-000000", "20260702-000000", "20260703-000000"):
        _run(machine, "--stamp", stamp)
    receipt = _run(machine, "--stamp", "20260704-000000", "--keep", "2")
    remaining = sorted(p.name for p in machine["dest"].iterdir())
    assert remaining == ["20260703-000000", "20260704-000000"]
    assert receipt["pruned"] == ["20260701-000000", "20260702-000000"]
    assert Path(receipt["snapshot_dir"]).is_dir(), "must never prune the snapshot it just took"


def test_keep_zero_disables_pruning(machine):
    _run(machine, "--stamp", "20260701-000000")
    receipt = _run(machine, "--stamp", "20260702-000000", "--keep", "0")
    assert receipt["pruned"] == []
    assert len(list(machine["dest"].iterdir())) == 2


def test_no_subprocess_import():
    assert "subprocess" not in SCRIPT.read_text(encoding="utf-8")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest scripts/tests/test_memory_review_snapshot.py -v`
Expected: FAIL — `scripts/memory_review/snapshot_stores.py` does not exist.

- [ ] **Step 3: Write the snapshotter**

Create `scripts/memory_review/snapshot_stores.py`:

```python
#!/usr/bin/env python3
"""Snapshot this machine's Claude auto-memory stores before a review applies changes.

The memory store has no version history and no undo, so this is the only way back
if a review pass deletes something it should not have. One-way by design: Claude
never reads these snapshots and nothing merges them back - restoring is a
deliberate human copy.

Standard library only and no subprocess, for the same reason as collect_stores.py:

    ssh bazzite 'python3 - --dest-root ~/.pinpoint/memory-snapshots' \
        < scripts/memory_review/snapshot_stores.py
"""

from __future__ import annotations

import argparse
import datetime
import json
import shutil
import sys
from pathlib import Path

DEFAULT_KEEP = 10


def find_stores(claude_dir: Path) -> list[Path]:
    """Every slug directory that actually holds a memory store.

    Worktree-slug stores are included deliberately: a memory written by a
    worktree session is otherwise invisible and unrecoverable, which makes it
    exactly the thing a snapshot should protect.
    """
    projects = claude_dir / "projects"
    if not projects.is_dir():
        return []
    return sorted(p / "memory" for p in sorted(projects.iterdir()) if (p / "memory").is_dir())


def copy_store(store: Path, snapshot_dir: Path) -> dict:
    target = snapshot_dir / store.parent.name / store.name
    shutil.copytree(store, target)
    files = [p for p in target.rglob("*") if p.is_file()]
    return {
        "slug": store.parent.name,
        "files": len(files),
        "bytes": sum(p.stat().st_size for p in files),
    }


def prune(dest_root: Path, keep: int, current: Path) -> list[str]:
    """Drop the oldest snapshots beyond `keep`. `keep <= 0` disables pruning.

    `current` is excluded unconditionally - pruning must never delete the
    snapshot this run just took, no matter what `keep` is set to.
    """
    if keep <= 0:
        return []
    existing = sorted(p for p in dest_root.iterdir() if p.is_dir() and p != current)
    doomed = existing[: max(0, len(existing) - (keep - 1))]
    for path in doomed:
        shutil.rmtree(path)
    return [p.name for p in doomed]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Snapshot this machine's Claude memory stores.")
    parser.add_argument("--dest-root", default=None, help="snapshot root (default ~/.pinpoint/memory-snapshots)")
    parser.add_argument("--stamp", default=None, help="snapshot directory name (default: UTC timestamp)")
    parser.add_argument("--keep", type=int, default=DEFAULT_KEEP, help="snapshots to retain; 0 disables pruning")
    parser.add_argument("--home", default=None, help="override the home directory (tests)")
    parser.add_argument("--claude-dir", default=None, help="override ~/.claude (tests)")
    args = parser.parse_args(argv)

    home = Path(args.home) if args.home else Path.home()
    claude_dir = Path(args.claude_dir) if args.claude_dir else home / ".claude"
    dest_root = Path(args.dest_root) if args.dest_root else home / ".pinpoint" / "memory-snapshots"
    stamp = args.stamp or datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d-%H%M%S")

    snapshot_dir = dest_root / stamp
    if snapshot_dir.exists():
        print(f"snapshot {snapshot_dir} already exists - refusing to overwrite", file=sys.stderr)
        return 1

    dest_root.mkdir(parents=True, exist_ok=True)
    snapshot_dir.mkdir()
    stores = [copy_store(store, snapshot_dir) for store in find_stores(claude_dir)]

    receipt = {
        "schema_version": 1,
        "snapshot_dir": str(snapshot_dir),
        "stores": stores,
        "pruned": prune(dest_root, args.keep, snapshot_dir),
    }
    json.dump(receipt, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest scripts/tests/test_memory_review_snapshot.py -v`
Expected: PASS, 6 tests.

- [ ] **Step 5: Lint and take a real snapshot**

Run: `ruff check scripts/memory_review/ && ruff format scripts/memory_review/ && python3 scripts/memory_review/snapshot_stores.py`
Expected: clean lint; a receipt naming a new directory under `~/.pinpoint/memory-snapshots/`. Verify the Mac's 22 project memories are in it before continuing — this snapshot is the safety net for every later task.

- [ ] **Step 6: Commit**

```bash
git add scripts/memory_review/snapshot_stores.py scripts/tests/test_memory_review_snapshot.py
git commit -m "feat(memory-review): one-way snapshot of the memory stores (PP-uoqg)

The Claude memory store has no history and no undo, so a review pass that
deletes a memory is otherwise irreversible. Snapshots are never read back
by Claude and never merged - restoring is a deliberate human copy.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Cross-machine dispatcher

Ships an approved manifest to Bazzite and lets **its own** Claude apply it. Step 1 is a spike, because the remote permission posture is the plan's one genuine unknown and everything after it depends on the answer.

**Files:**

- Create: `scripts/memory_review/apply_remote.sh`
- Test: `scripts/tests/test_memory_review_apply_remote.py`

**Interfaces:**

- Consumes: `collect_stores.py` and `snapshot_stores.py` (pipes both to the remote interpreter over stdin); a manifest file written by the review skill.
- Produces: `apply_remote.sh --manifest <path> [--host bazzite] [--dry-run]` → the remote result document on stdout.

Manifest schema (written by the skill, read by the remote agent):

```json
{
  "schema_version": 1,
  "generated": "2026-07-28T14:00:00Z",
  "target_machine": "bazzite",
  "actions": [
    {
      "id": "a1",
      "op": "create",
      "slug": "-var-home-froeht-Code-PinPoint",
      "name": "tmux_cc_server_wedge",
      "type": "reference",
      "description": "one line",
      "body": "markdown body",
      "reason": "propagated from mac"
    },
    {
      "id": "a2",
      "op": "delete",
      "slug": "-var-home-froeht-Code-PinPoint",
      "name": "copilot_quota_review_passes_gate",
      "reason": "duplicated by the beads memory, which is the surviving copy"
    },
    {
      "id": "a3",
      "op": "rewrite",
      "slug": "-var-home-froeht-Code-PinPoint",
      "name": "radix_select_form_reset_replay",
      "description": "one line",
      "body": "markdown body",
      "reason": "merged with the Mac's copy"
    }
  ]
}
```

Result schema (written by the remote agent, returned on stdout):

```json
{
  "schema_version": 1,
  "machine": "bazzite",
  "applied": ["a1", "a3"],
  "disputed": [
    {
      "id": "a2",
      "reason": "still true on this machine - the fontconfig path differs from the Mac's"
    }
  ],
  "failed": []
}
```

- [ ] **Step 1: Spike the remote permission posture**

The remote `claude -p` must write files under `~/.claude/projects/*/memory/` without prompting. Establish which posture works **before** writing the dispatcher. Try in this order and stop at the first that succeeds:

```bash
# a. scoped allow rule in Bazzite's machine-local settings (preferred - durable, narrow,
#    and settings.json is deliberately NOT stowed, so machine-specific rules belong there)
ssh bazzite 'python3 -c "
import json, pathlib
p = pathlib.Path.home() / \".claude/settings.json\"
s = json.loads(p.read_text())
allow = s.setdefault(\"permissions\", {}).setdefault(\"allow\", [])
rule = \"Write(//var/home/froeht/.claude/projects/**)\"
print(rule in allow, len(allow))
"'

# b. verify a non-interactive write actually lands
ssh bazzite '$HOME/.local/bin/claude -p "Write the single word ok to /tmp/mr-spike.txt, then stop." \
  --output-format json'
ssh bazzite 'cat /tmp/mr-spike.txt && rm -f /tmp/mr-spike.txt'
```

Record the working posture as a comment in `apply_remote.sh`. If **no** posture allows an unattended write, fall back in this order — Tim's preference first (stated 2026-07-28), and do not invent anything beyond it:

1. **Human-triggered remote session (preferred).** `apply_remote.sh` stops after staging the manifest and prints the exact prompt for Tim to paste into a Claude session on Bazzite — reachable via `baz`, or via the Remote Control service already running there as a `--user` systemd unit. An interactive session prompts for permission and he approves. This keeps the property that motivated the whole design: each machine's memories are written by that machine's own agent, using the current sanctioned mechanism. It also fits the rest of the design, where nothing destructive happens unattended. Implement as a `--stage-only` flag, and make it the default if the spike fails.
2. **Direct file writes over SSH (last resort).** Accepts the format-coupling risk that ruled out git-backing. Only if both the unattended posture and the human-triggered path prove unworkable, and it gets an explicit note in the skill saying why.

- [ ] **Step 2: Write the failing tests**

Create `scripts/tests/test_memory_review_apply_remote.py`:

```python
"""Unit tests for the cross-machine memory-review dispatcher.

`ssh` and `scp` are stubbed with fake executables on PATH so no real machine is
touched. Every external command the script can invoke is stubbed - a partially
stubbed harness is how a passing test still reaches the network (see the
merge-pr.sh harness that wrote six real huddle comments because `bd` was live).
"""

import json
import os
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent.parent / "memory_review" / "apply_remote.sh"

REMOTE_RESULT = {
    "schema_version": 1,
    "machine": "bazzite",
    "applied": ["a1"],
    "disputed": [{"id": "a2", "reason": "still true here"}],
    "failed": [],
}


@pytest.fixture
def harness(tmp_path: Path) -> dict:
    """A stub bin dir plus a valid manifest. Stubs log every invocation."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    log = tmp_path / "calls.log"

    (bin_dir / "ssh").write_text(
        "#!/usr/bin/env bash\n"
        f'echo "ssh $*" >> {log}\n'
        f'if [[ "$*" == *result* ]]; then cat {tmp_path / "result.json"}; fi\n'
        "exit 0\n",
        encoding="utf-8",
    )
    (bin_dir / "scp").write_text(
        f'#!/usr/bin/env bash\necho "scp $*" >> {log}\nexit 0\n', encoding="utf-8"
    )
    for stub in ("ssh", "scp"):
        (bin_dir / stub).chmod(0o755)

    (tmp_path / "result.json").write_text(json.dumps(REMOTE_RESULT), encoding="utf-8")

    manifest = tmp_path / "manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "generated": "2026-07-28T14:00:00Z",
                "target_machine": "bazzite",
                "actions": [
                    {"id": "a1", "op": "create", "slug": "-var-home-froeht-Code-PinPoint",
                     "name": "n", "type": "reference", "description": "d", "body": "b", "reason": "r"}
                ],
            }
        ),
        encoding="utf-8",
    )
    return {"bin": bin_dir, "log": log, "manifest": manifest, "tmp": tmp_path}


def _run(harness: dict, *args: str) -> subprocess.CompletedProcess:
    env = dict(os.environ, PATH=f"{harness['bin']}:{os.environ['PATH']}")
    return subprocess.run(
        ["bash", str(SCRIPT), "--manifest", str(harness["manifest"]), *args],
        capture_output=True, text=True, env=env,
    )


def test_rejects_a_missing_manifest(harness):
    proc = subprocess.run(
        ["bash", str(SCRIPT), "--manifest", str(harness["tmp"] / "nope.json")],
        capture_output=True, text=True,
        env=dict(os.environ, PATH=f"{harness['bin']}:{os.environ['PATH']}"),
    )
    assert proc.returncode != 0
    assert "not found" in proc.stderr


def test_rejects_a_manifest_that_is_not_valid_json(harness):
    bad = harness["tmp"] / "bad.json"
    bad.write_text("{not json", encoding="utf-8")
    proc = subprocess.run(
        ["bash", str(SCRIPT), "--manifest", str(bad)],
        capture_output=True, text=True,
        env=dict(os.environ, PATH=f"{harness['bin']}:{os.environ['PATH']}"),
    )
    assert proc.returncode != 0
    assert "not valid JSON" in proc.stderr


def test_dry_run_snapshots_but_never_dispatches(harness):
    proc = _run(harness, "--dry-run")
    assert proc.returncode == 0
    calls = harness["log"].read_text(encoding="utf-8")
    assert "snapshot_stores.py" in calls, "a dry run must still prove the snapshot path works"
    assert "claude" not in calls, "a dry run must not launch the remote agent"


def test_snapshots_the_remote_before_dispatching(harness):
    assert _run(harness).returncode == 0
    calls = harness["log"].read_text(encoding="utf-8").splitlines()
    snapshot_at = next(i for i, c in enumerate(calls) if "snapshot_stores.py" in c)
    claude_at = next(i for i, c in enumerate(calls) if "claude" in c)
    assert snapshot_at < claude_at, "the undo must exist before anything is applied"


def test_returns_the_remote_result_document(harness):
    proc = _run(harness)
    assert proc.returncode == 0
    assert json.loads(proc.stdout)["disputed"][0]["id"] == "a2"


def test_honours_an_alternate_host(harness):
    assert _run(harness, "--host", "bazzite-lan").returncode == 0
    assert "bazzite-lan" in harness["log"].read_text(encoding="utf-8")


def test_shellcheck_is_clean():
    proc = subprocess.run(["shellcheck", str(SCRIPT)], capture_output=True, text=True)
    assert proc.returncode == 0, proc.stdout
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pytest scripts/tests/test_memory_review_apply_remote.py -v`
Expected: FAIL — `scripts/memory_review/apply_remote.sh` does not exist.

- [ ] **Step 4: Write the dispatcher**

Create `scripts/memory_review/apply_remote.sh`:

```bash
#!/usr/bin/env bash
#
# Ship an approved memory-review manifest to the other machine and have ITS OWN
# Claude apply it.
#
# Why an agent on the far side instead of writing the files over SSH: each
# machine's memories should be written by that machine's agent using whatever the
# sanctioned mechanism is at the time. Reaching over and hand-writing another
# machine's store would hard-code today's undocumented on-disk format - the exact
# fragility that ruled out git-backing the store. See
# docs/superpowers/specs/2026-07-28-memory-context-review-design.md.
#
# One round trip, no negotiation: the remote agent returns a result document and
# any item it disputes is left unapplied and escalated to Tim, never argued about
# between two agents.
#
# The two Python helpers are piped over stdin rather than assumed present on the
# far side, because non-interactive SSH on Bazzite sources no shell config - brew
# and everything it provides are off the PATH. /usr/bin/python3 is not.

set -euo pipefail

HOST="bazzite"
MANIFEST=""
DRY_RUN=0

# Absolute paths: the remote shell is non-interactive and sources nothing.
REMOTE_REPO="/var/home/froeht/Code/PinPoint"
REMOTE_CLAUDE='$HOME/.local/bin/claude'
REMOTE_SNAPSHOT_ROOT='$HOME/.pinpoint/memory-snapshots'
REMOTE_MANIFEST="/tmp/memory-review-manifest.json"
REMOTE_RESULT="/tmp/memory-review-result.json"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat >&2 <<'EOF'
usage: apply_remote.sh --manifest <path> [--host <ssh-host>] [--dry-run]

  --manifest  approved manifest JSON (schema in the design spec)
  --host      ssh alias for the target machine (default: bazzite; use
              bazzite-lan when the tailnet itself is the suspect)
  --dry-run   snapshot the remote store and stop before dispatching
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --manifest) MANIFEST="${2:-}"; shift 2 ;;
    --host) HOST="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ -z "${MANIFEST}" ]]; then
  echo "--manifest is required" >&2
  usage
  exit 2
fi
if [[ ! -f "${MANIFEST}" ]]; then
  echo "manifest not found: ${MANIFEST}" >&2
  exit 2
fi
if ! python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "${MANIFEST}" 2>/dev/null; then
  echo "manifest is not valid JSON: ${MANIFEST}" >&2
  exit 2
fi

# The undo comes first, unconditionally - including on a dry run, so that the
# snapshot path is proven before a real pass depends on it.
echo "==> snapshotting ${HOST} memory stores" >&2
ssh "${HOST}" "python3 - --dest-root ${REMOTE_SNAPSHOT_ROOT}" \
  < "${SCRIPT_DIR}/snapshot_stores.py" >&2

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "==> dry run: remote snapshot taken, not dispatching" >&2
  exit 0
fi

echo "==> shipping manifest to ${HOST}" >&2
scp -q "${MANIFEST}" "${HOST}:${REMOTE_MANIFEST}"

# The prompt deliberately grants the remote agent authority to DISPUTE. It is the
# only party that can check a claim against its own machine, and a wrong deletion
# is far more expensive than a skipped one.
read -r -d '' PROMPT <<EOF || true
You are applying an approved memory-review manifest to THIS machine's Claude
memory store. Read ${REMOTE_MANIFEST}.

For each action, apply it to this machine's own memory store using your normal
memory-writing mechanism - create, rewrite, or delete the named memory and keep
MEMORY.md consistent with the result.

You may DISPUTE an action instead of applying it. Dispute when the action is
wrong for THIS machine: a memory it wants deleted is still true here, a rewrite
would drop machine-specific detail, or the stated reason does not hold locally.
A skipped action is cheap; a wrongly deleted memory is not. Do not negotiate and
do not improvise alternatives - apply or dispute.

Write a JSON result to ${REMOTE_RESULT} with exactly these keys:
  schema_version (1), machine, applied (list of action ids),
  disputed (list of {id, reason}), failed (list of {id, reason}).
Then stop.
EOF

echo "==> dispatching headless claude on ${HOST}" >&2
ssh "${HOST}" "cd ${REMOTE_REPO} && ${REMOTE_CLAUDE} -p $(printf '%q' "${PROMPT}")" >&2

echo "==> retrieving result" >&2
ssh "${HOST}" "cat ${REMOTE_RESULT}"
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest scripts/tests/test_memory_review_apply_remote.py -v`
Expected: PASS, 7 tests.

- [ ] **Step 6: Verify the real dry run**

Run: `bash scripts/memory_review/apply_remote.sh --manifest /dev/null --dry-run 2>&1 | head -3` (expect the JSON rejection), then build a manifest with an empty `actions` array and run `--dry-run` against the real Bazzite. Expected: a remote snapshot receipt, and no `claude` launched.

- [ ] **Step 7: Commit**

```bash
git add scripts/memory_review/apply_remote.sh scripts/tests/test_memory_review_apply_remote.py
git commit -m "feat(memory-review): cross-machine dispatcher (PP-uoqg)

Ships an approved manifest to the other machine and lets its own Claude
apply it, so each machine's memories are written by that machine's agent
using whatever the sanctioned mechanism is at the time. Snapshots before
dispatching; one round trip, with disputes escalated rather than argued.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The skill

The judgment layer. Not unit-testable — validated by the repo's own gates plus a real dry run.

**Files:**

- Create: `.agents/skills/pinpoint-memory-review/SKILL.md`
- Create: `.agents/skills/pinpoint-memory-review/references/routing.md`

**Interfaces:**

- Consumes: all three scripts from Tasks 1–3, and `bd memories --json` for the beads store.
- Produces: the runbook an agent follows. No code.

- [ ] **Step 1: Write `references/routing.md`**

Split out from `SKILL.md` so it loads only when a fact is actually being routed — the progressive-disclosure pattern the context-engineering guidance recommends. Content, verbatim from the spec's "Core routing principle" and "The three defects" sections:

- The six-destination cost table (`.claude/hooks/` → zero tokens; `CLAUDE.md` → every session; `bd remember` → every session unfiltered; `.claude/rules/*.md` → path match; `.agents/skills/` → task match; auto-memories → description match).
- The rule: **cheapest tier that still guarantees it fires.**
- The three defects: too expensive (demote), too cheap (promote — including "could this be a hook?"), duplicated (dedupe, merging first if copies carry distinct detail).
- The `feedback_*` exception: surface as a question, only on a signal, never as a weekly roll-call.
- A worked example per defect, using the real cases: the tmux `-CC` fact (duplicated across three tiers with the `kill -WINCH` recovery only in the memory), `copilot-quota` (in beads _and_ a Bazzite memory file), and `--no-verify` (a prose rule that is already a hook — the demote-to-mechanism case).
- The note that `.claude/rules/` is conditional on PP-22e4 PR 8 and must be skipped as a destination while absent.

- [ ] **Step 2: Write `SKILL.md`**

Frontmatter `name: pinpoint-memory-review` and a `description` naming its triggers: the weekly chores checklist item, "review memories", "memory review", "what have you recorded".

Body sections:

1. **When to use / when not to.** Not for writing a single memory; this is the periodic pass.
2. **Phase 1 — collect.** Run `collect_stores.py` locally and piped over SSH to Bazzite; `bd memories --json` for beads. Note the `bazzite-lan` fallback and that `tailscale ping` succeeding proves nothing about the data plane.
3. **Phase 1 — verify, fanned out.** ~48 items, batches of ~6, so ~8 subagents. Each batch owns verification (beads still exist and match their described state; branches merged or abandoned; files, paths, symbols, `package.json` scripts still present; versions still current; Bazzite claims checked over SSH), duplication hunting **with `rg --hidden`** because default `rg` skips `.agents/` and `.claude/`, and a routing verdict per item.
4. **Phase 1 — synthesise.** Keep the findings table in the lead's context; Tim asks follow-ups and the lead must answer without re-reading.
5. **The veto gate.** Silent tier applies immediately and is logged. Consequential tier is a numbered list, **one line each, topic only**, presented in-session — never a document, because a long list gets rubber-stamped. Detail on demand.
6. **Phase 2 — apply.** Snapshot locally, apply locally, then `apply_remote.sh`. Disputes are left unapplied and reported to Tim, never renegotiated.
7. **Close out.** Note findings on the chores bead; re-defer it a week out per `pinpoint-chores`.
8. **Constraints.** Never audit skill contents (out of scope by decision). Home-scope memories are reviewed but not propagated unless judged machine-independent. Beads memories are triaged per-fact, not migrated wholesale.

- [ ] **Step 3: Register the skill**

Add one row to the `AGENTS.md` §3 skills table under a Workflow category: `pinpoint-memory-review` — "Weekly curated pass over recorded context: prune, promote, dedupe across both machines".

If PP-22e4's AGENTS.md-stub PR has already landed and §3 is gone, register it in whichever file inherited the skills table instead, and note the change here.

- [ ] **Step 4: Validate**

Run: `pnpm run check`
Expected: green. Specifically `check:rule-ids` must pass — it now gates `.agents/skills/**/*.md`, so any `CORE-*` ID cited in the new skill must resolve against `docs/NON_NEGOTIABLES.md`. Prefer citing no rule IDs at all over citing one that may be retired.

- [ ] **Step 5: Commit**

```bash
git add .agents/skills/pinpoint-memory-review AGENTS.md
git commit -m "feat(memory-review): the review skill and its routing reference (PP-uoqg)

The judgment layer over the three scripts: collect from both machines,
fan verification out to subagents, propose, take Tim's veto, apply.
Routing detail lives in a reference file so it loads only when a fact is
actually being routed.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Weekly chores integration

The trigger. No scheduler — the existing `weekly-chore` bead already nags on either machine and clears everywhere.

**Files:**

- Modify: `.agents/skills/pinpoint-chores/SKILL.md` (the `### Checklist` section)
- Modify: the recurring `weekly-chore` bead's duplicated checklist

- [ ] **Step 1: Add the checklist item to the skill**

Append a new numbered item to `### Checklist` in `.agents/skills/pinpoint-chores/SKILL.md`:

> **N. Memory & context review** — load the `pinpoint-memory-review` skill and run a pass. Reviews every store of recorded context across both machines, proposes prunes/promotions/dedupes, and hands Tim a short veto list. Context-heavy: farm the verification out to subagents per that skill, and keep only the synthesis inline.

Place it after the existing advisor/bead-review items, since it is the most context-hungry item and the skill already says to delegate those.

- [ ] **Step 2: Mirror it on the bead**

`pinpoint-chores` states the checklist is duplicated on the bead so `bd show` and the skill stay in sync — **both must change or they drift.**

```bash
bd list --label weekly-chore --json
bd update <chores-bead-id> --description "<existing description with the new item appended>"
bd comments add <chores-bead-id> "Added checklist item: memory & context review (PP-uoqg)."
```

- [ ] **Step 3: Verify the pair matches**

Run: `bd show <chores-bead-id>` and diff its checklist against the skill's by eye. Expected: identical item lists, same order.

- [ ] **Step 4: Full gate**

Run: `pnpm run check`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add .agents/skills/pinpoint-chores/SKILL.md
git commit -m "feat(chores): add the memory & context review to the weekly pass (PP-uoqg)

No new scheduler - the recurring weekly-chore bead already nags on either
machine and clears everywhere. Mirrored on the bead per the skill's
keep-them-matched rule.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Deliver

- [ ] **Run the full gate.** `pnpm run preflight` — this touches scripts and a hook-adjacent surface, so the slower gate is warranted over bare `check`.
- [ ] **Do one real review pass end-to-end** against both machines, with `--dry-run` on the remote leg. This is the only test of the judgment layer. Expect the first pass to surface the known cases: the tmux `-CC` triplication, `copilot-quota` duplication, and the 33 disjoint project memories.
- [ ] **Send Claude-ContextRewrite the cross-tier duplication list** they asked for on PP-lt12.61 — specifically duplication their PRs 5/7 skill-simplification pass would not catch. This is a promised deliverable, not optional.
- [ ] **Push and open the PR ready-for-review.** Non-UI, so no screenshots needed.
- [ ] **Hand Tim the merge command:** `! scripts/workflow/merge-pr.sh <PR> --human`. Never merge, via any path.

## Self-Review Notes

Checked against the spec:

- **Spec coverage.** Problem → Tasks 1+3 (cross-machine collection and apply). Routing principle and three defects → Task 4 `references/routing.md`. Phase 1 collect/verify/synthesise → Task 4 `SKILL.md` §2–4. Veto gate → §5. Phase 2 with snapshot-first → Task 2 + Task 3 + §6. Chores integration → Task 5. Scope decisions (home-scope not propagated, skills never audited, beads triaged per-fact) → §8. PP-22e4 dependencies → Global Constraints + Task 1 `collect_rules` + Task 4 Step 3's fallback. The duplication list owed to ContextRewrite → Deliver.
- **The spec's one open question is resolved by construction:** Task 3 Step 1 is a spike that settles the remote permission posture empirically, with the spec's documented fallback (direct SSH writes) as the explicit else-branch rather than an invented third option.
- **Type consistency.** `collect_stores.py` emits `memory_stores[].slug/scope/entries[].name`; the manifest in Task 3 keys actions by `slug` + `name`, matching. The result document's `applied`/`disputed`/`failed` names are identical in the schema, the dispatcher's prompt, and the test's assertions.
- **Known gap, deliberate:** the judgment layer has no automated test, because its output is a proposal for a human. The Deliver step's real end-to-end pass is the substitute, and it has concrete expected findings so a vacuous pass is detectable.

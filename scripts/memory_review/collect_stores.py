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
        entries = [
            _entry(p) for p in sorted(memory.glob("*.md")) if p.name != "MEMORY.md"
        ]
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
    parser = argparse.ArgumentParser(
        description="Enumerate this machine's recorded-context stores."
    )
    parser.add_argument(
        "--repo",
        required=True,
        help="absolute path to the PinPoint checkout on THIS machine",
    )
    parser.add_argument("--home", default=None, help="override the home directory")
    parser.add_argument("--claude-dir", default=None, help="override ~/.claude")
    args = parser.parse_args(argv)

    home = Path(args.home) if args.home else Path.home()
    claude_dir = Path(args.claude_dir) if args.claude_dir else home / ".claude"
    json.dump(
        build_document(Path(args.repo), home, claude_dir),
        sys.stdout,
        indent=2,
        sort_keys=True,
    )
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

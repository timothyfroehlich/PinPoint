"""Tests that every node-invoked hook command in .claude/settings.json
resolves and runs when the session cwd is unrelated to the repo (PP-iapy).

Every node hook used to be invoked by a bare relative path
(`node .claude/hooks/x.cjs`), while every bash hook was already anchored to
${CLAUDE_PROJECT_DIR:-.}. When the session cwd moved off a directory that
happens to contain .claude/hooks -- a worktree removed, cwd changed mid-
session -- Node exited with MODULE_NOT_FOUND and Claude Code reported a
"Failed with non-blocking status code" -- so the tool call PROCEEDED and the
guard hooks (block-direct-merge, block-main-worktree-branch-switch,
block-worktree-dispatch-from-linked) went silently inert.

These tests read the real settings.json rather than a fixture copy, so a
future edit that re-introduces a bare relative path is caught here instead of
only in production use.
"""

import json
import os
import re
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent
SETTINGS_PATH = REPO_ROOT / ".claude" / "settings.json"
CODEX_HOOKS_PATH = REPO_ROOT / ".codex" / "hooks.json"

# Matches `node "${CLAUDE_PROJECT_DIR:-.}"/.claude/hooks/<name>.cjs` -- the
# same anchoring form the bash hooks in this file already use.
ANCHORED_NODE_HOOK_RE = re.compile(
    r'node\s+"\$\{CLAUDE_PROJECT_DIR:-\.\}"/\.claude/hooks/[\w./-]+\.cjs'
)

# A node invocation of a .claude/hooks/*.cjs script that is NOT anchored via
# ${CLAUDE_PROJECT_DIR:-.} -- i.e. the bare-relative-path bug shape.
BARE_NODE_HOOK_RE = re.compile(
    r"(?<!\$\{CLAUDE_PROJECT_DIR:-\.\}\"/)\bnode\s+\.claude/hooks/"
)


def _collect_commands(event_entries: object) -> list[str]:
    """Every `command` string wired under one hook-event array."""
    commands: list[str] = []
    if not isinstance(event_entries, list):
        return commands
    for entry in event_entries:
        if not isinstance(entry, dict):
            continue
        inner = entry.get("hooks")
        if not isinstance(inner, list):
            continue
        for h in inner:
            if isinstance(h, dict) and isinstance(h.get("command"), str):
                commands.append(h["command"])
    return commands


def _all_hook_commands() -> list[str]:
    settings = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    commands: list[str] = []
    for event_entries in settings.get("hooks", {}).values():
        commands.extend(_collect_commands(event_entries))
    return commands


def _node_hook_commands() -> list[str]:
    """Every wired command that invokes a .claude/hooks/*.cjs script via node."""
    return [
        cmd
        for cmd in _all_hook_commands()
        if re.search(r"\bnode\b.*\.claude/hooks/[\w./-]+\.cjs", cmd)
    ]


NODE_HOOK_COMMANDS = _node_hook_commands()

# The seven hooks named in PP-iapy. Kept as an explicit list so a future
# settings.json edit that silently drops one is caught rather than the
# parametrized tests just running over a shorter list.
EXPECTED_NODE_HOOK_BASENAMES = [
    "inject-beads-actor.cjs",
    "block-direct-merge.cjs",
    "block-main-worktree-branch-switch.cjs",
    "block-worktree-dispatch-from-linked.cjs",
    "ui-screenshot-reminder.cjs",
    "verify-guard-stack.cjs",
]


def test_settings_json_exists() -> None:
    assert SETTINGS_PATH.is_file(), f"expected {SETTINGS_PATH} to exist"


def test_project_hooks_do_not_register_global_huddle_runtime() -> None:
    """Huddle injection and Git maintenance are owned entirely by dotfiles."""
    claude_commands = _all_hook_commands()
    codex_hooks = json.loads(CODEX_HOOKS_PATH.read_text(encoding="utf-8"))
    codex_commands: list[str] = []
    for event_entries in codex_hooks.get("hooks", {}).values():
        codex_commands.extend(_collect_commands(event_entries))

    registered = "\n".join([*claude_commands, *codex_commands])
    assert ".agents/huddle/" not in registered
    assert "huddle-main-watch" not in registered
    assert "huddle-service" not in registered


def test_all_seven_node_hooks_are_wired() -> None:
    """Sanity check the fixture reflects the real settings.json -- a
    regression that deletes a hook's registration entirely should fail here,
    not pass silently because the parametrized tests below had nothing to
    iterate over."""
    joined = "\n".join(NODE_HOOK_COMMANDS)
    missing = [b for b in EXPECTED_NODE_HOOK_BASENAMES if b not in joined]
    assert not missing, f"expected node hook(s) not found in settings.json: {missing}"


@pytest.mark.parametrize("command", NODE_HOOK_COMMANDS, ids=lambda c: c.split("/")[-1])
def test_node_hook_command_is_anchored_to_project_dir(command: str) -> None:
    """Every node hook command must resolve its script path via
    ${CLAUDE_PROJECT_DIR:-.}, matching the form the bash hooks in the same
    file already use -- not a bare relative path that only resolves when the
    session cwd happens to contain .claude/hooks."""
    assert ANCHORED_NODE_HOOK_RE.search(command), (
        f"node hook command is not CLAUDE_PROJECT_DIR-anchored: {command!r}"
    )
    assert not BARE_NODE_HOOK_RE.search(command), (
        f"node hook command still uses a bare relative path: {command!r}"
    )


@pytest.mark.parametrize("command", NODE_HOOK_COMMANDS, ids=lambda c: c.split("/")[-1])
def test_node_hook_resolves_and_runs_from_unrelated_cwd(
    command: str, tmp_path: Path
) -> None:
    """Reproduces the PP-iapy failure mode directly: run the exact command
    string wired in settings.json, with cwd set somewhere far from the repo
    and CLAUDE_PROJECT_DIR set to the real repo root -- the way Claude Code
    invokes hooks. Must NOT fail with node's MODULE_NOT_FOUND."""
    unrelated_cwd = tmp_path / "unrelated"
    unrelated_cwd.mkdir()
    env = os.environ.copy()
    env["CLAUDE_PROJECT_DIR"] = str(REPO_ROOT)

    result = subprocess.run(
        ["bash", "-c", command],
        cwd=unrelated_cwd,
        env=env,
        input="{}",
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )

    assert "MODULE_NOT_FOUND" not in result.stderr, (
        f"hook failed to resolve from an unrelated cwd: {command!r}\n"
        f"stderr:\n{result.stderr}"
    )
    assert "Cannot find module" not in result.stderr, (
        f"hook failed to resolve from an unrelated cwd: {command!r}\n"
        f"stderr:\n{result.stderr}"
    )


def test_bare_relative_path_form_actually_fails_from_unrelated_cwd(
    tmp_path: Path,
) -> None:
    """Proves the assertions above test something real: the OLD bare-
    relative-path form does fail from an unrelated cwd even with
    CLAUDE_PROJECT_DIR set (it never consulted that variable), which is
    exactly the PP-iapy bug. If this stops failing, node's module resolution
    changed underneath us and the regression test above needs revisiting."""
    unrelated_cwd = tmp_path / "unrelated"
    unrelated_cwd.mkdir()
    env = os.environ.copy()
    env["CLAUDE_PROJECT_DIR"] = str(REPO_ROOT)

    result = subprocess.run(
        ["bash", "-c", "node .claude/hooks/verify-guard-stack.cjs"],
        cwd=unrelated_cwd,
        env=env,
        input="{}",
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )

    assert result.returncode != 0
    assert "MODULE_NOT_FOUND" in result.stderr

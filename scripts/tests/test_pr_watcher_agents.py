"""Cross-harness contract tests for the native PR lifecycle watcher agents."""

from __future__ import annotations

import json
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CODEX_AGENT = ROOT / ".codex/agents/pr-lifecycle-watcher.toml"
CLAUDE_AGENT = ROOT / ".claude/agents/pr-lifecycle-watcher.md"
ANTIGRAVITY_AGENT = ROOT / ".agents/agents/pr-lifecycle-watcher.md"
SERVER_ARGS = ["exec", "tsx", "scripts/workflow/pr-watcher-mcp.ts"]


def _markdown_agent(path: Path) -> tuple[dict[str, object], str, str]:
    raw = path.read_text(encoding="utf-8")
    opening, frontmatter, body = raw.split("---", maxsplit=2)
    assert opening == ""

    parsed: dict[str, object] = {}
    lines = frontmatter.strip().splitlines()
    index = 0
    while index < len(lines):
        line = lines[index]
        if line.startswith(" ") or ":" not in line:
            index += 1
            continue
        key, value = line.split(":", maxsplit=1)
        value = value.strip()
        if value:
            if value in {"true", "false"}:
                parsed[key] = value == "true"
            elif value.isdigit():
                parsed[key] = int(value)
            elif value == "[]":
                parsed[key] = []
            else:
                parsed[key] = value
            index += 1
            continue

        items: list[str] = []
        index += 1
        while index < len(lines) and lines[index].startswith("  "):
            nested = lines[index].strip()
            if nested.startswith("- ") and not nested.endswith(":"):
                items.append(nested[2:])
            index += 1
        parsed[key] = items

    return parsed, body.strip(), frontmatter


def test_all_harnesses_define_the_same_named_agent_and_stable_contract():
    with CODEX_AGENT.open("rb") as handle:
        codex = tomllib.load(handle)
    claude, claude_body, _claude_frontmatter = _markdown_agent(CLAUDE_AGENT)
    antigravity, antigravity_body, _antigravity_frontmatter = _markdown_agent(
        ANTIGRAVITY_AGENT
    )

    assert {
        codex["name"],
        claude["name"],
        antigravity["name"],
    } == {"pr-lifecycle-watcher"}
    assert codex["developer_instructions"].strip() == claude_body == antigravity_body
    assert "Call watch_pr_lifecycle exactly once" in claude_body
    assert "Return the tool's terminal JSON result verbatim with no commentary" in (
        claude_body
    )
    assert "retry" in claude_body


def test_agent_models_and_native_boundaries_match_the_approved_plan():
    with CODEX_AGENT.open("rb") as handle:
        codex = tomllib.load(handle)
    claude, _claude_body, _claude_frontmatter = _markdown_agent(CLAUDE_AGENT)
    antigravity, _antigravity_body, _antigravity_frontmatter = _markdown_agent(
        ANTIGRAVITY_AGENT
    )

    assert codex["model"] == "gpt-5.3-codex-spark"
    assert codex["model_reasoning_effort"] == "low"
    assert codex["sandbox_mode"] == "read-only"
    assert claude["model"] == "haiku"
    assert claude["effort"] == "low"
    assert claude["background"] is True
    assert claude["maxTurns"] == 2
    assert claude["permissionMode"] == "dontAsk"
    assert claude["tools"] == ["mcp__pr_lifecycle_watch__watch_pr_lifecycle"]
    assert antigravity["model"] == "flash"
    assert antigravity["mainAgent"] is False
    assert antigravity["subagent"] is True
    assert antigravity["commandExecutionPolicy"] == "off"
    assert antigravity["tools"] == []


def test_every_agent_targets_the_same_single_tool_stdio_server():
    with CODEX_AGENT.open("rb") as handle:
        codex = tomllib.load(handle)
    _claude, _claude_body, claude_frontmatter = _markdown_agent(CLAUDE_AGENT)
    _antigravity, _antigravity_body, antigravity_frontmatter = _markdown_agent(
        ANTIGRAVITY_AGENT
    )

    codex_server = codex["mcp_servers"]["pr_lifecycle_watch"]
    assert codex_server["command"] == "pnpm"
    assert codex_server["args"] == SERVER_ARGS
    assert codex_server["required"] is True
    assert codex_server["tool_timeout_sec"] > 3600
    assert codex_server["enabled_tools"] == ["watch_pr_lifecycle"]

    for frontmatter, harness in (
        (claude_frontmatter, "claude-code"),
        (antigravity_frontmatter, "antigravity"),
    ):
        assert "mcpServers:" in frontmatter
        assert "pr_lifecycle_watch" in frontmatter
        assert "command: pnpm" in frontmatter
        for argument in SERVER_ARGS:
            assert f"- {argument}" in frontmatter
        assert f"GH_MONITOR_HARNESS: {harness}" in frontmatter
        assert "GH_MONITOR_MODEL: unknown" in frontmatter
        assert 'GH_MONITOR_WAKES: "1"' in frontmatter


def test_agent_definitions_have_no_mutation_capable_watcher_command():
    combined = "\n".join(
        path.read_text(encoding="utf-8")
        for path in (CODEX_AGENT, CLAUDE_AGENT, ANTIGRAVITY_AGENT)
    )
    forbidden = ["gh pr merge", "gh api", "git push", "request-codex-review.sh"]
    assert all(command not in combined for command in forbidden)

    # Keep this JSON-serializable so accidental custom command additions are
    # visible in assertion output rather than hidden in a parser object.
    assert json.dumps(SERVER_ARGS) == (
        '["exec", "tsx", "scripts/workflow/pr-watcher-mcp.ts"]'
    )

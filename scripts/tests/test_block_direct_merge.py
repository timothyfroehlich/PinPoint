"""Regression coverage for repository scoping in block-direct-merge.cjs."""

import json
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent
GUARD_PATH = REPO_ROOT / ".claude" / "hooks" / "block-direct-merge.cjs"


def classify(tool_name: str, tool_input: str | dict[str, object]) -> dict[str, object]:
    script = """
const { classifyMerge } = require(process.argv[1]);
const toolName = process.argv[2];
const toolInput = JSON.parse(process.argv[3]);
process.stdout.write(JSON.stringify(classifyMerge(toolName, toolInput)));
"""
    result = subprocess.run(
        [
            "node",
            "-e",
            script,
            str(GUARD_PATH),
            tool_name,
            json.dumps(tool_input),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


@pytest.mark.parametrize(
    "command",
    [
        "gh pr merge 4 --repo timothyfroehlich/dotfiles --squash",
        "gh -R timothyfroehlich/dotfiles pr merge 4 --squash",
        "gh pr merge https://github.com/timothyfroehlich/dotfiles/pull/4 --squash",
        "gh api -X PUT repos/timothyfroehlich/dotfiles/pulls/4/merge",
    ],
)
def test_explicit_other_repository_cli_merge_is_not_pinpoint_guarded(
    command: str,
) -> None:
    assert classify("Bash", command)["block"] is False


@pytest.mark.parametrize(
    "command",
    [
        "gh pr merge 1964 --squash",
        "gh pr merge 1964 --repo timothyfroehlich/PinPoint --squash",
        "gh api -X PUT repos/timothyfroehlich/PinPoint/pulls/1964/merge",
        'gh pr merge 4 --repo "$TARGET_REPOSITORY" --squash',
        (
            "gh pr merge https://github.com/timothyfroehlich/PinPoint/pull/1964 "
            "--repo timothyfroehlich/dotfiles --squash"
        ),
    ],
)
def test_pinpoint_or_ambiguous_cli_merge_remains_guarded(command: str) -> None:
    result = classify("Bash", command)
    assert result["block"] is True
    assert result["kind"] == "merge"


def test_explicit_other_repository_mcp_merge_is_not_pinpoint_guarded() -> None:
    tool_input = {
        "owner": "timothyfroehlich",
        "repo": "dotfiles",
        "pull_number": 4,
    }
    assert classify("mcp__github__merge_pull_request", tool_input)["block"] is False


@pytest.mark.parametrize(
    "tool_input",
    [
        {"owner": "timothyfroehlich", "repo": "PinPoint", "pull_number": 1964},
        {"pull_number": 1964},
        {"owner": "$OWNER", "repo": "$REPOSITORY", "pull_number": 1964},
    ],
)
def test_pinpoint_or_ambiguous_mcp_merge_remains_guarded(
    tool_input: dict[str, object],
) -> None:
    result = classify("mcp__github__merge_pull_request", tool_input)
    assert result["block"] is True
    assert result["kind"] == "merge"

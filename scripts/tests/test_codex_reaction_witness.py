"""Tests for the trusted Codex eyes-to-clean reaction witness."""

import json
import os
import stat
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent.parent / "workflow" / "codex-reaction-witness.sh"
WORKFLOW = Path(__file__).parents[2] / ".github/workflows/codex-reaction-witness.yaml"
HEAD = "a" * 40
OTHER_HEAD = "b" * 40
BOT = "chatgpt-codex-connector[bot]"
TRIGGERED_AT = "2026-08-28T03:00:00Z"


def reaction(content: str, created_at: str, login: str = BOT) -> dict:
    return {
        "user": {"login": login},
        "content": content,
        "created_at": created_at,
    }


def run_witness(
    tmp_path: Path,
    *,
    heads: list[str] | None = None,
    reaction_pages: list[list[dict]] | None = None,
    reviews: list[dict] | None = None,
) -> tuple[subprocess.CompletedProcess[str], list[dict]]:
    heads_path = tmp_path / "heads.json"
    heads_path.write_text(json.dumps(heads or [HEAD]))
    reactions_path = tmp_path / "reactions.json"
    reactions_path.write_text(json.dumps(reaction_pages or [[]]))
    reviews_path = tmp_path / "reviews.json"
    reviews_path.write_text(json.dumps(reviews or []))
    posts_path = tmp_path / "posts.jsonl"
    calls_path = tmp_path / "reaction-call-count"
    calls_path.write_text("0")

    gh = tmp_path / "gh"
    gh.write_text(
        "#!/usr/bin/env python3\n"
        "import json, os, sys\n"
        "args = sys.argv[1:]\n"
        "if args[:2] == ['pr', 'view']:\n"
        "    heads = json.load(open(os.environ['STUB_HEADS']))\n"
        "    print(heads.pop(0) if len(heads) > 1 else heads[0])\n"
        "    json.dump(heads, open(os.environ['STUB_HEADS'], 'w'))\n"
        "elif any('/pulls/' in a and '/reviews' in a for a in args):\n"
        "    print(json.dumps(json.load(open(os.environ['STUB_REVIEWS']))))\n"
        "elif any('/reactions' in a for a in args):\n"
        "    count_path = os.environ['STUB_REACTION_CALLS']\n"
        "    count = int(open(count_path).read())\n"
        "    pages = json.load(open(os.environ['STUB_REACTIONS']))\n"
        "    print(json.dumps(pages[min(count, len(pages) - 1)]))\n"
        "    open(count_path, 'w').write(str(count + 1))\n"
        "elif any('/comments' in a for a in args) and '--method' not in args:\n"
        "    print('[]')\n"
        "elif '--method' in args:\n"
        "    body = args[args.index('-f') + 1].removeprefix('body=')\n"
        "    with open(os.environ['STUB_POSTS'], 'a') as f:\n"
        "        f.write(json.dumps({'args': args, 'body': body}) + '\\n')\n"
        "else:\n"
        "    raise SystemExit(f'unexpected gh call: {args}')\n"
    )
    gh.chmod(gh.stat().st_mode | stat.S_IEXEC)

    env = dict(os.environ)
    env.update(
        {
            "PATH": f"{tmp_path}{os.pathsep}{env['PATH']}",
            "GITHUB_REPOSITORY": "acme/widget",
            "CODEX_WITNESS_MAX_ATTEMPTS": "3",
            "CODEX_WITNESS_POLL_SECONDS": "0",
            "STUB_HEADS": str(heads_path),
            "STUB_REACTIONS": str(reactions_path),
            "STUB_REVIEWS": str(reviews_path),
            "STUB_POSTS": str(posts_path),
            "STUB_REACTION_CALLS": str(calls_path),
        }
    )
    result = subprocess.run(
        ["bash", str(SCRIPT), "123", HEAD, TRIGGERED_AT],
        capture_output=True,
        text=True,
        env=env,
        timeout=10,
    )
    posts = (
        [json.loads(line) for line in posts_path.read_text().splitlines()]
        if posts_path.exists()
        else []
    )
    return result, posts


def test_fresh_eyes_then_clean_reaction_posts_sha_pinned_witness(
    tmp_path: Path,
) -> None:
    result, posts = run_witness(
        tmp_path,
        reaction_pages=[
            [reaction("eyes", "2026-08-28T03:01:00Z")],
            [reaction("+1", "2026-08-28T03:02:00Z")],
        ],
    )
    assert result.returncode == 0, result.stderr
    assert len(posts) == 1
    assert f"<!-- pinpoint-codex-reaction-witness: {HEAD} -->" in posts[0]["body"]
    assert "03:01:00Z" in posts[0]["body"]
    assert "03:02:00Z" in posts[0]["body"]


@pytest.mark.parametrize(
    "reaction_pages",
    [
        [[reaction("eyes", "2026-08-28T02:59:59Z")]],
        [[reaction("eyes", "2026-08-28T03:01:00Z", login="other[bot]")]],
    ],
)
def test_old_or_untrusted_eyes_cannot_create_witness(
    tmp_path: Path, reaction_pages: list[list[dict]]
) -> None:
    result, posts = run_witness(tmp_path, reaction_pages=reaction_pages)
    assert result.returncode == 0, result.stderr
    assert posts == []
    assert "No commit-safe" in result.stdout


def test_head_movement_supersedes_witness(tmp_path: Path) -> None:
    result, posts = run_witness(tmp_path, heads=[OTHER_HEAD])
    assert result.returncode == 0, result.stderr
    assert posts == []
    assert "superseded" in result.stdout


def test_sha_pinned_native_review_needs_no_witness(tmp_path: Path) -> None:
    result, posts = run_witness(
        tmp_path,
        reviews=[
            {
                "user": {"login": BOT},
                "commit_id": HEAD,
                "state": "COMMENTED",
                "submitted_at": "2026-08-28T03:01:00Z",
            }
        ],
    )
    assert result.returncode == 0, result.stderr
    assert posts == []
    assert "no reaction witness needed" in result.stdout


def test_workflow_uses_trusted_main_and_narrow_permissions() -> None:
    text = WORKFLOW.read_text()
    assert "pull_request_target:" in text
    assert "types: [opened, ready_for_review, synchronize, reopened]" in text
    assert "issues: write" in text
    assert "pull-requests: read" in text
    assert "ref: ${{ github.event.repository.default_branch }}" in text
    assert "persist-credentials: false" in text
    assert "github.event.pull_request.head.repo.full_name == github.repository" in text

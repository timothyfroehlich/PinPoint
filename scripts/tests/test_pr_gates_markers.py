"""Tests for `_marker_verdict` in scripts/workflow/_pr-gates.sh.

This function decides whether a PR's head commit has been reviewed, so a bug here either
blocks a reviewed PR or — worse — passes an unreviewed one. It gained a second marker
prefix in PP-c6xz (agy reviews alongside Tim's `/code-review` attestation), and the
first attempt at that change was silently broken:

    ($prefixes[] | select($body | startswith(.)))

reads as "does $body start with the prefix", but the pipe inside `select` rebinds `.` to
$body, making it `startswith($body)` — true for every comment. `unreviewed` became
unreachable and any chatter comment was treated as a marker. Nothing in the gate output
looked obviously wrong. Hence these tests.

`gh` is stubbed on PATH so no network call happens and the fixtures are exact.
"""

import json
import os
import subprocess
from pathlib import Path

import pytest

GATES = Path(__file__).parent.parent / "workflow" / "_pr-gates.sh"

CLAUDE = "<!-- pinpoint-claude-review:"
AGY = "<!-- pinpoint-agy-review:"
HEAD = "abc1234def5678901234567890abcdef12345678"
OTHER = "999888777666555444333222111000aaabbbccc"


@pytest.fixture
def verdict(tmp_path):
    """Run `_marker_verdict` against a fixed list of PR comment bodies."""

    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    payload = tmp_path / "comments.json"

    stub = bin_dir / "gh"
    stub.write_text(f'#!/usr/bin/env bash\ncat "{payload}"\n')
    stub.chmod(0o755)

    def run(bodies, head=HEAD):
        payload.write_text(json.dumps([{"body": b} for b in bodies]))
        proc = subprocess.run(
            [
                "bash",
                "-c",
                f'source "{GATES}"; _marker_verdict 1 owner/repo "$1"',
                "_",
                head,
            ],
            capture_output=True,
            text=True,
            check=True,
            env={
                **os.environ,
                "PATH": f"{bin_dir}:{os.environ.get('PATH', '/usr/bin:/bin')}",
            },
        )
        return proc.stdout.strip()

    return run


class TestMarkerVerdict:
    def test_agy_marker_pinning_head_passes(self, verdict):
        assert (
            verdict([f"{AGY} {HEAD} -->\nagy review of head abc1234"])
            == f"marker {HEAD}"
        )

    def test_claude_marker_pinning_head_passes(self, verdict):
        assert verdict([f"{CLAUDE} {HEAD} -->\nClaude review"]) == f"marker {HEAD}"

    def test_either_marker_is_sufficient_alone(self, verdict):
        # The two attestations are deliberately equal in the gate's eyes.
        assert verdict([f"{AGY} {HEAD} -->"]).startswith("marker")
        assert verdict([f"{CLAUDE} {HEAD} -->"]).startswith("marker")

    def test_no_comments_at_all_is_unreviewed(self, verdict):
        assert verdict([]) == "unreviewed"

    def test_ordinary_chatter_is_not_a_marker(self, verdict):
        # The regression: a comment with no marker prefix must not be read as one.
        assert verdict(["looks good to me", "CI is flaky again"]) == "unreviewed"

    def test_stale_marker_reports_the_sha_it_pins(self, verdict):
        assert verdict([f"{AGY} {OTHER} -->"]) == f"stale_marker {OTHER}"

    def test_chatter_alongside_a_stale_marker_does_not_mask_it(self, verdict):
        assert verdict(["some discussion", f"{CLAUDE} {OTHER} -->", "more talk"]) == (
            f"stale_marker {OTHER}"
        )

    def test_a_fresh_marker_wins_over_a_stale_one_whatever_the_order(self, verdict):
        # Membership, not recency: a marker pinning head means someone attested head,
        # whatever order the comments landed in.
        assert (
            verdict([f"{AGY} {HEAD} -->", f"{CLAUDE} {OTHER} -->"]) == f"marker {HEAD}"
        )
        assert (
            verdict([f"{CLAUDE} {OTHER} -->", f"{AGY} {HEAD} -->"]) == f"marker {HEAD}"
        )

    def test_two_stale_markers_report_the_newest(self, verdict):
        assert verdict([f"{CLAUDE} {OTHER} -->", f"{AGY} {'1' * 40} -->"]) == (
            f"stale_marker {'1' * 40}"
        )

    def test_marker_prefix_inside_a_comment_body_is_not_a_marker(self, verdict):
        # Someone quoting the marker format while discussing it must not satisfy the gate.
        assert verdict([f"the marker looks like `{AGY} <sha> -->`"]) == "unreviewed"

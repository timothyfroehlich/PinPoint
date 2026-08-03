"""Tests for scripts/workflow/agy_review.py — the agy review wrapper.

The wrapper exists because agy has two measured defects that make it unsafe to trust
directly: it reads files outside its own workspace, and — the dangerous one — it
CONFABULATES when a read fails, emitting a confident review of a completely different
pull request with an empty findings array. A false clean pass is exactly what a review
gate must never produce.

So the highest-value tests here are not the happy paths. They are `verify_proof`
rejecting a response that did not read the diff, and `validate_findings` refusing to let
an unanchorable finding through. Both sit upstream of anything being posted, and the
SHA-pinned marker is only trustworthy because they do.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "workflow"))

from agy_review import (  # noqa: E402
    FLASH_MODEL,
    MODEL_DEPTHS,
    PRO_MODEL,
    SIGNATURE,
    ReviewError,
    _format_ranges,
    _require_proof,
    _require_shape,
    build_review_payload,
    diff_proof,
    parse_diff_hunks,
    render_findings_comment,
    validate_findings,
    verify_proof,
)

NEW_FILE_DIFF = """diff --git a/src/components/Panel.tsx b/src/components/Panel.tsx
new file mode 100644
index 00000000..422885ce
--- /dev/null
+++ b/src/components/Panel.tsx
@@ -0,0 +1,4 @@
+"use client";
+
+export function Panel() {
+}
"""

MODIFIED_DIFF = """diff --git a/src/lib/foo.ts b/src/lib/foo.ts
index 1111111..2222222 100644
--- a/src/lib/foo.ts
+++ b/src/lib/foo.ts
@@ -10,3 +10,4 @@ context zero
 context one
-removed line
+added line
+another added
@@ -58,2 +59,2 @@ later hunk
 context at 59
+added at 60
"""

TWO_FILE_DIFF = NEW_FILE_DIFF + MODIFIED_DIFF


class TestParseDiffHunks:
    def test_new_file_lines_are_all_anchorable(self):
        assert parse_diff_hunks(NEW_FILE_DIFF) == {
            "src/components/Panel.tsx": {1, 2, 3, 4}
        }

    def test_removed_lines_do_not_consume_a_right_side_number(self):
        # The hunk starts at right-side line 10. Context "context one" is 10, the removed
        # line contributes nothing, so the two added lines are 11 and 12 — not 12 and 13.
        hunks = parse_diff_hunks(MODIFIED_DIFF)
        assert {10, 11, 12}.issubset(hunks["src/lib/foo.ts"])

    def test_second_hunk_restarts_at_its_own_offset(self):
        hunks = parse_diff_hunks(MODIFIED_DIFF)
        assert {59, 60}.issubset(hunks["src/lib/foo.ts"])
        assert 13 not in hunks["src/lib/foo.ts"]

    def test_multiple_files_are_tracked_separately(self):
        hunks = parse_diff_hunks(TWO_FILE_DIFF)
        assert set(hunks) == {"src/components/Panel.tsx", "src/lib/foo.ts"}

    def test_empty_diff_yields_no_files(self):
        assert parse_diff_hunks("") == {}


class TestDiffProof:
    def test_counts_files_and_captures_first_header(self):
        assert diff_proof(TWO_FILE_DIFF) == {
            "files_changed": 2,
            "first_diff_line": "diff --git a/src/components/Panel.tsx b/src/components/Panel.tsx",
        }

    def test_empty_diff(self):
        assert diff_proof("") == {"files_changed": 0, "first_diff_line": ""}


class TestVerifyProof:
    """The confabulation guard. These are the tests that keep the marker honest."""

    def test_matching_proof_passes(self):
        actual = diff_proof(TWO_FILE_DIFF)
        assert verify_proof(dict(actual), actual) == []

    def test_tolerates_surrounding_whitespace(self):
        actual = diff_proof(NEW_FILE_DIFF)
        claimed = {
            "files_changed": 1,
            "first_diff_line": f"  {actual['first_diff_line']}  ",
        }
        assert verify_proof(claimed, actual) == []

    def test_wrong_file_count_is_rejected(self):
        actual = diff_proof(TWO_FILE_DIFF)
        problems = verify_proof({**actual, "files_changed": 16}, actual)
        assert len(problems) == 1
        assert "16" in problems[0]

    def test_review_of_a_different_pr_is_rejected(self):
        # The observed failure: agy answered from memory about an unrelated PR. Its proof
        # describes that PR's diff, not the one it was handed.
        actual = diff_proof(NEW_FILE_DIFF)
        claimed = {
            "files_changed": 16,
            "first_diff_line": "diff --git a/.oxlintrc.json b/.oxlintrc.json",
        }
        assert len(verify_proof(claimed, actual)) == 2

    def test_missing_proof_is_rejected(self):
        assert verify_proof(None, diff_proof(NEW_FILE_DIFF)) == [
            "proof is missing or not an object"
        ]

    def test_non_object_proof_is_rejected(self):
        assert verify_proof("looks fine to me", diff_proof(NEW_FILE_DIFF))


class TestValidateFindings:
    def test_anchorable_findings_pass(self):
        hunks = parse_diff_hunks(NEW_FILE_DIFF)
        findings = [{"path": "src/components/Panel.tsx", "line": 3}]
        assert validate_findings(findings, hunks) == []

    def test_line_outside_the_hunk_is_rejected_with_valid_ranges(self):
        hunks = parse_diff_hunks(NEW_FILE_DIFF)
        problems = validate_findings(
            [{"path": "src/components/Panel.tsx", "line": 91}], hunks
        )
        assert len(problems) == 1
        assert "findings[0]" in problems[0]
        # The error has to be actionable — agy corrects itself from these ranges.
        assert "1-4" in problems[0]

    def test_file_not_in_the_diff_is_rejected(self):
        hunks = parse_diff_hunks(NEW_FILE_DIFF)
        problems = validate_findings(
            [{"path": "src/lib/invented.ts", "line": 3}], hunks
        )
        assert "not a file in the diff" in problems[0]

    def test_each_bad_finding_is_reported_separately(self):
        hunks = parse_diff_hunks(TWO_FILE_DIFF)
        findings = [
            {"path": "src/components/Panel.tsx", "line": 3},
            {"path": "src/components/Panel.tsx", "line": 99},
            {"path": "nope.ts", "line": 1},
        ]
        problems = validate_findings(findings, hunks)
        assert len(problems) == 2
        assert "findings[1]" in problems[0]
        assert "findings[2]" in problems[1]


class TestFormatRanges:
    @pytest.mark.parametrize(
        ("lines", "expected"),
        [
            ({1, 2, 3, 4}, "1-4"),
            ({12, 13, 14, 58, 59}, "12-14, 58-59"),
            ({7}, "7"),
            ({1, 3, 5}, "1, 3, 5"),
        ],
    )
    def test_collapses_contiguous_spans(self, lines, expected):
        assert _format_ranges(lines) == expected

    def test_empty_set_explains_itself(self):
        assert "none" in _format_ranges(set())


class TestBuildReviewPayload:
    RESULT = {
        "summary": "Looks reasonable overall.",
        "findings": [
            {
                "path": "src/components/Panel.tsx",
                "line": 3,
                "side": "RIGHT",
                "severity": "high",
                "rule": "CORE-SEC-007",
                "body": "Renders an email outside an admin view.",
            }
        ],
    }

    def test_event_is_comment(self):
        # APPROVE/REQUEST_CHANGES are rejected by GitHub on your own PR, and `gh` is
        # authed as the account that opens them.
        payload = build_review_payload(self.RESULT, "a" * 40)
        assert payload["event"] == "COMMENT"

    def test_commit_id_pins_the_reviewed_sha(self):
        payload = build_review_payload(self.RESULT, "b" * 40)
        assert payload["commit_id"] == "b" * 40

    def test_every_comment_is_signed(self):
        payload = build_review_payload(self.RESULT, "a" * 40)
        assert payload["comments"][0]["body"].endswith(SIGNATURE)
        assert payload["body"].endswith(SIGNATURE)

    def test_comment_keeps_its_anchor(self):
        payload = build_review_payload(self.RESULT, "a" * 40)
        comment = payload["comments"][0]
        assert (comment["path"], comment["line"], comment["side"]) == (
            "src/components/Panel.tsx",
            3,
            "RIGHT",
        )

    def test_clean_review_posts_a_body_with_no_comments(self):
        payload = build_review_payload(
            {"summary": "No findings.", "findings": []}, "a" * 40
        )
        assert payload["comments"] == []
        assert "No findings." in payload["body"]

    def test_moved_head_is_flagged_in_the_body(self):
        payload = build_review_payload(self.RESULT, "a" * 40, head_moved_to="c" * 40)
        assert "branch moved during this review" in payload["body"]
        assert "ccccccc" in payload["body"]
        # The review still posts — it is still useful; the marker pinning the reviewed
        # SHA is what makes the gate report stale_marker.
        assert payload["commit_id"] == "a" * 40

    def test_unmoved_head_adds_no_warning(self):
        payload = build_review_payload(self.RESULT, "a" * 40)
        assert "branch moved" not in payload["body"]


class TestRequireShape:
    """The retry continuation carries no schema, so its shape is unguaranteed.

    `--json-schema` constrains only the first response. A malformed continuation used to
    raise KeyError, which neither handler in `main` catches — the caller saw a traceback
    instead of the script's own FAILED line.
    """

    def test_wellformed_result_passes_through(self):
        result = {"summary": "ok", "findings": []}
        assert _require_shape(result) is result

    def test_non_object_is_rejected(self):
        with pytest.raises(ReviewError, match="expected an object"):
            _require_shape(["not", "an", "object"])

    def test_missing_findings_is_rejected(self):
        with pytest.raises(ReviewError, match="no `findings` array"):
            _require_shape({"summary": "ok"})

    def test_missing_summary_is_rejected(self):
        with pytest.raises(ReviewError, match="no `summary` string"):
            _require_shape({"findings": []})

    def test_finding_missing_an_anchor_field_is_named(self):
        with pytest.raises(ReviewError, match=r"findings\[0\] is missing line, side"):
            _require_shape(
                {"summary": "ok", "findings": [{"path": "a.ts", "body": "x"}]}
            )


class TestRenderFindingsComment:
    """The moved-head fallback: GitHub anchors `line` against the PR's CURRENT diff, not
    against `commit_id`, so inline anchors can be rejected wholesale once head moves."""

    RESULT = {
        "summary": "Two problems.",
        "findings": [
            {
                "path": "src/a.ts",
                "line": 12,
                "severity": "high",
                "rule": "CORE-SEC-007",
                "body": "Leaks an email.",
            },
            {
                "path": "src/b.ts",
                "line": 40,
                "severity": "low",
                "rule": None,
                "body": "Minor.",
            },
        ],
    }

    def test_names_both_shas_so_the_reader_knows_what_was_reviewed(self):
        out = render_findings_comment(self.RESULT, "a" * 40, "b" * 40)
        assert "aaaaaaa" in out
        assert "bbbbbbb" in out

    def test_every_finding_survives_with_its_location(self):
        out = render_findings_comment(self.RESULT, "a" * 40, "b" * 40)
        assert "src/a.ts:12" in out
        assert "src/b.ts:40" in out
        assert "Leaks an email." in out

    def test_a_rule_id_is_shown_when_present_and_omitted_when_not(self):
        out = render_findings_comment(self.RESULT, "a" * 40, "b" * 40)
        assert "CORE-SEC-007" in out
        assert "None" not in out

    def test_signed(self):
        assert render_findings_comment(self.RESULT, "a" * 40, "b" * 40).endswith(
            SIGNATURE
        )

    def test_clean_review_still_renders(self):
        out = render_findings_comment(
            {"summary": "Nothing found.", "findings": []}, "a" * 40, "b" * 40
        )
        assert "Nothing found." in out


class TestModelDepths:
    """A depth must never read as a `/code-review` level Tim did not run (PP-9onv)."""

    def test_each_model_maps_to_an_agy_prefixed_depth(self):
        assert MODEL_DEPTHS[FLASH_MODEL] == "agy-flash"
        assert MODEL_DEPTHS[PRO_MODEL] == "agy-pro"

    def test_no_depth_collides_with_a_code_review_level(self):
        levels = {"low", "medium", "high", "xhigh", "max", "ultra", "trivial"}
        assert not (set(MODEL_DEPTHS.values()) & levels)
        assert all(d.startswith("agy-") for d in MODEL_DEPTHS.values())


class TestRequireProof:
    """Called after EVERY response, not just the first.

    The retry replaces `result` wholesale, so verifying proof once left the guard the
    whole design rests on bypassable by anything that came after it: a retry answered
    from memory whose invented findings happened to anchor to valid lines would post,
    and would write the marker.
    """

    def test_passes_a_response_that_read_the_diff(self):
        actual = diff_proof(NEW_FILE_DIFF)
        result = {"summary": "s", "findings": [], "proof": dict(actual)}
        assert _require_proof(result, actual) is result

    def test_rejects_a_response_describing_another_diff(self):
        actual = diff_proof(NEW_FILE_DIFF)
        result = {
            "summary": "s",
            "findings": [],
            "proof": {"files_changed": 16, "first_diff_line": "diff --git a/x b/x"},
        }
        with pytest.raises(ReviewError, match="answered from memory"):
            _require_proof(result, actual)

    def test_rejects_a_response_with_no_proof_at_all(self):
        with pytest.raises(ReviewError, match="answered from memory"):
            _require_proof({"summary": "s", "findings": []}, diff_proof(NEW_FILE_DIFF))

    def test_error_names_what_mismatched(self):
        actual = diff_proof(TWO_FILE_DIFF)
        with pytest.raises(ReviewError, match="files_changed"):
            _require_proof({"proof": {**actual, "files_changed": 99}}, actual)


class TestRequireShapeSeverity:
    def test_severity_is_required_because_the_print_loop_indexes_it(self):
        # The schema constrains only the first response; a retry omitting `severity`
        # used to raise KeyError past both handlers in main().
        with pytest.raises(ReviewError, match="findings\\[0\\] is missing severity"):
            _require_shape(
                {
                    "summary": "s",
                    "findings": [
                        {"path": "a.ts", "line": 1, "side": "RIGHT", "body": "x"}
                    ],
                }
            )

"""Tests for scripts/migration_statements.py — regenerated vs reviewed migration SQL."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from migration_statements import (  # noqa: E402
    hand_written,
    main,
    missing_from_reviewed,
    statements,
)

GENERATED = (
    'ALTER TABLE "tags" ADD COLUMN "slug" text;--> statement-breakpoint\n'
    'CREATE INDEX "tags_slug_idx" ON "tags" USING btree ("slug");'
)

REVIEWED = (
    'ALTER TABLE "tags" ADD COLUMN "slug" text;--> statement-breakpoint\n'
    "-- Backfill before the index so it builds once.\n"
    'UPDATE "tags"\n  SET "slug" = lower("name");--> statement-breakpoint\n'
    'CREATE INDEX "tags_slug_idx" ON "tags" USING btree ("slug");\n'
)


def test_statements_ignores_comments_whitespace_and_line_breaks():
    assert statements(REVIEWED) == [
        'ALTER TABLE "tags" ADD COLUMN "slug" text;',
        'UPDATE "tags" SET "slug" = lower("name");',
        'CREATE INDEX "tags_slug_idx" ON "tags" USING btree ("slug");',
    ]


def test_generated_subset_of_reviewed_passes_and_reports_hand_written():
    assert missing_from_reviewed(GENERATED, REVIEWED) == []
    assert hand_written(GENERATED, REVIEWED) == [
        'UPDATE "tags" SET "slug" = lower("name");'
    ]


def test_hand_written_statement_in_the_same_chunk_still_matches():
    """A backfill appended to the last generated statement, without a breakpoint."""
    reviewed = 'ALTER TABLE "tags" ADD COLUMN "slug" text;\nUPDATE "tags" SET "slug" = "name";\n'
    assert (
        missing_from_reviewed('ALTER TABLE "tags" ADD COLUMN "slug" text;', reviewed)
        == []
    )


def test_commented_out_statement_does_not_count_as_present():
    reviewed = '/* ALTER TABLE "tags" ADD COLUMN "slug" text; */\nUPDATE "tags" SET "name" = "name";'
    assert missing_from_reviewed(
        'ALTER TABLE "tags" ADD COLUMN "slug" text;', reviewed
    ) == ['ALTER TABLE "tags" ADD COLUMN "slug" text;']


def test_statement_in_a_trailing_comment_does_not_count_as_present():
    reviewed = 'UPDATE "t" SET "x" = 1; -- replaces ALTER TABLE "t" DROP COLUMN "c";'
    assert missing_from_reviewed('ALTER TABLE "t" DROP COLUMN "c";', reviewed) == [
        'ALTER TABLE "t" DROP COLUMN "c";'
    ]


def test_dashes_inside_quotes_are_not_comments():
    """`--` inside a literal is text: '--old' and '--new' must not compare equal."""
    reviewed = 'ALTER TABLE "t" ALTER COLUMN "c" SET DEFAULT \'--old\';'
    generated = 'ALTER TABLE "t" ALTER COLUMN "c" SET DEFAULT \'--new\';'
    assert missing_from_reviewed(generated, reviewed) == [generated]
    assert missing_from_reviewed(reviewed, reviewed) == []


def test_backslash_escaped_quote_in_an_e_string_does_not_flip_quote_state():
    reviewed = 'UPDATE t SET s = E\'it\\\'s\';\n-- ALTER TABLE "t" DROP COLUMN "c";\n'
    generated = 'ALTER TABLE "t" DROP COLUMN "c";'
    assert missing_from_reviewed(generated, reviewed) == [generated]


def test_dollar_inside_an_identifier_is_not_a_dollar_quote():
    reviewed = 'UPDATE "t" SET col$x$ = 1;\n-- ALTER TABLE "t" DROP COLUMN "c";\n'
    generated = 'ALTER TABLE "t" DROP COLUMN "c";'
    assert missing_from_reviewed(generated, reviewed) == [generated]


def test_nested_block_comment_hides_the_whole_statement():
    reviewed = '/* old: /* note */ ALTER TABLE "a" ADD COLUMN "c" text; */\nUPDATE "a" SET "id" = 1;'
    generated = 'ALTER TABLE "a" ADD COLUMN "c" text;'
    assert missing_from_reviewed(generated, reviewed) == [generated]


def test_dollar_quoted_body_keeps_its_comment_markers():
    body = (
        "CREATE FUNCTION f() RETURNS int AS $fn$ SELECT 1; -- one\n$fn$ LANGUAGE sql;"
    )
    assert statements(body) == [
        "CREATE FUNCTION f() RETURNS int AS $fn$ SELECT 1; -- one $fn$ LANGUAGE sql;"
    ]


def test_shared_chunk_lists_only_the_hand_written_part():
    generated = 'ALTER TABLE "tags" ADD COLUMN "slug" text;'
    reviewed = generated + '\nUPDATE "tags" SET "slug" = "name";\n'
    assert hand_written(generated, reviewed) == ['UPDATE "tags" SET "slug" = "name";']


def test_base_branch_drift_is_reported():
    """A pending column drop on the base branch shows up in the regenerated SQL."""
    drifted = (
        GENERATED
        + '--> statement-breakpoint\nALTER TABLE "sets" DROP COLUMN "is_public";'
    )
    assert missing_from_reviewed(drifted, REVIEWED) == [
        'ALTER TABLE "sets" DROP COLUMN "is_public";'
    ]


def test_hand_edited_generated_statement_is_reported():
    """A reviewed migration that rewrote a generated statement cannot be kept verbatim safely."""
    reviewed = REVIEWED.replace('"slug" text;', "\"slug\" text NOT NULL DEFAULT '';")
    assert missing_from_reviewed(GENERATED, reviewed) == [
        'ALTER TABLE "tags" ADD COLUMN "slug" text;'
    ]


def test_custom_migration_has_nothing_generated():
    assert (
        missing_from_reviewed(
            "-- Custom SQL migration file, put your code below! --\n", REVIEWED
        )
        == []
    )


def test_main_exit_codes(tmp_path: Path, capsys):
    generated = tmp_path / "generated.sql"
    reviewed = tmp_path / "reviewed.sql"
    generated.write_text(GENERATED)
    reviewed.write_text(REVIEWED)
    assert main([str(generated), str(reviewed)]) == 0
    out = capsys.readouterr().out
    assert "Keeping 1 reviewed statement(s)" in out
    assert 'UPDATE "tags" SET "slug" = lower("name");' in out

    reviewed.write_text('ALTER TABLE "tags" ADD COLUMN "slug" text;')
    assert main([str(generated), str(reviewed)]) == 1
    assert "tags_slug_idx" in capsys.readouterr().err

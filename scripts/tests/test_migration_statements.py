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
    assert "1 hand-written" in capsys.readouterr().out

    reviewed.write_text('ALTER TABLE "tags" ADD COLUMN "slug" text;')
    assert main([str(generated), str(reviewed)]) == 1
    assert "tags_slug_idx" in capsys.readouterr().err

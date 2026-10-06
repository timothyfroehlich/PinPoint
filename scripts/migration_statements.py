#!/usr/bin/env python3
"""Compare a regenerated Drizzle migration with the reviewed one it replaces.

Used by scripts/db-renumber-migration.sh. After the branch's migration is
regenerated on top of the base branch, every statement Drizzle generated must
already be in the reviewed SQL. If it is, the reviewed SQL (including any
hand-written statements) is kept verbatim under the new number. If it is not,
the regenerated migration would change what the migration does, so the
renumber stops. The two usual causes are a schema.ts merge resolution that
changed the branch's schema, and schema drift on the base branch that a later
migration is meant to apply (an expand/contract column drop).

Exit status: 0 when the generated statements are all in the reviewed SQL,
1 when some are not (they are printed), 2 on usage errors.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

BREAKPOINT = "--> statement-breakpoint"


BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)


def statements(sql: str) -> list[str]:
    """Split migration SQL into statements, dropping comments and whitespace.

    Block comments go first, so a statement commented out in the reviewed SQL
    does not count as present.
    """
    result: list[str] = []
    for chunk in BLOCK_COMMENT.sub(" ", sql).split(BREAKPOINT):
        lines = [
            line.strip()
            for line in chunk.splitlines()
            if line.strip() and not line.strip().startswith("--")
        ]
        if lines:
            result.append(" ".join(lines))
    return result


def missing_from_reviewed(generated: str, reviewed: str) -> list[str]:
    """Generated statements that the reviewed SQL does not contain.

    Matched as text within the reviewed SQL rather than chunk for chunk, so a
    hand-written statement appended to a generated one without a breakpoint
    still counts the generated one as present.
    """
    reviewed_text = " ".join(statements(reviewed))
    return [s for s in statements(generated) if s not in reviewed_text]


def hand_written(generated: str, reviewed: str) -> list[str]:
    """Reviewed SQL left over once every generated statement is taken out.

    Same text matching as missing_from_reviewed, so a generated statement that
    shares a chunk with a hand-written one is not listed as hand-written.
    """
    generated_statements = statements(generated)
    result: list[str] = []
    for chunk in statements(reviewed):
        for statement in generated_statements:
            chunk = chunk.replace(statement, " ")
        chunk = " ".join(chunk.split())
        if chunk:
            result.append(chunk)
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("generated", type=Path)
    parser.add_argument("reviewed", type=Path)
    args = parser.parse_args(argv)

    generated = args.generated.read_text()
    reviewed = args.reviewed.read_text()
    missing = missing_from_reviewed(generated, reviewed)
    if missing:
        print("Generated statements not in the reviewed migration:", file=sys.stderr)
        for statement in missing:
            print(f"  {statement}", file=sys.stderr)
        return 1

    kept = hand_written(generated, reviewed)
    if kept:
        # A statement main already applies (the same column or index added on
        # both sides) also lands here; listing them lets the author spot it.
        print(
            f"Keeping {len(kept)} reviewed statement(s) Drizzle did not generate. "
            "Check each is hand-written, not schema the base branch already has:"
        )
        for statement in kept:
            print(f"  {statement}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

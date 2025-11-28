# Task: Restore Issue Priority Field

**Context**

- During `db:prepare:test`, `drizzle-kit push` warns about dropping the `issues.priority` column. The current Drizzle schema (single-tenant rewrite) does not define `priority`, but older dev seeds did.
- Local databases still carry the legacy `priority` column; preflight prompts to drop it.

**What’s needed**

- Decide whether `issues.priority` should exist alongside `severity` in the v2 schema.
- If yes, reintroduce it to `src/server/db/schema.ts`, update Drizzle types, seeds, and UI, and add tests.
- If no, explicitly document that `priority` was removed in the v2 rewrite to avoid confusion and ensure seeds/database are aligned.

**Acceptance criteria**

1. Clear decision recorded (keep/remove) with rationale.
2. Schema, seeds, and application code updated to match the decision.
3. Tests and preflight run cleanly with no `priority` drift warnings.

# PinPoint v2 – Copilot Instruction System Documentation

This file documents how repository + pattern-specific instructions guide AI assistance for the single-tenant v2 rewrite.

## Goals

- Provide concise, actionable constraints to keep generation aligned with sources-of-truth.
- Reflect SINGLE-TENANT simplification (no organization scoping / RLS).
- Encourage server-first, progressive enhancement, strict typing, and domain clarity.

## File Structure

```
.github/
  copilot-instructions.md          # Global repository guidance (summary & priorities)
  COPILOT_INSTRUCTIONS.md          # (this) meta documentation
  instructions/
    components.instructions.md     # Server vs Client component rules
    auth.instructions.md           # Supabase SSR auth & middleware
    database.instructions.md       # Drizzle schema & data access rules
    server-actions.instructions.md # Mutation patterns & validation
    testing.instructions.md        # Memory safety & test pyramid
```

(We intentionally exclude domain-specific instruction files at greenfield start; domain patterns will graduate into `docs/patterns/*.md`.)

## Instruction Hierarchy Merge Order

1. Organization-level (none currently)
2. Repository-wide: `.github/copilot-instructions.md`
3. Pattern-specific: matching `.github/instructions/*.instructions.md`

## Source of Truth References (Never Duplicate Entire Content)

- `docs/NON_NEGOTIABLES.md` – forbidden patterns & critical constraints
- `AGENTS.md` – contextual project directives
- `docs/PATTERNS.md` – **PRIMARY** index for implementation patterns (see `docs/patterns/`)
- `docs/TYPESCRIPT_STRICTEST_PATTERNS.md` – strict TS techniques
- `docs/TESTING_PLAN.md` – test distribution & memory safety
- `docs/TECH_SPEC.md` – single-tenant architecture definition
- `TASKS.md` – active PR sequencing

## Major Differences vs Archived v1

| Topic             | v1 Archived                   | v2 Greenfield                              |
| ----------------- | ----------------------------- | ------------------------------------------ |
| Tenancy           | Multi-tenant + RLS            | Single-tenant, no RLS                      |
| Data Layer        | tRPC + Drizzle                | Direct Drizzle + Server Actions            |
| Auth              | Supabase SSR + org context    | Supabase SSR only (simpler)                |
| Testing           | pgTAP + RLS focus             | Worker-scoped PGlite + Vitest + Playwright |
| Instruction Scope | Many domain-specific patterns | Lean, foundational patterns                |

## Pattern-Specific File Purposes

- `components.instructions.md`: Enforce server-first defaults, minimal client islands, Tailwind + shadcn/ui usage.
- `auth.instructions.md`: Supabase SSR client creation order, middleware refresh, avoidance of deprecated helpers.
- `database.instructions.md`: Schema lock, direct queries, snake_case schema rules, no migrations.
- `server-actions.instructions.md`: Validation with Zod, explicit return types, progressive enhancement forms.
- `testing.instructions.md`: Test pyramid, memory safety (worker-scoped DB), avoiding per-test DB instances.

## Updating Instructions

Update instructions when:

- A pattern appears ≥2 times (add to `docs/patterns/`, link in `docs/PATTERNS.md`, then reference from instruction file)
- Source-of-truth docs change materially
- A new forbidden pattern emerges (add to `NON_NEGOTIABLES.md`, then reference)

### Update Checklist

1. Confirm change belongs in docs vs instruction file.
2. Amend source-of-truth first (e.g., `NON_NEGOTIABLES.md`).
3. Adjust or add concise guidance to relevant instruction file.
4. Ensure no duplication of entire lists; link instead.
5. Date-stamp the update in modified file footer.

## Verification Workflow

1. Open a target file (e.g., `src/app/page.tsx`).
2. Request Copilot completion; confirm server-first suggestions (no premature client code).
3. For a Server Action file, ensure suggested code includes validation + explicit return types.
4. For test files, ensure use of worker-scoped PGlite pattern and absence of per-test DB instantiation.
5. If divergence occurs, refine the relevant instruction file with clearer examples.

## Anti-Goals

- Duplicating large doc sections (causes drift)
- Enforcing premature abstractions (DAL, service layers)
- Reintroducing multi-tenant patterns not needed in v2

## Example Merge Scenario

Editing `src/app/machines/page.tsx` → Copilot merges:

1. Global instructions (server-first, domain constraints).
2. `components.instructions.md` (server vs client, import patterns).
   Result: Suggestions should produce a Server Component querying Drizzle directly, using shadcn/ui primitives, with strict typing.

## Known Future Additions (Placeholders)

- Issue workflow patterns (creation, severity, resolution) – will promote once ≥2 implementations exist.
- Commenting pattern for issue threads – same promotion rule.

## Troubleshooting

| Symptom                      | Potential Cause                             | Resolution                                                            |
| ---------------------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| Copilot suggests org scoping | Residual model memory from archived content | Reinforce single-tenant note in global file; regenerate completion    |
| Copilot adds tRPC router     | Archived instructions influence             | Remove tRPC references & retry; ensure active files omit router terms |
| Suggests migration files     | Misinterpret schema lock                    | Add clarifying example of direct schema edit pattern                  |
| Per-test DB setup suggested  | Missing explicit memory safety example      | Strengthen example in `testing.instructions.md`                       |

## Escalation

If ambiguity persists after refining instructions: open a short design note in `docs/tech-updates/` summarizing decision and link from instructions.

---

Last Updated: 2025-11-09

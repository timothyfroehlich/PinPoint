---
name: pinpoint-typescript
description: The PinPoint-specific database typing decision — `InferSelectModel` yields camelCase types directly, so there is no db→app converter layer and none should be built; narrow with `Pick<>` at boundaries instead, and convert only on reads Drizzle does not map. Use when typing a database row on its way to a component, when tempted to write a row-mapping function, or when the user mentions InferSelectModel or snake_case/camelCase. General TypeScript technique is deliberately not covered.
---

# PinPoint TypeScript

In app and e2e code, general strictest compliance is enforced rather than
documented: `pnpm run typecheck` runs `tsc --noEmit -p tsconfig.app.json`, which
extends `@tsconfig/strictest` (`exactOptionalPropertyTypes` and
`noUncheckedIndexedAccess` both on), as does `e2e/tsconfig.json`. Test files are
the exception — `tsconfig.tests.json` extends only `tsconfig.base.json` with
`strict: true`, so both of those flags are off under `src/**/*.test.*` and
`src/test/**`.

What no compiler checks is `CORE-TS-001`…`CORE-TS-008` in
`docs/NON_NEGOTIABLES.md` — and note that CORE-TS-007's ban on `!` is not linted
either (`@typescript-eslint/no-non-null-assertion` is never enabled), so that one
rests on review. This skill carries only the decision none of the above covers.

## There is no db→app converter layer, and you should not build one

`src/lib/types/database.ts` re-exports the `InferSelectModel` types. Import from
there rather than redeclaring a parallel hand-written shape.

A `dbUserToUser` / `toProfileSummary` style converter would be pure ceremony:
there is no second type system for it to translate into, and every such function
is a place for the two shapes to drift.

This is not hypothetical. PinPoint ran exactly that layer until #480: a
type-level `DrizzleToCamelCase<T>` wrapping essentially every response type, and
a runtime `transformKeysToCamelCase` at nine call sites across the DAL. Because a
runtime transform cannot carry types through, it forced an `as` assertion at
nearly every one of those sites — the one currency ts-strictest exists to refuse. It was only necessary because the v1 schema
omitted column names; the v2 schema declares both (`firstName: text("first_name")`),
and that single authoring choice is what made the layer unnecessary. Do not
reintroduce it, and never reach for a Drizzle row by its column name
(`row.full_name`) — that property does not exist. (CORE-TS-003.)

What _is_ legitimate is **narrowing** a row before it crosses a boundary — a
Client Component prop type or an API response should be a minimal `Pick<>` /
purpose-built shape, not the whole ORM row. That's a projection, not a
conversion. (CORE-SEC-006, and CORE-SEC-007 for `email` specifically.)

Conversion is only correct where Drizzle's mapping does not run: `db.execute()`
and raw SQL, Supabase RPC (`src/lib/discord/config.ts`), Supabase auth metadata
(`src/lib/auth/profile.ts`), and external APIs (`src/lib/pinballmap/parse.ts`).

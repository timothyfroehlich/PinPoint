---
name: pinpoint-typescript
description: The PinPoint-specific database typing decision — `InferSelectModel` yields camelCase types directly, so there is no db→app converter layer and none should be built; narrow with `Pick<>` at boundaries instead, and convert only on reads Drizzle does not map. Also carries the `exactOptionalPropertyTypes` resolution the compiler flags but does not teach. Use when typing a database row on its way to a component, when tempted to write a row-mapping function, or when the user mentions InferSelectModel, exactOptionalPropertyTypes, or snake_case/camelCase. General TypeScript technique is deliberately not covered.
---

# PinPoint TypeScript

In app and e2e code, general strictest compliance is enforced rather than
documented: `pnpm run typecheck` runs `tsc --noEmit -p tsconfig.app.json`, which
extends `@tsconfig/strictest` (`exactOptionalPropertyTypes` and
`noUncheckedIndexedAccess` both on), as does `e2e/tsconfig.json`. Test files are
the exception — `tsconfig.tests.json` extends only `tsconfig.base.json` with
`strict: true`, so both flags are off across everything it owns:
`src/**/*.test.ts(x)`, `src/**/*.spec.ts(x)`, `src/test/**`, and `vitest.config.ts`.

What no compiler checks is `CORE-TS-001..008` in `docs/NON_NEGOTIABLES.md` — and
note that CORE-TS-007's ban on `!` is not linted either
(`@typescript-eslint/no-non-null-assertion` is never enabled), so that one rests
on review.

## `exactOptionalPropertyTypes`: omit the key, don't assign `undefined`

The compiler flags this but does not teach the fix, and the two cheapest ways to
silence it — widening the property to `| undefined`, or an `as` cast — are both
CORE-TS-007 violations it will accept in silence. Build the object with a
conditional spread so an absent value produces an absent key:

```typescript
const data = {
  id: uuid(),
  ...(name && { name }),
};
```

## There is no db→app converter layer, and you should not build one

Import row types from the `~/lib/types` barrel (CORE-TS-001), which re-exports
the `InferSelectModel` types declared in `src/lib/types/database.ts`. Do not
redeclare a parallel hand-written shape.

A `dbUserToUser` / `toProfileSummary` style converter would be pure ceremony:
there is no second type system for it to translate into, and every such function
is a place for the two shapes to drift.

This is not hypothetical. PinPoint ran exactly that layer until #480: a
type-level `DrizzleToCamelCase<T>` wrapping essentially every response type, and
a runtime `transformKeysToCamelCase` invoked 76 times across 23 files — the DAL,
every tRPC router, and a family of dedicated `*-response-transformers.ts`
modules. Because a runtime transform cannot carry types through, it forced an
`as` assertion at nearly every one of those sites, which is the one currency
ts-strictest exists to refuse. It was only necessary because the v1 schema
omitted column names; the v2 schema declares both (`firstName: text("first_name")`),
and that single authoring choice is what made the layer unnecessary. Do not
reintroduce it, and never reach for a Drizzle row by its column name
(`row.full_name`) — that property does not exist. (CORE-TS-003.)

What _is_ legitimate is **narrowing** a row before it crosses a boundary — a
Client Component prop type or an API response should be a minimal `Pick<>` /
purpose-built shape, not the whole ORM row. That's a projection, not a
conversion. (CORE-SEC-006, and CORE-SEC-007 for `email` specifically.)

Conversion is correct wherever Drizzle's mapping does not run — it is the
supabase-js and raw-SQL paths that need it, not Drizzle rows:

- `db.execute()` and raw SQL (results skip Drizzle's `mapResultRow` entirely)
- supabase-js reads and writes, both `.rpc()` and `.from().select()`
  (`src/lib/discord/config.ts:59,128`)
- Supabase auth metadata (`src/lib/auth/profile.ts:44-46`)
- External APIs (`src/lib/pinballmap/parse.ts`)

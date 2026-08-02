---
name: pinpoint-typescript
description: The PinPoint-specific database typing decision — `InferSelectModel` yields camelCase types directly, so there is no db→app converter layer and none should be built; narrow with `Pick<>` at boundaries instead, and convert only on reads Drizzle does not map. Also carries the `exactOptionalPropertyTypes` resolution the compiler flags but does not teach, and which parts of CORE-TS-006/007 no tool enforces. Use when typing a database row on its way to a component, when tempted to write a row-mapping function, when reviewing a non-null assertion (`!`) or an `any`, or when the user mentions InferSelectModel, exactOptionalPropertyTypes, or snake_case/camelCase. General TypeScript technique is deliberately not covered.
---

# PinPoint TypeScript

## What the toolchain actually enforces

`pnpm run typecheck` runs `tsc --noEmit -p tsconfig.app.json`, which extends
`@tsconfig/strictest` — `exactOptionalPropertyTypes` and
`noUncheckedIndexedAccess` both on. `e2e/tsconfig.json` extends it too. Test
files do not: `tsconfig.tests.json` extends only `tsconfig.base.json` with
`strict: true`, so both flags are off across everything it owns —
`src/**/*.test.ts(x)`, `src/**/*.spec.ts(x)`, `src/test/**`, and `vitest.config.ts`.

The `CORE-TS-*` rules the compiler cannot express are carried by ESLint, and only
in app code. `no-explicit-any` (CORE-TS-007) and `explicit-function-return-type`
(CORE-TS-006) are both switched **off** for `e2e/**`, for test files, and for
`*.config.*` / `scripts/**`. Writing `const page: any` in an e2e spec passes
every gate.

And CORE-TS-007's ban on `!` is enforced **nowhere**:
`@typescript-eslint/no-non-null-assertion` is never enabled, and `!` is valid
TypeScript at every strictness level. That third of a Critical rule rests
entirely on review.

Full catalog: `CORE-TS-001..008` in `docs/NON_NEGOTIABLES.md`.

## `exactOptionalPropertyTypes`: omit the key, don't assign `undefined`

The compiler flags this but does not teach the fix. Of the two cheapest
silencers, an `as` cast is a CORE-TS-007 violation; widening the property to
`| undefined` is not, but it changes the contract — the key must then always be
present. Usually what you want is an absent key, which a conditional spread
produces:

```typescript
const data = {
  id: uuid(),
  ...(name !== undefined && { name }),
};
```

Guard on `!== undefined`, not truthiness. `...(name && { name })` also drops `""`
and `0`, which turns "the user cleared this field" into "the user never touched
it."

## There is no db→app converter layer, and you should not build one

Row types are declared in `src/lib/types/database.ts` — import them from there.
The `~/lib/types` barrel re-exports most but not all of them (`Notification`,
`IssueWatcher`, `IssueImage`, and the PinballMap types are not re-exported), so
reach for the barrel first and fall back to the direct path. Either way, do not
redeclare a parallel hand-written shape. Most are plain `InferSelectModel`; `Issue`
is the exception, an `Omit<>` that narrows four text columns to string unions.

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
- supabase-js reads and writes, both `.rpc()` and `.from().select()` — see
  `getDiscordConfig` and `isDiscordIntegrationEnabled` in `src/lib/discord/config.ts`
- Supabase auth metadata — the `user_metadata` extraction in `src/lib/auth/profile.ts`
- External APIs (`src/lib/pinballmap/parse.ts`)

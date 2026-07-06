---
applyTo: "**/*.ts,**/*.tsx"
---

# TypeScript (ts-strictest)

- Flag `any` — explicit, or implicit from an un-annotated param/return that widens to `any`. Suggest a concrete type or `unknown` + narrowing.
- Flag non-null assertions (`!`) and unsafe `as` casts. Allowed: `as const`, and `as` used only to narrow after a runtime guard has proven the type.
- `exactOptionalPropertyTypes` is on. Flag assigning `undefined` to an optional property (`{ x: undefined }` where `x?:`) — omit the key instead, or type it `x?: T | undefined` deliberately.
- Flag deep relative imports (`../../..`). Use the `~/` path alias.
- Prefer discriminated unions and type guards over boolean flags + optional fields that can express impossible states.

## Drizzle

- Flag SQL built by string concatenation or template interpolation of user input. Use parameterized `sql` fragments / query-builder methods.
- When a query returns a nested shape, prefer `db.query.<table>.findMany({ with: … })` over hand-rolled joins that are then re-shaped by hand — the typed relational result is safer.

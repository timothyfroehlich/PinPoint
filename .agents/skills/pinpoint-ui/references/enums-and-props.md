# Config-Driven Enums & Component Props

Authoring a new config-driven domain enum, and discriminated-union props for multi-type components.

## Config-Driven Enums (authoring a new one)

Consuming an existing domain enum is covered in `SKILL.md` § Color System — pull labels, icons and styles out of `STATUS_CONFIG` / `SEVERITY_CONFIG` / `PRIORITY_CONFIG` / `FREQUENCY_CONFIG`. This section is about **authoring** a new one.

A config-driven enum is a centralized configuration object for a domain enum that needs UI metadata (labels, styles, icons, descriptions). One module owns the values, the type, the metadata, and the accessors, so the DB schema, the Zod schema, and every component all read the same source. `src/lib/issues/status.ts` is the reference implementation: `IssueStatus` (grouped into new / in_progress / closed), `IssueSeverity`, `IssuePriority` and `IssueFrequency`, each with labels, descriptions, Tailwind styles and Lucide icons.

**Authoring template** — seven pieces, in this order, in one file under `src/lib/<domain>/`:

1. **Named constants** for type-safe access and autocomplete: `export const MY_ENUM = { VALUE_A: "value_a", ... } as const;`
2. **Runtime array** for validation: `export const ALL_MY_ENUM_VALUES = Object.values(MY_ENUM);`
3. **Literal-typed array** for the Drizzle schema: `export const MY_ENUM_VALUES = ["value_a", ...] as const;`
4. **Derived type**: `export type MyEnum = (typeof MY_ENUM_VALUES)[number];`
5. **Config object** keyed by the type, so TypeScript enforces that every value has metadata: `export const MY_ENUM_CONFIG: Record<MyEnum, { label: string; description: string; styles: string; icon: LucideIcon }> = { ... };`
6. **Getter functions** — `getMyEnumLabel`, `getMyEnumIcon`, `getMyEnumStyles`. Components call these, never index the config inline.
7. **Optional grouping export** when the UI groups values (e.g. open vs. closed): `export const MY_ENUM_GROUPS = { groupA: [MY_ENUM.VALUE_A, ...] } as const;`

Then wire it up: the Drizzle column takes `{ enum: MY_ENUM_VALUES as unknown as [string, ...string[]] }`, the Zod schema takes `z.enum(MY_ENUM_VALUES)`, and the badge component calls the getters.

**Use this pattern when** the enum has UI metadata (status, severity, priority), appears in dropdowns with labels, carries colors/icons/descriptions, or needs grouping. **Don't** use it for simple string unions with no metadata (a plain type is enough) or for enums that never surface in the UI (a plain const is enough).

### Discriminated-union props for multi-type components

When one component renders several related enum types, discriminate the props on a `type` field so `value` narrows with it. The exemplar is `src/components/issues/IssueBadge.tsx`: a `{ variant?: "normal" | "strip"; size?: "normal" | "lg"; className?: string; showTooltip?: boolean }` base intersected with `{ type: "status"; value: IssueStatus } | { type: "severity"; value: IssueSeverity } | { type: "priority"; value: IssuePriority } | { type: "frequency"; value: IssueFrequency }`, switched on the discriminant. `IssueBadgeGrid` composes it from a `Pick<Issue, "status" | "severity" | "priority" | "frequency">`. The technique itself is textbook TypeScript — reach for `pinpoint-typescript` if you need narrowing or exhaustiveness help.

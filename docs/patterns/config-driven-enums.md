# Config-Driven Enum with Rich Metadata

**Status**: Established Pattern
**Version**: 1.0
**Last Updated**: January 10, 2026

---

## Overview

Use centralized configuration objects for domain enums that need UI metadata (labels, styles, icons, descriptions). This pattern provides type safety, runtime validation, and a single source of truth for all enum-related data.

## Example: Issue Status System

[src/lib/issues/status.ts](file:///home/froeht/Code/PinPoint/src/lib/issues/status.ts)

## Pattern Structure

```typescript
import { Icon1, Icon2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// 1. Named constants for type-safe access and IDE autocomplete
export const MY_ENUM = {
  VALUE_A: "value_a",
  VALUE_B: "value_b",
  VALUE_C: "value_c",
} as const;

// 2. Runtime array for validation (Object.values)
export const ALL_MY_ENUM_VALUES = Object.values(MY_ENUM);

// 3. Type-safe array with literal types (for Drizzle schema)
export const MY_ENUM_VALUES = ["value_a", "value_b", "value_c"] as const;

// 4. Derive the canonical type from the const array
export type MyEnum = (typeof MY_ENUM_VALUES)[number];

// 5. Configuration object with all metadata
export const MY_ENUM_CONFIG: Record<
  MyEnum,
  { label: string; description: string; styles: string; icon: LucideIcon }
> = {
  value_a: {
    label: "Value A",
    description: "Description for A",
    styles: "bg-blue-500/20 text-blue-400 border-blue-500",
    icon: Icon1,
  },
  value_b: {
    label: "Value B",
    description: "Description for B",
    styles: "bg-green-500/20 text-green-400 border-green-500",
    icon: Icon2,
  },
  value_c: {
    label: "Value C",
    description: "Description for C",
    styles: "bg-red-500/20 text-red-400 border-red-500",
    icon: Icon1,
  },
};

// 6. Getter functions for type-safe access
export function getMyEnumLabel(value: MyEnum): string {
  return MY_ENUM_CONFIG[value].label;
}

export function getMyEnumIcon(value: MyEnum): LucideIcon {
  return MY_ENUM_CONFIG[value].icon;
}

export function getMyEnumStyles(value: MyEnum): string {
  return MY_ENUM_CONFIG[value].styles;
}

// 7. Optional: Grouping exports
export const MY_ENUM_GROUPS = {
  groupA: [MY_ENUM.VALUE_A, MY_ENUM.VALUE_B],
  groupB: [MY_ENUM.VALUE_C],
} as const;
```

## Usage in Database Schema

```typescript
// src/server/db/schema.ts
import { pgTable, text } from "drizzle-orm/pg-core";
import { MY_ENUM_VALUES } from "~/lib/enums/my-enum";

export const myTable = pgTable("my_table", {
  status: text("status", {
    enum: MY_ENUM_VALUES as unknown as [string, ...string[]],
  })
    .notNull()
    .default("value_a"),
});
```

## Usage in Zod Validation

```typescript
// src/app/actions.ts
import { z } from "zod";
import { MY_ENUM_VALUES } from "~/lib/enums/my-enum";

const mySchema = z.object({
  status: z.enum(MY_ENUM_VALUES),
});
```

## Usage in Components

```typescript
// src/components/MyBadge.tsx
import { getMyEnumLabel, getMyEnumIcon, getMyEnumStyles } from "~/lib/enums/my-enum";
import type { MyEnum } from "~/lib/types";
import { Badge } from "~/components/ui/badge";

export function MyBadge({ value }: { value: MyEnum }) {
  const label = getMyEnumLabel(value);
  const Icon = getMyEnumIcon(value);
  const styles = getMyEnumStyles(value);

  return (
    <Badge className={styles}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}
```

## Benefits

1. **Single Source of Truth**: All enum metadata in one place
2. **Type Safety**: TypeScript ensures all values have configuration
3. **Runtime Validation**: Can validate string inputs against `ALL_MY_ENUM_VALUES`
4. **IDE Autocomplete**: Named constants (`MY_ENUM.VALUE_A`) provide excellent DX
5. **UI Consistency**: Styles, labels, icons centrally managed
6. **Easy to Extend**: Add new value = add to array and config object
7. **No Component Logic**: Components delegate to getter functions

## When to Use

✅ Domain enums with UI metadata (status, severity, priority, etc.)
✅ Enums that appear in dropdowns/selects with labels
✅ Enums with associated colors, icons, or descriptions
✅ Enums that need grouping (e.g., "open" vs "closed" statuses)

❌ Simple string unions without metadata (use plain type)
❌ Enums that never appear in UI (use plain const)

## Related Patterns

- [Discriminated Union Component Props](./ui-patterns/discriminated-union-props.md)
- [Database Schema Enums](./database-migrations.md#enum-types)
- [Form Validation with Zod](./mutations.md#zod-validation)

## Real-World Example

See [src/lib/issues/status.ts](file:///home/froeht/Code/PinPoint/src/lib/issues/status.ts) for full implementation of:

- `IssueStatus` (11 values, 3 groups)
- `IssueSeverity` (4 values)
- `IssuePriority` (3 values)
- `IssueFrequency` (3 values)

All with labels, descriptions, Tailwind styles, and Lucide icons.

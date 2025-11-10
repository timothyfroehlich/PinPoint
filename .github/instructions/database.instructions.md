---
applyTo: "src/server/db/**/*.ts,src/server/db/schema.ts"
---

# Database Instructions (Drizzle, Single-Tenant)

## Core Tenets
- Direct Drizzle usage (no DAL/service layer unless pattern repeats ≥3 times).
- Schema evolves by direct file edit (no migration files during pre-beta).
- Single-tenant: no organizationId filtering logic.
- Maintain snake_case in schema; convert carefully only where needed at boundaries.

## Schema Rules
- Tables: `user_profiles`, `machines`, `issues`, `issue_comments` (per `TASKS.md`).
- Constraint: Each `issues` row references exactly one machine (CHECK or FK + NOT NULL).
- Severity ENUM logic: Represent via text or enum mapping: `minor | playable | unplayable`.
- Timestamps default `now()`, maintain `updated_at` via application logic when mutated.

## Example Machine & Issue Snippet
```ts
// src/server/db/schema.ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const machines = pgTable("machines", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const issues = pgTable("issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  machine_id: uuid("machine_id").notNull().references(() => machines.id),
  title: text("title").notNull(),
  severity: text("severity").notNull(), // constrained in app validation to enum
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});
```

## Query Patterns
```ts
import { db } from "~/server/db";
import { machines, issues } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export async function getMachineWithIssues(id: string) {
  const machine = await db.select().from(machines).where(eq(machines.id, id));
  const relatedIssues = await db.select().from(issues).where(eq(issues.machine_id, id));
  return { machine: machine[0], issues: relatedIssues };
}
```

## Performance (Early Phase)
- Keep queries straightforward; premature optimization discouraged.
- Batch queries only if obviously reducing n+1 risk.
- Introduce indexes only after usage patterns emerge.

## Forbidden Patterns
- Reintroducing multi-tenant organization scoping.
- Using raw SQL string interpolation (always parameterize or rely on Drizzle builder).
- Creating migration files or applying schema diffs via migrations in pre-beta stage.
- Adding abstraction layers (repositories, services) without repetition justification.

## Type Considerations
- Avoid broad `any`; rely on Drizzle inference.
- Provide explicit function return types for exported helpers.
- Keep DB-specific types local; convert to UI-friendly shapes at component boundary only when necessary.

## Testing Guidance
- Integration tests: Use worker-scoped PGlite instance.
- Validate constraints: issue must reference existing machine; severity conforms to allowed set via validation layer.
- Avoid per-test DB instance creation.

## Copilot Should Suggest
- Direct `db.select().from(table)` patterns.
- Simple relation queries rather than heavy joins at start.

## Copilot Should NOT Suggest
- OrganizationId filters.
- tRPC routers or multi-tenant RLS policies.
- Repository / service / DAL layers prematurely.

---
Last Updated: 2025-11-09

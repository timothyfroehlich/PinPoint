# Domain Rule Patterns

## Issues Always Require Machine

**Schema Enforcement**:

```typescript
// src/server/db/schema.ts
export const issues = pgTable("issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  machineId: uuid("machine_id")
    .notNull()
    .references(() => machines.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  severity: text("severity", { enum: ["minor", "playable", "unplayable"] })
    .notNull()
    .default("playable"),
  // ...
});
// machineId NOT NULL constraint enforces CORE-ARCH-004
```

**Application Pattern**:

```typescript
// Issue forms MUST include machineId
const createIssueSchema = z.object({
  title: z.string().min(1),
  machineId: z.string().uuid(), // Always required
  severity: z.enum(["minor", "playable", "unplayable"]),
});
```

**Key points**:

- Every issue must have exactly one machine (CORE-ARCH-004)
- Schema enforces with `NOT NULL` constraint and foreign key
- `onDelete: "cascade"` removes issues when machine is deleted
- Never create issue forms without machine selector

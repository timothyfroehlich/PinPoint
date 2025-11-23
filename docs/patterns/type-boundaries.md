# Type Boundary Patterns

## Database to Application Type Conversion

```typescript
// Database types (snake_case) stay in schema
// src/server/db/schema.ts
export const issues = pgTable("issues", {
  id: uuid("id").defaultRandom().primaryKey(),
  machineId: uuid("machine_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Application types (camelCase) in lib/types
// src/lib/types/index.ts
export type Issue = {
  id: string;
  machineId: string;
  createdAt: Date;
};

// Drizzle handles conversion automatically in relational queries
const dbIssues = await db.query.issues.findMany();
// dbIssues already has camelCase properties due to Drizzle's automatic conversion
```

**Key points**:

- DB schema uses snake_case (CORE-TS-004)
- Application code uses camelCase (CORE-TS-003)
- Drizzle ORM handles conversion automatically in relational queries
- For raw SQL, convert at boundaries manually
- Store shared types in `src/lib/types/`

# Drizzle Schema Patterns

## Overview

Drizzle schemas define your database structure using TypeScript. Unlike Prisma's custom schema language, Drizzle uses pure TypeScript, providing better type inference and IDE support.

## PinPoint Schema Architecture

PinPoint organizes schemas into 5 domain-specific modules for better maintainability:

```typescript
// src/server/db/schema/index.ts
export * from "./auth";
export * from "./organizations";  
export * from "./machines";
export * from "./issues";
export * from "./collections";
```

## Basic Table Definition

```typescript
import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

// IMPORTANT: Use exact Prisma table names for compatibility
export const users = pgTable("User", {  // Note: "User" not "users"
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  email: text("email").unique().notNull(),
  name: text("name"),
  image: text("image"),
  createdAt: timestamp("createdAt", { mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

// Type inference
type User = typeof users.$inferSelect; // SELECT type
type NewUser = typeof users.$inferInsert; // INSERT type
```

## Multi-Tenant Tables

```typescript
export const organizations = pgTable("organizations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  subdomain: text("subdomain").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const issues = pgTable("issues", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text("organization_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  statusId: text("status_id").notNull(),
  machineId: text("machine_id").notNull(),
  assignedToId: text("assigned_to_id"),
  createdById: text("created_by_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});
```

## Relations

```typescript
import { relations } from "drizzle-orm";

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  createdIssues: many(issues),
  assignedIssues: many(issues),
}));

export const issuesRelations = relations(issues, ({ one }) => ({
  organization: one(organizations, {
    fields: [issues.organizationId],
    references: [organizations.id],
  }),
  machine: one(machines, {
    fields: [issues.machineId],
    references: [machines.id],
  }),
  status: one(issueStatuses, {
    fields: [issues.statusId],
    references: [issueStatuses.id],
  }),
  createdBy: one(users, {
    fields: [issues.createdById],
    references: [users.id],
  }),
  assignedTo: one(users, {
    fields: [issues.assignedToId],
    references: [users.id],
  }),
}));
```

## Indexes and Constraints ⚠️ CRITICAL PATTERN

```typescript
import { index, uniqueIndex } from "drizzle-orm/pg-core";

// ✅ CORRECT: Indexes MUST be defined in table callback
export const memberships = pgTable(
  "Membership",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("userId").notNull(),
    organizationId: text("organizationId").notNull(),
    roleId: text("roleId").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [  // Array syntax for multiple indexes
    // Unique constraint
    uniqueIndex("Membership_userId_organizationId_key").on(
      table.userId,
      table.organizationId,
    ),
    // Performance indexes
    index("Membership_organizationId_idx").on(table.organizationId),
    index("Membership_userId_idx").on(table.userId),
  ],
);

// ❌ WRONG: Do NOT use separate exports (causes compatibility issues)
// export const membershipIndexes = {
//   orgIdIdx: index("memberships_org_id_idx").on(memberships.organizationId),
// };
```

### PinPoint Index Patterns

Essential multi-tenant indexes implemented:

```typescript
export const machines = pgTable(
  "Machine",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    qrCodeId: text("qrCodeId").unique().notNull(),
    organizationId: text("organizationId").notNull(),
    locationId: text("locationId").notNull(),
    modelId: text("modelId").notNull(),
    ownerId: text("ownerId"), // Nullable field
  },
  (table) => [
    // QR code scanning optimization
    index("Machine_qrCodeId_idx").on(table.qrCodeId),
    // Multi-tenant filtering
    index("Machine_organizationId_idx").on(table.organizationId),
    // Composite indexes for common queries
    index("Machine_organizationId_locationId_idx").on(
      table.organizationId,
      table.locationId,
    ),
    // Nullable field index
    index("Machine_ownerId_idx").on(table.ownerId),
  ],
);
```

## JSONB Columns

```typescript
import { jsonb } from "drizzle-orm/pg-core";

export const roles = pgTable("roles", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  organizationId: text("organization_id").notNull(),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  metadata: jsonb("metadata")
    .$type<{
      description?: string;
      color?: string;
      isSystem?: boolean;
    }>()
    .default({}),
});

// Type-safe JSONB queries
const adminRole = await db
  .select()
  .from(roles)
  .where(sql`${roles.permissions} @> '["admin"]'::jsonb`)
  .limit(1);
```

## Enums

```typescript
import { pgEnum } from "drizzle-orm/pg-core";

export const issueStatusCategory = pgEnum("issue_status_category", [
  "NEW",
  "IN_PROGRESS",
  "RESOLVED",
]);

export const issueStatuses = pgTable("issue_statuses", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  category: issueStatusCategory("category").notNull(),
  color: text("color").notNull().default("#gray"),
  organizationId: text("organization_id").notNull(),
  isDefault: boolean("is_default").default(false),
  order: integer("order").notNull().default(0),
});
```

## Timestamps and Soft Deletes

```typescript
// Reusable timestamp columns
const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

// Soft delete pattern
const softDelete = {
  deletedAt: timestamp("deleted_at"),
  deletedById: text("deleted_by_id"),
};

export const machines = pgTable("machines", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  serialNumber: text("serial_number").unique().notNull(),
  locationId: text("location_id").notNull(),
  modelId: text("model_id").notNull(),
  ...timestamps,
  ...softDelete,
});
```

## Migrations

### Creating Migrations

```bash
# Generate migration from schema changes
npm run drizzle:generate

# Create empty migration
npm run drizzle:generate --name add_issue_priority

# Apply migrations
npm run drizzle:migrate
```

### Migration File Example

```sql
-- migrations/0001_add_issue_priority.sql
ALTER TABLE issues ADD COLUMN priority_id TEXT;
ALTER TABLE issues ADD CONSTRAINT issues_priority_id_fkey
  FOREIGN KEY (priority_id) REFERENCES priorities(id);

-- Add index for performance
CREATE INDEX issues_priority_id_idx ON issues(priority_id);
```

## Junction Table Pattern (Prisma Compatibility)

PinPoint maintains Prisma's junction table pattern for exact migration compatibility:

```typescript
// Prisma-style junction table for many-to-many relationships
export const rolePermissions = pgTable(
  "_RolePermissions",  // Prisma naming convention
  {
    roleId: text("A").notNull(),  // Prisma uses A/B naming
    permissionId: text("B").notNull(),
  },
  (table) => [
    // Composite primary key
    primaryKey({ columns: [table.roleId, table.permissionId] }),
    // Foreign key constraints
    foreignKey({
      columns: [table.roleId],
      foreignColumns: [roles.id],
      onDelete: "cascade",
    }),
    foreignKey({
      columns: [table.permissionId],
      foreignColumns: [permissions.id],
      onDelete: "cascade",
    }),
    // Performance indexes
    index("_RolePermissions_B_index").on(table.permissionId),
  ],
);
```

## Schema Organization

```typescript
// src/server/db/schema/index.ts
export * from "./auth";
export * from "./organizations";
export * from "./issues";
export * from "./machines";
export * from "./collections";

// Relations must be exported from index
export { authRelations } from "./auth";
export { organizationRelations } from "./organizations";
export { machineRelations } from "./machines";
export { issueRelations } from "./issues";

// src/server/db/schema/organizations.ts
export const organizations = pgTable("Organization", {...});
export const organizationRelations = relations(organizations, {...});
```

## ⚠️ MIGRATION: Prisma Schema Patterns

### Model to Table

```typescript
// OLD: Prisma schema
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  memberships Membership[]
}

// NEW: Drizzle schema
export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  email: text("email").unique().notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
}));
```

### Relation Differences

```typescript
// OLD: Prisma relations (implicit)
model Issue {
  machine   Machine @relation(fields: [machineId], references: [id])
  machineId String
}

// NEW: Drizzle relations (explicit)
export const issuesRelations = relations(issues, ({ one }) => ({
  machine: one(machines, {
    fields: [issues.machineId],
    references: [machines.id],
  }),
}));
```

### Type Generation

```typescript
// OLD: Prisma generates types
import { User } from "@prisma/client";

// NEW: Drizzle infers types
type User = typeof users.$inferSelect;
type NewUser = typeof users.$inferInsert;
```

## Advanced Patterns

### Computed Columns

```typescript
export const issueViews = pgTable("issue_views", {
  issueId: text("issue_id").notNull(),
  userId: text("user_id"),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
  // Computed column for analytics
  viewDate: text("view_date").generatedAlwaysAs(sql`DATE(viewed_at)`, {
    mode: "stored",
  }),
});
```

### Check Constraints

```typescript
export const machines = pgTable(
  "machines",
  {
    id: text("id").primaryKey(),
    purchasePrice: integer("purchase_price"),
    currentValue: integer("current_value"),
  },
  (table) => ({
    // Ensure current value doesn't exceed purchase price
    valueCheck: sql`CHECK (${table.currentValue} <= ${table.purchasePrice})`,
  }),
);
```

### Full-Text Search

```typescript
import { sql } from "drizzle-orm";
import { index } from "drizzle-orm/pg-core";

export const issues = pgTable(
  "issues",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    // Generated tsvector column
    searchVector: sql<string>`
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  `.generatedAlwaysAs({ mode: "stored" }),
  },
  (table) => ({
    // GIN index for full-text search
    searchIdx: index("issues_search_idx").using("gin", table.searchVector),
  }),
);
```

## Best Practices

1. **Use CUID2 for IDs**: Better than UUIDs for sorting and indexing
2. **Explicit Relations**: Define all relations for better type safety
3. **Consistent Naming**: Use snake_case for database, camelCase for JS
4. **Index Foreign Keys**: Always index columns used in JOINs
5. **JSONB for Flexible Data**: Use for permissions, metadata, settings

## Testing Schemas

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

export async function createTestDatabase() {
  const pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
  });

  const db = drizzle(pool);

  // Run migrations
  await migrate(db, { migrationsFolder: "./migrations" });

  return db;
}
```

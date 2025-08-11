# Drizzle ORM Developer Guide

Drizzle is a TypeScript ORM that provides type-safe database queries with a SQL-like syntax. It offers excellent TypeScript integration, zero dependencies, and generates highly optimized SQL queries. PinPoint has migrated to Drizzle using a direct conversion approach optimized for solo development velocity.

## Migration Status (Phase 2B-E In Progress)

**Phase 2A Complete (2025-08-02)**: Drizzle Foundation established with:

- ✅ Complete schema implementation with 1:1 Prisma parity
- ✅ 39 comprehensive tests validating foundation
- ✅ Essential performance indexes for multi-tenancy
- ✅ 3 initial router conversions completed (qrCode, comment, admin)

**Phase 2B-E Current**: Direct conversion of remaining routers using enhanced migration agent

- 🔄 Cleanup of existing routers (remove parallel validation boilerplate)
- 🔄 Direct conversion of 13 remaining routers
- 🎯 Target: 2-3 weeks total vs 7+ weeks with staged approach

## Architecture Overview

### Single ORM Context (Post-Migration)

PinPoint uses Drizzle as the primary ORM with clean, direct implementations:

```typescript
export interface TRPCContext {
  drizzle: DrizzleClient; // Primary database client
  // ... other properties
}
```

### Modular Schema Organization

Drizzle schemas are organized into 5 domain-specific files:

```
src/server/db/schema/
├── auth.ts          # User, Account, Session, VerificationToken
├── organizations.ts # Organization, Membership, Role, Permission
├── machines.ts      # Location, Model, Machine
├── issues.ts        # Issue, IssueStatus, IssueHistory, Comment
├── collections.ts   # Collection, Notification, PinballMapConfig
└── index.ts         # Relations and barrel exports
```

## Guides

- [Schema Patterns](./schema-patterns.md) - Table definitions, relations, migrations, PinPoint-specific patterns
- [Query Patterns](./query-patterns.md) - Common queries, joins, transactions, Drizzle patterns
- [Testing Patterns](./testing-patterns.md) - Mock strategies, CRUD validation, integration testing
- [Direct Conversion Migration](./dual-orm-migration.md) - Direct conversion strategies from Prisma to Drizzle
- [Drizzle + Zod Validation](./drizzle-zod-validation.md) - Input validation with generated schemas

## Key Implementation Decisions

1. **Junction Table Approach**: Maintained Prisma's `_RolePermissions` pattern for exact compatibility
2. **Index Syntax**: All indexes use table callback pattern: `(table) => [index(...)]`
3. **Singleton Pattern**: Development hot-reload optimization in `drizzle.ts`
4. **Type Generation**: Using `$inferSelect` and `$inferInsert` for type safety

## Performance Optimizations

- Multi-tenant indexes on all `organizationId` fields
- QR code scanning optimization with unique index
- Permission system indexes for junction table queries
- Composite indexes for common query patterns

## Known Issues & Workarounds

### pgbouncer Compatibility

- **Issue**: `drizzle-kit push` hangs with connection pooling
- **Cause**: pgbouncer interferes with schema introspection
- **Workaround**: Use direct database connection for schema operations

## Quick Start

```typescript
// Import the Drizzle client
import { drizzle } from "~/server/db/drizzle";
import * as schema from "~/server/db/schema";

// Basic query example
const users = await drizzle
  .select()
  .from(schema.users)
  .where(eq(schema.users.organizationId, orgId));

// Transaction example
await drizzle.transaction(async (tx) => {
  const [user] = await tx.insert(schema.users).values({...}).returning();
  await tx.insert(schema.memberships).values({...});
});
```

For detailed patterns and examples, see the individual guide pages.

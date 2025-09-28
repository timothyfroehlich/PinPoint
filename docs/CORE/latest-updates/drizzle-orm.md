# Drizzle ORM: Latest Updates (Project Policy Note)

Project policy: We do not use migration files in this repository during pre‑beta. Prefer `drizzle-kit push` for schema sync, followed by DB resets and updated seeds/tests. The migration‑related sections below exist for general reference and do not apply to PinPoint’s workflow.

## Key Changes (2024-2025)

### **🚀 2025 Integration Improvements**

**Enhanced PGlite Integration**: Better memory management and query optimization  
**Generated Columns Performance**: Improved database-level computation patterns  
**Real-world Examples**: Production patterns for complex schema management (reference only; PinPoint uses push)

### 🎯 **Critical for Direct Conversion**

**Generated Columns (v0.32.0+)**

- **DO:** Use `.generatedAlwaysAs()` for computed fields instead of application logic
- **DON'T:** Manually calculate derived fields in tRPC procedures
- **Migration Benefit:** Move complex computations to database level
- **Example:** Full-text search vectors, computed slugs, aggregate values

**Enhanced Index API (v0.31.0)**

- **BREAKING:** Old index API removed - `.asc()/.desc()` now per-column
- **DO:** Chain modifiers directly to columns: `.on(table.column.asc())`
- **DON'T:** Apply modifiers to entire index
- **Migration Impact:** Review all index definitions during conversion

**PostgreSQL Extensions Support (v0.31.0+)**

- **DO:** Use native `vector`, `geometry` types instead of raw SQL
- **DON'T:** Use `sql` operator for pg_vector or PostGIS queries
- **Migration Benefit:** Full type safety for AI/geo features

### 🧪 **Testing Improvements**

**In-Memory Testing with PGlite**

- **DO:** Mock database module with PGlite in `vitest.setup.ts`
- **DON'T:** Use external Docker containers for tests
- **Migration Benefit:** Fast, isolated integration tests
- **Setup:** Replace node-postgres with `@electric-sql/pglite` in tests

**Drizzle-Kit Testing (Reference)**

- PinPoint policy: use `drizzle-kit push` (no migration files). The following commands are provided for general Drizzle users and should not be used in this repo.

### ⚡ **Performance & Developer Experience**

**Relational Queries API (`db.query`)**

- **DO:** Use `db.query.users.findMany({ with: { posts: true } })` for joins
- **DON'T:** Write manual SQL joins for related data
- **Migration Benefit:** Replaces Prisma's `include` pattern elegantly

**Validator Integrations (drizzle-zod)**

- **DO:** Generate validation schemas from Drizzle tables
- **DON'T:** Maintain separate Zod schemas
- **Migration Benefit:** Single source of truth for data shapes

**Prisma Migration Tools**

- **DO:** Use `drizzle-prisma-generator` for gradual migration
- **DON'T:** Attempt manual schema translation
- **Migration Benefit:** Automated Prisma → Drizzle schema conversion

## Direct Conversion Workflow

### Phase 1: Schema Foundation

```bash
# Generate Drizzle schema from existing Prisma
npx drizzle-kit pull
# Or use Prisma generator for hybrid approach
prisma generate
```

### Phase 2: Router Conversion

1. **Replace Prisma client calls** with Drizzle equivalents
2. **Use db.query API** for relational data instead of `include`
3. **Leverage generated columns** for computed fields
4. **Update indexes** to new column-specific modifier syntax

### Phase 3: Testing Setup

```bash
# (Reference) Generate migrations for testing — not used in this project
# npx drizzle-kit generate
# Mock with PGlite in vitest.setup.ts
```

## Migration Commands Reference

| Task                     | Command                | Use Case                      |
| ------------------------ | ---------------------- | ----------------------------- |
| **Schema Introspection** | `drizzle-kit pull`     | Import existing DB schema     |
| **Quick Push**           | `drizzle-kit push`     | Direct schema sync            |
| Generate/Apply Migrations| (reference only)       | Not used in this project      |
| **Prisma Integration**   | `prisma generate`      | Generate from Prisma schema   |

## Common Conversion Patterns

### Prisma Include → Drizzle Relational

```typescript
// OLD: Prisma
await prisma.user.findMany({
  include: { posts: true },
});

// NEW: Drizzle
await db.query.users.findMany({
  with: { posts: true },
});
```

### Computed Fields → Generated Columns

```typescript
// OLD: Application logic
const userWithFullName = {
  ...user,
  fullName: `${user.firstName} ${user.lastName}`,
};

// NEW: Database generated column
export const users = pgTable("users", {
  firstName: text("first_name"),
  lastName: text("last_name"),
  fullName: text("full_name").generatedAlwaysAs(
    sql`${users.firstName} || ' ' || ${users.lastName}`,
  ),
});
```

## Testing Strategy

**Vitest + PGlite Setup**

- Replace database driver with in-memory PostgreSQL
- (Reference) Apply migrations automatically in test setup — not used in this project
- Isolate each test with clean schema
- See full examples in [main research document](../tech-stack-research-catchup.md#testing-mocking-strategies)

## Common Gotchas

**Index Definitions**

- ❌ Old: `.index().on(table.column).asc()`
- ✅ New: `.index().on(table.column.asc())`

**Generated Columns Limitations**

- Cannot reference other generated columns
- Cannot use in primary/foreign key constraints
- Schema changes require migration

**Relations Definition**

- Must define both sides of relationship
- Use `relations()` helper for complex joins
- Import all schema files for relational queries

## Next Steps

1. Review current Prisma queries in routers
2. Identify computed fields for generated columns
3. Set up PGlite testing environment
4. Convert routers one-by-one using enhanced migration agent
5. Leverage new index API for performance

_Full examples and migration patterns in [tech-stack-research-catchup.md](../tech-stack-research-catchup.md)_

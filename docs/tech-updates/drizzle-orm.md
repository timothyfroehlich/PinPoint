# Drizzle ORM: Latest Updates for Direct Migration

_Migration-focused updates for Prisma → Drizzle direct conversion_

## Key Changes (2024-2025)

### **🚀 2025 Integration Improvements**

**Enhanced PGlite Integration**: Better memory management and query optimization  
**Generated Columns Performance**: Improved database-level computation patterns  
**Real-world Examples**: Production patterns for complex schema migrations

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

### 🧪 Testing Improvements

**In-Memory Testing with PGlite**

- **DO:** Mock database module with PGlite in `vitest.setup.ts`
- **DON'T:** Use external Docker containers for tests
- **Migration Benefit:** Fast, isolated integration tests
- **Setup:** Replace node-postgres with `@electric-sql/pglite` in tests

**Drizzle-Kit Migration Testing**

- **DO:** Test migrations with `drizzle-kit generate` → apply → verify.
- **DO:** Use `pnpm run db:migrate` for routine local updates.
- **DO:** Use `pnpm run db:reset` ONLY for a fresh start locally (restarts Supabase, wipes data, reapplies all migrations).
- **DON'T:** Skip migration testing in direct conversion.
- **Migration Benefit:** Catch schema issues before production.

### ⚡ Performance & Developer Experience

...

## Migration Commands Reference

PinPoint uses Drizzle migrations as the primary way to evolve the schema.

| Task                     | Command                                   | Use Case                                |
| ------------------------ | ----------------------------------------- | --------------------------------------- |
| **Generate Migrations**  | `pnpm run db:generate -- --name <change>` | Create migration files from `schema.ts` |
| **Apply Migrations**     | `pnpm run db:migrate`                     | Update local/preview/prod schema        |
| **Reset Local DB**       | `pnpm run db:reset`                       | Fresh slate locally (DESTRUCTIVE)       |
| **Schema Introspection** | `drizzle-kit pull`                        | Import existing DB schema               |

**SAFETY**: NEVER use `db:reset` or `drizzle-kit push` on production or preview environments. Always use `db:migrate` to evolve the schema safely.
...
**Generated Columns Limitations**

- Cannot reference other generated columns
- Cannot use in primary/foreign key constraints
- Schema changes require migration via `db:generate` and `db:migrate`

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

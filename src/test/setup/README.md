# Test Database Schema

This directory contains the auto-generated SQL schema for PGlite test databases.

## Schema Generation

The `schema.sql` file is generated from `src/server/db/schema.ts` using `drizzle-kit export`. This ensures:

- ✅ **No schema drift** between tests and production
- ✅ **Single source of truth** (Drizzle schema)
- ✅ **Fresh schema** based on the same schema used to generate Drizzle migrations

## When to Regenerate

Run `pnpm run test:_generate-schema` whenever you modify `src/server/db/schema.ts`:

- Add/remove tables
- Add/remove columns
- Change column types
- Add/remove constraints
- Change foreign keys

## How It Works

1. **drizzle-kit export** reads the Drizzle schema (`src/server/db/schema.ts`)
2. **Generates complete SQL** that creates all tables, columns, and constraints
3. **Saves to** `schema.sql` (not incremental migrations)
4. **PGlite setup** reads this file and applies it to the in-memory database

## Files

- `schema.sql` - Complete database schema (auto-generated, DO commit to git)
- `pglite.ts` - Worker-scoped PGlite instance setup

## Important

- ⚠️ **Do not edit** `schema.sql` manually - it will be overwritten
- ✅ **Do commit** `schema.sql` to git - it is the test database schema
- ✅ **Do regenerate** after schema changes to keep tests in sync
- 🚫 **Do not hand-edit** test schema or create ad-hoc SQL for tests – always regenerate from the Drizzle schema

## Example Workflow

```bash
# 1. Modify the schema
vim src/server/db/schema.ts

# 2. Regenerate test schema
pnpm run test:_generate-schema

# 3. Run tests to verify
pnpm test

# 4. Commit both schema.ts and schema.sql
git add src/server/db/schema.ts src/test/setup/schema.sql
git commit -m "feat: add new column to machines table"
```

## Troubleshooting

**Tests fail with "table does not exist"**

- Run `pnpm run test:_generate-schema` to regenerate schema
- Ensure `schema.sql` exists in this directory

**Schema mismatch between test and production**

- Regenerate: `pnpm run test:_generate-schema`
- The test schema should always match `src/server/db/schema.ts`

## Relationship to Migrations

Production/preview databases are managed via **Drizzle migrations** generated from the same `schema.ts`.  
Tests use `schema.sql` as a fast, deterministic snapshot of that schema for PGlite.

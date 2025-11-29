# Test Database Schema

This directory contains the auto-generated SQL schema for PGlite test databases.

## Schema Generation

The `schema.sql` file is generated from `src/server/db/schema.ts` using `drizzle-kit export`. This ensures:

- ✅ **No schema drift** between tests and production
- ✅ **Single source of truth** (Drizzle schema)
- ✅ **Fresh schema** without migration files (pre-beta, no migrations policy)

## When to Regenerate

Run `npm run test:generate-schema` whenever you modify `src/server/db/schema.ts`:

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
- 🚫 **No migration files** - we use `drizzle-kit export` for fresh schema, not migrations

## Example Workflow

```bash
# 1. Modify the schema
vim src/server/db/schema.ts

# 2. Regenerate test schema
npm run test:generate-schema

# 3. Run tests to verify
npm test

# 4. Commit both schema.ts and schema.sql
git add src/server/db/schema.ts src/test/setup/schema.sql
git commit -m "feat: add new column to machines table"
```

## Troubleshooting

**Tests fail with "table does not exist"**

- Run `npm run test:generate-schema` to regenerate schema
- Ensure `schema.sql` exists in this directory

**Schema mismatch between test and production**

- Regenerate: `npm run test:generate-schema`
- The test schema should always match `src/server/db/schema.ts`

## Why Not Migrations?

Per `docs/NON_NEGOTIABLES.md`, PinPoint is pre-beta with zero users, so we don't use migration files. Schema changes are made directly in `src/server/db/schema.ts` and exported fresh for tests using `drizzle-kit export`.

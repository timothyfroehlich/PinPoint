# Test Database Schema Migrations

This directory contains auto-generated SQL schema files for PGlite test databases.

## Why Auto-Generated?

The SQL in this directory is generated from `src/server/db/schema.ts` using drizzle-kit. This ensures:

- ✅ **No schema drift** between tests and production
- ✅ **Single source of truth** (Drizzle schema)
- ✅ **Automatic sync** when schema changes

## When to Regenerate

Run `npm run test:generate-schema` whenever you modify `src/server/db/schema.ts`:

- Add/remove tables
- Add/remove columns
- Change column types
- Add/remove constraints
- Change foreign keys

## How It Works

1. **drizzle-kit** reads the Drizzle schema (`src/server/db/schema.ts`)
2. **Generates SQL** that creates tables, columns, and constraints
3. **Saves to** `src/test/setup/migrations/XXXX_*.sql`
4. **PGlite setup** reads this file and applies it to the in-memory database

## Files

- `0000_strange_sister_grimm.sql` - Initial schema migration (auto-generated)
- `meta/` - Drizzle-kit metadata (auto-generated)

## Important

- ⚠️ **Do not edit** the SQL files manually - they will be overwritten
- ⚠️ **Do commit** these files to git - they are the test database schema
- ✅ **Do regenerate** after schema changes to keep tests in sync

## Example Workflow

```bash
# 1. Modify the schema
vim src/server/db/schema.ts

# 2. Regenerate test schema
npm run test:generate-schema

# 3. Run tests to verify
npm test

# 4. Commit both schema.ts and the generated SQL
git add src/server/db/schema.ts src/test/setup/migrations/
git commit -m "feat: add new column to machines table"
```

## Troubleshooting

**Tests fail with "table does not exist"**

- Run `npm run test:generate-schema` to regenerate schema
- Ensure the generated SQL file exists in this directory

**Schema mismatch between test and production**

- Regenerate: `npm run test:generate-schema`
- The test schema should always match `src/server/db/schema.ts`

**Drizzle-kit creates multiple migration files**

- That's normal as schema evolves
- Update `src/test/setup/pglite.ts` to reference the latest file
- Or combine migrations into a single file for tests

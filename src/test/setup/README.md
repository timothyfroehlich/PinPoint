# Test Setup

## schema.sql

This file is **auto-generated** and **not in git**.

It's created from `src/server/db/schema.ts` via `drizzle-kit export` and will be generated automatically when you run tests.

If you get errors about missing schema.sql:

```bash
pnpm run test:ensure-schema
```

## Why Not Commit It?

1. **Derived file** - it's generated from schema.ts
2. **Prevents merge conflicts** - schema changes would conflict on every PR
3. **Always fresh** - generated from the current source on demand

## Troubleshooting schema generation

If `pnpm run test:ensure-schema` fails or tests still complain about `schema.sql`:

- **Check that `drizzle-kit` is installed**
  The export step uses `drizzle-kit`. If you see `drizzle-kit: command not found` (or a similar error), ensure dev dependencies are installed:

  ```bash
  pnpm install
  ```

  Then try again:

  ```bash
  pnpm run test:ensure-schema
  ```

- **Read the error output**
  If the command still fails, use the error message from `pnpm run test:ensure-schema` to fix the underlying issue (e.g., syntax errors in `schema.ts`), then re-run the command before running tests.

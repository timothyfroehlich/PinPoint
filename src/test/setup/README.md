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
3. **Always fresh** - can't get out of sync with source

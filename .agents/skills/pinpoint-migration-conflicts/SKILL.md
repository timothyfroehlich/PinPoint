---
name: pinpoint-migration-conflicts
description: Protocol for resolving drizzle/meta conflicts on merge — never edit the meta folder by hand, regenerate instead. Use when a merge or rebase produces conflicts under drizzle/meta or drizzle migration .sql/_snapshot.json files.
---

# PinPoint Migration Conflicts

Never resolve `drizzle/meta` conflicts manually — the folder holds binary-like schema snapshots; manual edits corrupt the `prevId` chain.

## Protocol when meta conflicts on merge

1. Take upstream's `drizzle/meta` (theirs).
2. Delete your migration files (`.sql` + `_snapshot.json`).
3. Resolve `schema.ts` manually.
4. `pnpm db:generate` — Drizzle regenerates a fresh migration.
5. Compare the new SQL to what you deleted; confirm intent preserved.
6. `pnpm db:reset` to verify.

Before merging any migration PR: every new `.sql` has a matching `_snapshot.json`; `pnpm db:generate` reports "No schema changes".

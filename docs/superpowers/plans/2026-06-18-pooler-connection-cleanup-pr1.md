# Pooler / Connection Cleanup — PR1 Implementation Plan (PP-z428 + PP-54eu)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify how PinPoint's one-shot DB scripts connect to Postgres, fix the
pooler terminology everywhere it's wrong, and make the Supabase admin client
tolerate both legacy and new service-key names.

**Architecture:** A single shared helper (`scripts/lib/pg-client.mjs`) owns the
script connection convention — connect over the IPv4 transaction pooler
(`POSTGRES_URL`, `:6543`) with `prepare: false`, never the IPv6 non-pooling
host. Destructive reset scripts stay local-only via `assertLocalDatabase`; seed
scripts stay remote-capable (the preview pipeline runs `seed-users.mjs` against
the branch DB). Docs get one corrected canonical reference. `admin.ts` gains the
service-role→secret fallback that `env.ts`/`seed-users.mjs` already have.

**Tech Stack:** Node ESM scripts (`.mjs`), porsager `postgres`, Drizzle,
Supabase, Vitest, TypeScript (ts-strictest).

## Global Constraints

- **Connect scripts over `POSTGRES_URL` (transaction pooler, `:6543`, IPv4).**
  Never `POSTGRES_URL_NON_POOLING` (IPv6 direct host — unreachable from CI /
  preview / Vercel). Verbatim canonical facts: spec §2.1.
- **`prepare: false`** on every one-shot script porsager client (transaction
  pooler doesn't support prepared statements per Supabase docs; one-shot scripts
  gain nothing from caching).
- **Destructive (DROP/TRUNCATE/DELETE) scripts are local-only** via
  `assertLocalDatabase`. **Seed scripts are remote-capable** — do NOT add a
  local-only guard to `seed-users.mjs` / `seed-discord.mjs`
  (`preview-migrate-seed.sh:83` runs `seed-users.mjs` against the remote branch).
  This **overrides** PP-z428's "add guards to seed-users/seed-discord" wording.
- **ts-strictest:** no `any`, no `!`, no unsafe `as`; path alias `~/` in `src`.
- **`localhost`, never `127.0.0.1`** in new config/examples (CORE-SEC-008).
- **`pnpm run check` before every commit**; `pnpm run preflight` before the PR
  (DB scripts + auth-adjacent `admin.ts`).

---

### Task 1: Shared script connection helper

**Files:**

- Create: `scripts/lib/pg-client.mjs`

**Interfaces:**

- Produces: `resolveScriptDatabaseUrl(): string` (reads `POSTGRES_URL`, exits 1
  if unset) and `createScriptClient(databaseUrl?: string, options?: object):
import("postgres").Sql` (returns `postgres(url, { prepare: false, ...options })`).

- [ ] **Step 1: Create the helper**

```js
// scripts/lib/pg-client.mjs
import postgres from "postgres";

/**
 * Resolve the database URL for one-shot scripts.
 *
 * Scripts connect over the IPv4 transaction pooler exposed as POSTGRES_URL
 * (`…pooler.supabase.com:6543`). We deliberately do NOT fall back to
 * POSTGRES_URL_NON_POOLING: in prod/preview that resolves to an IPv6-only host
 * unreachable from CI/preview/Vercel runners (the cause of ENETUNREACH seed
 * failures). See AGENTS.md §6.
 *
 * @returns {string}
 */
export function resolveScriptDatabaseUrl() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error("❌ POSTGRES_URL is not defined");
    process.exit(1);
  }
  return url;
}

/**
 * Create a porsager client for a one-shot script.
 *
 * `prepare: false` because the transaction pooler (:6543) does not support
 * prepared statements (Supabase docs); one-shot scripts gain nothing from
 * statement caching. Pass `options` to extend (e.g. `{ max: 1 }` for DDL).
 * See AGENTS.md §6.
 *
 * @param {string} [databaseUrl]
 * @param {Record<string, unknown>} [options]
 * @returns {import("postgres").Sql}
 */
export function createScriptClient(
  databaseUrl = resolveScriptDatabaseUrl(),
  options = {}
) {
  return postgres(databaseUrl, { prepare: false, ...options });
}
```

- [ ] **Step 2: Smoke the import**

Run: `node -e "import('./scripts/lib/pg-client.mjs').then(m => console.log(typeof m.resolveScriptDatabaseUrl, typeof m.createScriptClient))"`
Expected: `function function`

- [ ] **Step 3: Lint + commit**

```bash
pnpm run check
git add scripts/lib/pg-client.mjs
git commit -m "feat(scripts): shared pooler-aware DB client helper (PP-z428)"
```

---

### Task 2: Migrate local-only reset scripts to the helper

**Files:**

- Modify: `scripts/force-db-reset.mjs`
- Modify: `scripts/db-fast-reset.mjs`
- Modify: `scripts/reset-to-empty.mjs`

**Interfaces:**

- Consumes: `resolveScriptDatabaseUrl`, `createScriptClient` (Task 1);
  `assertLocalDatabase` (existing `scripts/assert-local-db.mjs`).

These three already `import { assertLocalDatabase }` and call it; only the URL
resolution and the `postgres(...)` construction change.

- [ ] **Step 1: `force-db-reset.mjs`** — replace lines 11–22 and the
      `postgres(databaseUrl)` call at line 50.

Replace the imports + resolution block (current lines 11–22):

```js
import { createScriptClient } from "./lib/pg-client.mjs";
import { resolveScriptDatabaseUrl } from "./lib/pg-client.mjs";
import { assertLocalDatabase } from "./assert-local-db.mjs";

const databaseUrl = resolveScriptDatabaseUrl();
assertLocalDatabase(databaseUrl);
```

Replace `const client = postgres(databaseUrl);` (line 50) with:

```js
const client = createScriptClient(databaseUrl);
```

Remove the now-unused `import postgres from "postgres";`.

- [ ] **Step 2: `db-fast-reset.mjs`** — same transform. Replace lines 1–14
      resolution with:

```js
import { drizzle } from "drizzle-orm/postgres-js";
import { execSync } from "child_process";
import {
  createScriptClient,
  resolveScriptDatabaseUrl,
} from "./lib/pg-client.mjs";
import { assertLocalDatabase } from "./assert-local-db.mjs";

const databaseUrl = resolveScriptDatabaseUrl();
assertLocalDatabase(databaseUrl);
```

Replace `const client = postgres(databaseUrl);` (line 19) with
`const client = createScriptClient(databaseUrl);`. Remove the `postgres` import.

- [ ] **Step 3: `reset-to-empty.mjs`** — same transform. Replace lines 11–22 with:

```js
import {
  createScriptClient,
  resolveScriptDatabaseUrl,
} from "./lib/pg-client.mjs";
import { assertLocalDatabase } from "./assert-local-db.mjs";

const databaseUrl = resolveScriptDatabaseUrl();
assertLocalDatabase(databaseUrl);

const client = createScriptClient(databaseUrl);
```

Remove the `postgres` import and the old `const client = postgres(databaseUrl);`.

- [ ] **Step 4: Verify end-to-end locally**

Ensure the local stack is up (`pnpm run dev:status`; `supabase start` if needed).

Run: `pnpm db:reset`
Expected: completes through `db:_drop_tables` (force-db-reset) + all seeders, exit 0.

Run: `pnpm db:reset-to-empty`
Expected: "Tables truncated…", exit 0.

Run: `pnpm db:fast-reset`
Expected: exit 0 (output suppressed by the script's `> /dev/null`).

- [ ] **Step 5: Lint + commit**

```bash
pnpm run check
git add scripts/force-db-reset.mjs scripts/db-fast-reset.mjs scripts/reset-to-empty.mjs
git commit -m "refactor(scripts): route local reset scripts through pooler helper (PP-z428)"
```

---

### Task 3: Migrate remote-capable seed scripts to the helper

**Files:**

- Modify: `supabase/seed-users.mjs`
- Modify: `supabase/seed-discord.mjs`
- Modify: `supabase/seed-timeline-backfill.mjs`
- Modify: `supabase/seed-timeline-demo.mjs`

**Interfaces:**

- Consumes: `createScriptClient`, `resolveScriptDatabaseUrl` (Task 1);
  `assertLocalDatabase` (for the demo seed only).

Import path from `supabase/` is `../scripts/lib/pg-client.mjs`. **No local-only
guard on `seed-users`/`seed-discord`** (remote-capable — see Global Constraints).

- [ ] **Step 1: `seed-users.mjs`** — keep the Admin-API key fallback (lines
      22–23) untouched. Replace line 24 + line 43:

Line 24 `const POSTGRES_URL = process.env.POSTGRES_URL;` → keep the env read for
the presence check, but build the client via the helper. Replace line 43
`const sql = postgres(POSTGRES_URL);` with:

```js
import { createScriptClient } from "../scripts/lib/pg-client.mjs";
// …
const sql = createScriptClient(POSTGRES_URL);
```

Remove the direct `import postgres from "postgres";` (line 16).

- [ ] **Step 2: `seed-discord.mjs`** — replace `const sql = postgres(POSTGRES_URL);`
      (line 40) with `const sql = createScriptClient(POSTGRES_URL);`, add
      `import { createScriptClient } from "../scripts/lib/pg-client.mjs";`, remove the
      `postgres` import.

- [ ] **Step 3: `seed-timeline-backfill.mjs`** — replace the resolution block
      (lines 35–43) and keep the `ALLOW_NONLOCAL_BACKFILL` guard (lines 49–59):

```js
import {
  createScriptClient,
  resolveScriptDatabaseUrl,
} from "../scripts/lib/pg-client.mjs";

const databaseUrl = resolveScriptDatabaseUrl();
```

Then locate the `const sql = postgres(databaseUrl);` construction later in the
file and replace it with `const sql = createScriptClient(databaseUrl);`. Remove
the `import postgres from "postgres";`.

- [ ] **Step 4: `seed-timeline-demo.mjs`** — replace the resolution block
      (lines 19–27) AND upgrade the inline localhost check (lines 29–38) to the
      shared guard (adds `::1`):

```js
import {
  createScriptClient,
  resolveScriptDatabaseUrl,
} from "../scripts/lib/pg-client.mjs";
import { assertLocalDatabase } from "../scripts/assert-local-db.mjs";

const databaseUrl = resolveScriptDatabaseUrl();
assertLocalDatabase(databaseUrl);
```

Delete the old inline `{ const url = new URL(...) … }` guard block. Replace
`const sql = postgres(databaseUrl);` (line 41) with
`const sql = createScriptClient(databaseUrl);`. Remove the `postgres` import.

- [ ] **Step 5: Verify locally** — `pnpm db:reset` runs all four seeders against
      the local DB.

Run: `pnpm db:reset`
Expected: `db:_seed-users`, `db:_seed-discord`, `db:_seed-timeline-backfill`,
`db:_seed-timeline-demo` all succeed, exit 0.

- [ ] **Step 6: Lint + commit**

```bash
pnpm run check
git add supabase/seed-users.mjs supabase/seed-discord.mjs supabase/seed-timeline-backfill.mjs supabase/seed-timeline-demo.mjs
git commit -m "refactor(seed): route seed scripts through pooler helper, prepare:false (PP-z428)"
```

---

### Task 4: Preview reset script — helper + terminology fix

**Files:**

- Modify: `scripts/reset-preview-db.mjs`

- [ ] **Step 1: Fix the wrong comment (line 3)** — `POSTGRES_URL` is the
      **transaction** pooler, not "session pooler":

```js
// Use POSTGRES_URL (transaction pooler, :6543, IPv4) — NOT POSTGRES_URL_NON_POOLING
// (the IPv6 direct host, unreachable from CI/preview runners). See AGENTS.md §6.
```

- [ ] **Step 2: Use the helper** — replace line 27
      `const client = postgres(databaseUrl, { max: 1 });` with:

```js
const client = createScriptClient(databaseUrl, { max: 1 });
```

Add `import { createScriptClient } from "./lib/pg-client.mjs";`, remove the
`import postgres from "postgres";`. Keep the `PROD_PROJECT_REF` guard (lines
11–22) and the `resolveScriptDatabaseUrl` presence check is redundant here —
keep the existing inline `POSTGRES_URL` read + guard (it has the prod-ref check),
just swap the client construction.

- [ ] **Step 3: Lint + commit**

```bash
pnpm run check
git add scripts/reset-preview-db.mjs
git commit -m "refactor(scripts): preview reset via pooler helper + fix terminology (PP-z428)"
```

---

### Task 5: Delete dead `db-reset-preview.sh`

**Files:**

- Delete: `scripts/db-reset-preview.sh`

- [ ] **Step 1: Confirm no references**

Run: `rg -n "db-reset-preview" --glob '!docs/superpowers/**'`
Expected: no matches (besides this plan).

- [ ] **Step 2: Remove + commit**

```bash
git rm scripts/db-reset-preview.sh
pnpm run check
git commit -m "chore(scripts): remove dead db-reset-preview.sh (orphan prod ref, unguarded) (PP-z428)"
```

---

### Task 6: Harden `seed-from-backup.sh` local guard

**Files:**

- Modify: `scripts/seed-from-backup.sh` (guard at lines 67–75)

The current guard `[[ ! "$POSTGRES_URL" =~ (localhost|127\.0\.0\.1) ]]` matches
the substring anywhere (a remote host like `notlocalhost.example` or a password
containing `localhost` would pass). Extract the host and compare exactly.

- [ ] **Step 1: Replace the guard** (lines 67–75) with a host-parsed check:

```bash
# Safety check: ensure POSTGRES_URL points at a local loopback host. Parse the
# host out of the URL rather than substring-matching (a remote host or password
# containing "localhost" must not pass).
db_host=$(printf '%s' "$POSTGRES_URL" | sed -E 's#^[a-zA-Z]+://[^@]*@?([^:/?]+).*#\1#')
case "$db_host" in
  localhost|127.0.0.1|::1) ;;
  *)
    echo -e "${RED}❌ POSTGRES_URL host is not local: ${db_host}${NC}"
    echo -e "${RED}   Refusing to reset non-local database.${NC}"
    exit 1
    ;;
esac
echo -e "${GREEN}✓ Verified POSTGRES_URL points to local database (${db_host})${NC}"
```

- [ ] **Step 2: Verify shellcheck + manual refusal**

Run: `pnpm run check` (includes shellcheck)
Expected: pass.

Run: `POSTGRES_URL='postgres://u:p@db.example.supabase.co:6543/postgres' bash -c 'source scripts/seed-from-backup.sh' 2>&1 | head -3 || true`
Expected: prints "host is not local: db.example.supabase.co" and refuses.
(If sourcing is awkward because of arg parsing, instead eyeball the host-parse
line with a sample URL via `sed`.)

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-from-backup.sh
git commit -m "fix(scripts): host-parse local guard in seed-from-backup.sh (PP-z428)"
```

---

### Task 7: Terminology + canonical reference (AGENTS.md, .env.example)

**Files:**

- Modify: `AGENTS.md` (§6 connection line ~198–199)
- Modify: `.env.example` (lines 17–21)

- [ ] **Step 1: Fix AGENTS.md §6 connection line.** Replace the current line
      (`use POSTGRES_URL (port :6543, session pooler, IPv4). POSTGRES_URL_NON_POOLING
(:5432) is IPv6 and often unreachable.`) with:

```markdown
- **Connection**: app + scripts use `POSTGRES_URL` — the Supavisor **transaction**
  pooler (`…pooler.supabase.com:6543`, IPv4). `POSTGRES_URL_NON_POOLING` is the
  **direct** connection (`db.<ref>.supabase.co:5432`, IPv6 unless the IPv4 add-on
  is on) and is unreachable from CI/preview/Vercel — use it only for migrations,
  and only when it points at the IPv4 **session** pooler (`…pooler.supabase.com:5432`).
```

- [ ] **Step 2: Add the canonical reference table** to AGENTS.md §6, copied from
      the spec §2.1 (the four-row endpoint table + the two corrections: `:6543`
      disables prepared statements per docs / app keeps them as a tested exception;
      the shared pooler is already IPv4 and the IPv4 add-on is a separate paid thing
      for the direct connection). Source: `docs/superpowers/specs/2026-06-18-pooler-connection-cleanup-design.md` §2.

- [ ] **Step 3: Fix `.env.example` lines 18–21.**

```bash
# - POSTGRES_URL: Supavisor transaction pooler (port 6543, IPv4) - app runtime + scripts
# - POSTGRES_URL_NON_POOLING: IPv4 session pooler (port 5432) - Drizzle Kit migrations
POSTGRES_URL=postgres://postgres.xxxx:password@aws-0-region.pooler.supabase.com:6543/postgres
POSTGRES_URL_NON_POOLING=postgres://postgres.xxxx:password@aws-0-region.pooler.supabase.com:5432/postgres
```

(Note the fixed host on the NON_POOLING line: `…pooler.supabase.com`, previously
the malformed `aws-0-region.supabase.com`.)

- [ ] **Step 4: Lint + commit**

```bash
pnpm run check
git add AGENTS.md .env.example
git commit -m "docs: correct pooler terminology + add canonical connection reference (PP-z428)"
```

---

### Task 8: PP-54eu — admin client service-role→secret fallback

**Files:**

- Modify: `src/lib/supabase/admin.ts:21,25`
- Create: `src/lib/supabase/admin.test.ts`

**Interfaces:**

- `createAdminClient()` must accept `SUPABASE_SECRET_KEY` when
  `SUPABASE_SERVICE_ROLE_KEY` is unset (prod injects the new name; the legacy one
  is empty — see spec §2.3).

- [ ] **Step 1: Write the failing test** (`src/lib/supabase/admin.test.ts`)

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const createClient = vi.fn(() => ({}) as unknown);
vi.mock("@supabase/supabase-js", () => ({ createClient }));

const ENV_KEYS = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
] as const;

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const k of ENV_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(values)) process.env[k] = v;
}

afterEach(() => {
  setEnv({});
  createClient.mockClear();
});

describe("createAdminClient", () => {
  it("uses SUPABASE_SERVICE_ROLE_KEY when set", async () => {
    setEnv({
      SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "legacy",
    });
    const { createAdminClient } = await import("./admin");
    createAdminClient();
    expect(createClient).toHaveBeenCalledWith(
      "https://x.supabase.co",
      "legacy",
      expect.anything()
    );
  });

  it("falls back to SUPABASE_SECRET_KEY when service-role unset", async () => {
    setEnv({
      SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret_new",
    });
    const { createAdminClient } = await import("./admin");
    createAdminClient();
    expect(createClient).toHaveBeenCalledWith(
      "https://x.supabase.co",
      "sb_secret_new",
      expect.anything()
    );
  });

  it("throws when neither key is set", async () => {
    setEnv({ SUPABASE_URL: "https://x.supabase.co" });
    const { createAdminClient } = await import("./admin");
    expect(() => createAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
```

- [ ] **Step 2: Run it, expect failure** (fallback test fails — secret not read yet)

Run: `pnpm vitest run src/lib/supabase/admin.test.ts`
Expected: the "falls back to SUPABASE_SECRET_KEY" case FAILS (createClient called with `undefined`).

- [ ] **Step 3: Apply the fallback** — `src/lib/supabase/admin.ts`

Line 21:

```ts
const serviceRoleKey =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
  process.env["SUPABASE_SECRET_KEY"];
```

Line 24–26 message:

```ts
throw new Error(
  "Missing Supabase admin env vars: set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)."
);
```

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm vitest run src/lib/supabase/admin.test.ts`
Expected: all 3 pass.

- [ ] **Step 5: Lint + commit**

```bash
pnpm run check
git add src/lib/supabase/admin.ts src/lib/supabase/admin.test.ts
git commit -m "fix(supabase): admin client falls back to SUPABASE_SECRET_KEY (PP-54eu)"
```

---

### Task 9: Final verification + open PR

- [ ] **Step 1: Full preflight** (DB scripts + auth-adjacent change)

Run: `pnpm run preflight`
Expected: check + build + integration all pass.

- [ ] **Step 2: Sync + push**

```bash
git fetch origin && git merge origin/main   # merge, never rebase
git push -u origin fix/pooler-connection-cleanup-PP-z428
```

- [ ] **Step 3: Open the PR ready-for-review** (`gh pr create`), body referencing
      PP-z428 + PP-54eu and the spec.

- [ ] **Step 4: `/preview` smoke** — comment `/preview` on the PR; confirm the
      preview pipeline migrates + runs `seed-users.mjs` (remote `:6543`,
      `prepare:false`) green. This is the real test of the remote seed path.

- [ ] **Step 5: Watch CI green**, then this PR is ready to land (beads close on
      merge per landing-the-plane).

---

## Self-Review

**Spec coverage:** §5.1 terminology → Task 7; §5.1 canonical table → Task 7;
§5.2 helper → Task 1; §5.2 script migration → Tasks 2–4; §5.3 guards → Task 6 +
the corrected rule in Tasks 2–3; §5.4 dead-script → Task 5; §5.5 PP-54eu → Task
8; §5.6 verification → Tasks 2/3 + Task 9. **Deviation logged:** spec §5.3's
"guard seed-users/seed-discord" is overridden (they're remote-capable; Global
Constraints + Task 3).

**Placeholder scan:** none — every edit has exact code. One locate-and-replace
in Task 3 Step 3 (the backfill `postgres(databaseUrl)` line) is explicit about
the before/after strings.

**Type/name consistency:** `resolveScriptDatabaseUrl` / `createScriptClient`
used identically in Tasks 1–4; `createAdminClient` signature unchanged in Task 8.

## Out of scope (PR2, separate plan)

`migrate-production.ts` / `mark-migration-applied.ts` hardening (PP-xhqt);
`drizzle.config.ts` migration behavior (its comment may be lightly refined in
Task 7 if touched, but its NON_POOLING-first logic is migration-correct and stays).

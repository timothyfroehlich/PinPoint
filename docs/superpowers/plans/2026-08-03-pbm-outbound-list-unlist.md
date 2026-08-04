# PinballMap Outbound List/Unlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Bead:** PP-o355.30 (P1). Blocked by PP-o355.20 (PR #1810) — do not start until that merges.

**Goal:** Let an admin list a matched machine onto PinballMap's lineup and remove it again, from PinPoint, using a stored per-operator credential.

**Architecture:** Three layers, each already half-built. The PinballMap client seam (`client-live.ts`) already implements `addMachine` / `removeMachine`; `pinballmap_state` already has `outbound_email` + `outbound_token_vault_id`; the permission matrix already has `machines.pinballmap.push`; the timeline event already accepts `action: "listed" | "unlisted"`. This plan builds only the middle: a Vault-backed credentials accessor mirroring the Discord one, and two server actions that sequence Vault-read → PBM-write → DB-transaction in that order.

**Tech Stack:** Next.js 15 Server Actions, Drizzle (Postgres), Supabase Vault via a `SECURITY DEFINER` RPC, Vitest + PGlite for integration tests.

## Global Constraints

- **CORE-ARCH-011 — no side effects inside DB transactions.** Each action performs TWO non-transactional effects: the Vault decrypt RPC and the PBM HTTP call. Both run BEFORE `db.transaction`. A runtime tripwire throws `SideEffectInTransactionError` if violated.
- **CORE-PBM-001 — never reach pinballmap.com from tests.** Mock at the client seam (`~/lib/pinballmap/client`), the way `src/test/integration/pinballmap-link-capture.test.ts` does.
- **CORE-ARCH-008 — permissions via `checkPermission()`** from `~/lib/permissions/helpers`. These actions gate on `machines.pinballmap.push`.
- **CORE-ARCH-009 — Drizzle migrations only.** `pnpm run db:generate` then `pnpm run db:migrate`. Never `drizzle-kit push`.
- **CORE-ARCH-012 — honest failure.** A PBM rejection must surface as a real error. Never write our DB when the PBM call failed.
- **CORE-TS-007 — ts-strictest.** No `any`, no `!` (now lint-enforced in `src/`), no unsafe `as`.
- **CORE-SEC-009** — no new production-required env var unless PinPoint is broken without it. The operator credential lives in Vault + the DB, not the build registry.
- **Agents must not handle the credential value.** Task 4 writes the seed script; Tim runs it with the real token.
- Run `pnpm run check` before each commit (static gate, ~9s). `pnpm run test` for unit, `pnpm exec vitest run --project integration --max-workers=2` for integration. `pnpm run preflight` before the final commit — this touches a migration and server actions.

---

## File Structure

| File                                                              | Responsibility                                                                                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `drizzle/<n>_*.sql` (generated)                                   | `get_pinballmap_credentials()` RPC — joins `pinballmap_state` to `vault.decrypted_secrets`, `SECURITY DEFINER`, service_role only.         |
| `src/lib/pinballmap/credentials.ts` (create)                      | Server-only accessor returning `PbmCredentials                                                                                             | null`. Owns the `assertNotInTransaction` guard and the admin-client round-trip. |
| `src/lib/pinballmap/credentials.test.ts` (create)                 | Unit tests for the accessor's null/populated branches with the Supabase admin client mocked.                                               |
| `src/lib/pinballmap/snapshot-edit.ts` (create)                    | Pure helpers that add/remove one lmx row in a stored `LocationSnapshot`. No DB, no `server-only`, so both actions and unit tests use them. |
| `src/lib/pinballmap/snapshot-edit.test.ts` (create)               | Unit tests for those two helpers.                                                                                                          |
| `src/app/(app)/m/pinballmap-actions.ts` (modify)                  | `listMachineOnPinballMapAction`, `unlistMachineFromPinballMapAction`, and the generalised `authorizeListingAction` preamble.               |
| `src/test/integration/pinballmap-outbound-write.test.ts` (create) | Integration coverage for both actions against the mock client + PGlite.                                                                    |
| `supabase/seed-pinballmap-creds.mjs` (create)                     | One-shot provisioning of the operator email + Vault token, mirroring `seed-discord.mjs`.                                                   |
| `docs/ENV_VARS.md` (modify)                                       | §4.2 entry for the two seed-time env vars.                                                                                                 |

---

## Task 1: Vault-backed credentials accessor

**Files:**

- Create: `drizzle/<generated>.sql` (via `db:generate` — the custom SQL goes in a hand-written migration, see Step 2)
- Create: `src/lib/pinballmap/credentials.ts`
- Test: `src/lib/pinballmap/credentials.test.ts`

**Interfaces:**

- Consumes: `PbmCredentials` from `~/lib/pinballmap/types` — `{ email: string; token: string }`.
- Produces: `getPinballMapWriteCredentials(): Promise<PbmCredentials | null>` from `~/lib/pinballmap/credentials`. Returns `null` when the integration has no operator credential provisioned. Tasks 2 and 3 both call it.

- [ ] **Step 1: Write the failing test**

Create `src/lib/pinballmap/credentials.test.ts`:

```ts
/**
 * Unit tests: PinballMap operator-credential accessor (PP-o355.30).
 *
 * The Vault decrypt happens in a SECURITY DEFINER RPC, so the only thing worth
 * testing here is the branch logic around it: a half-provisioned row (email but
 * no token, or the reverse) must read as "not provisioned" rather than yielding
 * a credential the PBM client would send with an empty field.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("~/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));

vi.mock("~/server/db/transaction-context", () => ({
  assertNotInTransaction: vi.fn(),
}));

describe("getPinballMapWriteCredentials", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("returns the decrypted credential when both halves are present", async () => {
    rpc.mockResolvedValue({
      data: [{ outbound_email: "ops@example.com", outbound_token: "tok_123" }],
      error: null,
    });
    const { getPinballMapWriteCredentials } = await import("./credentials");

    expect(await getPinballMapWriteCredentials()).toEqual({
      email: "ops@example.com",
      token: "tok_123",
    });
  });

  it("returns null when no credential has been provisioned", async () => {
    rpc.mockResolvedValue({
      data: [{ outbound_email: null, outbound_token: null }],
      error: null,
    });
    const { getPinballMapWriteCredentials } = await import("./credentials");

    expect(await getPinballMapWriteCredentials()).toBeNull();
  });

  it("returns null when only one half is provisioned", async () => {
    // A half-filled row is a misconfiguration, not a usable credential: PBM
    // would reject the write and we would report the failure as if the operator
    // token were wrong. Refuse before the HTTP call instead.
    rpc.mockResolvedValue({
      data: [{ outbound_email: "ops@example.com", outbound_token: null }],
      error: null,
    });
    const { getPinballMapWriteCredentials } = await import("./credentials");

    expect(await getPinballMapWriteCredentials()).toBeNull();
  });

  it("throws when the RPC itself fails", async () => {
    // Distinct from "not provisioned": a broken Vault round-trip must not be
    // reported to the user as "set up your PinballMap credentials".
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { getPinballMapWriteCredentials } = await import("./credentials");

    await expect(getPinballMapWriteCredentials()).rejects.toThrow(/boom/);
  });

  it("refuses to run inside a transaction", async () => {
    const { assertNotInTransaction } =
      await import("~/server/db/transaction-context");
    rpc.mockResolvedValue({ data: [], error: null });
    const { getPinballMapWriteCredentials } = await import("./credentials");

    await getPinballMapWriteCredentials();

    expect(assertNotInTransaction).toHaveBeenCalledWith(
      "getPinballMapWriteCredentials"
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/pinballmap/credentials.test.ts`
Expected: FAIL — `Cannot find module './credentials'`.

- [ ] **Step 3: Write the migration**

`db:generate` only emits DDL it can infer from the Drizzle schema, and this migration is a hand-written function. Generate an empty migration and fill it in:

```bash
pnpm run db:generate --name pinballmap_credentials_rpc
```

Open the newly created `drizzle/<n>_pinballmap_credentials_rpc.sql` (it will be empty or near-empty — the schema is unchanged) and write:

```sql
CREATE OR REPLACE FUNCTION public.get_pinballmap_credentials()
RETURNS TABLE (
  outbound_email text,
  outbound_token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.outbound_email,
    v.decrypted_secret::text AS outbound_token
  FROM pinballmap_state s
  LEFT JOIN vault.decrypted_secrets v ON v.id = s.outbound_token_vault_id
  WHERE s.id = 'singleton';
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.get_pinballmap_credentials() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.get_pinballmap_credentials() FROM anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.get_pinballmap_credentials() TO service_role;--> statement-breakpoint

COMMENT ON FUNCTION public.get_pinballmap_credentials() IS
  'Returns the PinballMap per-operator write credentials with the token decrypted from Supabase Vault. SECURITY DEFINER — only service_role can EXECUTE. Do NOT expose via PostgREST; call via createAdminClient() in server code only.';
```

This mirrors `get_discord_config()` in `drizzle/0028_natural_vengeance.sql` — same `SECURITY DEFINER` + `search_path` + REVOKE/GRANT shape. Do not deviate from it.

- [ ] **Step 4: Apply the migration**

Run: `pnpm run db:migrate`
Expected: the new migration applies with no error. If Supabase is not running, start it first with `supabase start` from this worktree.

- [ ] **Step 5: Write the accessor**

Create `src/lib/pinballmap/credentials.ts`:

```ts
import "server-only";
import { createAdminClient } from "~/lib/supabase/admin";
import { assertNotInTransaction } from "~/server/db/transaction-context";
import type { PbmCredentials } from "./types";

/**
 * The per-operator PinballMap write credentials, with the token decrypted from
 * Supabase Vault (PP-o355.30).
 *
 * Distinct from the blanket `PINBALLMAP_API_TOKEN` env var, which is a platform
 * capability issued to PinPoint-the-application and gates ACCESS to the v1 API.
 * These identify WHO is writing, and PinballMap attributes the edit to them.
 * See the `pinballmap_state` schema comment for the full split.
 *
 * Returns `null` when no credential is provisioned — including when only one
 * half is set. A half-filled row is a misconfiguration, and sending it would
 * make PBM reject the write, which we would then report as a bad token.
 *
 * SECURITY: server-only. Uses the service-role client and returns secret
 * material; the `server-only` import above is what stops a client component
 * importing it.
 */
interface PinballMapCredentialsRow {
  outbound_email: string | null;
  outbound_token: string | null;
}

export async function getPinballMapWriteCredentials(): Promise<PbmCredentials | null> {
  // CORE-ARCH-011: the Vault decrypt RPC is an external round-trip and must run
  // before a transaction opens, never inside one (the Doodle Bug, PP-2053).
  assertNotInTransaction("getPinballMapWriteCredentials");

  const supabase = createAdminClient();
  // `get_pinballmap_credentials` is defined in a hand-written migration and is
  // absent from Supabase's generated types; cast to the shape the SQL returns.
  const response = (await supabase.rpc("get_pinballmap_credentials")) as {
    data: PinballMapCredentialsRow[] | null;
    error: { message: string } | null;
  };

  if (response.error) {
    throw new Error(
      `Failed to load PinballMap credentials: ${response.error.message}`
    );
  }

  const row = response.data?.[0];
  if (!row?.outbound_email || !row.outbound_token) return null;
  return { email: row.outbound_email, token: row.outbound_token };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/pinballmap/credentials.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Verify the RPC is not reachable without service_role**

The REVOKE lines are the security boundary; confirm they took. Run against the local DB:

```bash
psql "$(grep -m1 '^POSTGRES_URL=' .env.local | cut -d= -f2- | tr -d '"')" \
  -c "SELECT has_function_privilege('authenticated', 'public.get_pinballmap_credentials()', 'EXECUTE');"
```

Expected: `f`. If it returns `t`, the REVOKE statements did not apply — fix the migration before continuing.

- [ ] **Step 8: Commit**

```bash
pnpm run check
git add drizzle/ src/lib/pinballmap/credentials.ts src/lib/pinballmap/credentials.test.ts
git commit -m "feat(pinballmap): Vault-backed operator write credentials (PP-o355.30)"
```

---

## Task 2: Stored-snapshot edit helpers

**Files:**

- Create: `src/lib/pinballmap/snapshot-edit.ts`
- Test: `src/lib/pinballmap/snapshot-edit.test.ts`

**Interfaces:**

- Consumes: `LocationSnapshot` and `LocationSnapshotLmx` from `~/lib/pinballmap/types`.
- Produces:
  - `withLmxAdded(snapshot: LocationSnapshot, lmxId: number, pinballmapMachineId: number): LocationSnapshot`
  - `withLmxRemoved(snapshot: LocationSnapshot, lmxId: number): LocationSnapshot`

  Both return a NEW snapshot and never mutate the input. Tasks 3 and 4 write the result back to `pinballmap_state.snapshot_json` inside their transaction.

**Why this task exists — read before implementing.** The stored snapshot is not just a cache of PBM's lineup; it is the input to `resolveAutoLinkForMachine` (PP-o355.20), which runs on every machine save and re-lists a matched cabinet whose title appears on the lineup. If an unlist writes `pinballmapListed = false` but leaves the title sitting in the stored snapshot, the next "Save details" on that machine — any time in the following hour, before the cron refreshes — silently re-lists it. Editing the stored snapshot in the same transaction is what closes that window. We know the exact lmx we added or deleted, so this needs no PBM call.

- [ ] **Step 1: Write the failing test**

Create `src/lib/pinballmap/snapshot-edit.test.ts`:

```ts
/**
 * Unit tests: stored-snapshot edits after an outbound write (PP-o355.30).
 *
 * These keep the stored lineup consistent with a list/unlist we just performed,
 * so auto-link (PP-o355.20) does not act on a snapshot we know is stale. See the
 * module docstring for why that matters.
 */

import { describe, it, expect } from "vitest";
import { withLmxAdded, withLmxRemoved } from "./snapshot-edit";
import type { LocationSnapshot } from "./types";

const snapshot = (
  rows: { id: number; machineId: number }[]
): LocationSnapshot => ({
  locationId: 26454,
  name: "APC",
  dateLastUpdated: null,
  lastUpdatedByUsername: null,
  machineCount: rows.length,
  lmxes: rows.map((r) => ({
    ...r,
    icEnabled: null,
    lastUpdatedByUsername: null,
    conditions: [],
  })),
  fetchedAtIso: "2026-08-03T00:00:00Z",
  raw: {},
});

describe("withLmxAdded", () => {
  it("appends the new row and keeps machineCount consistent", () => {
    const result = withLmxAdded(snapshot([{ id: 1, machineId: 10 }]), 2, 20);

    expect(result.lmxes).toHaveLength(2);
    expect(result.lmxes[1]).toEqual({
      id: 2,
      machineId: 20,
      icEnabled: null,
      lastUpdatedByUsername: null,
      conditions: [],
    });
    expect(result.machineCount).toBe(2);
  });

  it("does not duplicate a row PBM's find-or-create returned", () => {
    // `addMachine` is find-or-create: re-listing a title already on the lineup
    // returns the EXISTING lmx. Appending blindly would put the same id in
    // twice, and `findLmxForMachine` would then depend on array order.
    const result = withLmxAdded(snapshot([{ id: 1, machineId: 10 }]), 1, 10);

    expect(result.lmxes).toHaveLength(1);
    expect(result.machineCount).toBe(1);
  });

  it("does not mutate the input", () => {
    const input = snapshot([{ id: 1, machineId: 10 }]);
    withLmxAdded(input, 2, 20);

    expect(input.lmxes).toHaveLength(1);
  });
});

describe("withLmxRemoved", () => {
  it("drops the row and keeps machineCount consistent", () => {
    const result = withLmxRemoved(
      snapshot([
        { id: 1, machineId: 10 },
        { id: 2, machineId: 20 },
      ]),
      1
    );

    expect(result.lmxes).toEqual([
      expect.objectContaining({ id: 2, machineId: 20 }),
    ]);
    expect(result.machineCount).toBe(1);
  });

  it("is a no-op when the lmx is already absent", () => {
    const result = withLmxRemoved(snapshot([{ id: 1, machineId: 10 }]), 99);

    expect(result.lmxes).toHaveLength(1);
    expect(result.machineCount).toBe(1);
  });

  it("does not mutate the input", () => {
    const input = snapshot([{ id: 1, machineId: 10 }]);
    withLmxRemoved(input, 1);

    expect(input.lmxes).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/pinballmap/snapshot-edit.test.ts`
Expected: FAIL — `Cannot find module './snapshot-edit'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/pinballmap/snapshot-edit.ts`:

```ts
import type { LocationSnapshot } from "./types";

/**
 * Keep the stored location snapshot consistent with an outbound write we just
 * performed (PP-o355.30).
 *
 * **Why this is not premature.** The stored snapshot is the input to
 * `resolveAutoLinkForMachine` (PP-o355.20), which runs on every machine save.
 * An unlist that clears `pinballmapListed` but leaves the title in the stored
 * lineup is re-listed by the next save on that machine — silently, any time
 * before the hourly cron refreshes the snapshot. We know exactly which lmx we
 * added or deleted, so correcting the snapshot costs no PBM call and closes
 * that window.
 *
 * Pure and non-mutating: no DB, no `server-only`, so the actions and their unit
 * tests both call these directly.
 */

/**
 * The snapshot with `lmxId` present for `pinballmapMachineId`.
 *
 * A no-op when that lmx is already listed — PinballMap's create is
 * find-or-create, so re-listing a title already on the lineup hands back the
 * EXISTING lmx rather than minting a second one.
 */
export function withLmxAdded(
  snapshot: LocationSnapshot,
  lmxId: number,
  pinballmapMachineId: number
): LocationSnapshot {
  if (snapshot.lmxes.some((l) => l.id === lmxId)) return snapshot;
  const lmxes = [
    ...snapshot.lmxes,
    {
      id: lmxId,
      machineId: pinballmapMachineId,
      icEnabled: null,
      lastUpdatedByUsername: null,
      conditions: [],
    },
  ];
  return { ...snapshot, lmxes, machineCount: lmxes.length };
}

/** The snapshot with `lmxId` absent. A no-op when it is already gone. */
export function withLmxRemoved(
  snapshot: LocationSnapshot,
  lmxId: number
): LocationSnapshot {
  const lmxes = snapshot.lmxes.filter((l) => l.id !== lmxId);
  return { ...snapshot, lmxes, machineCount: lmxes.length };
}
```

If `LocationSnapshot["lmxes"]` element type does not match the object literal above, read `src/lib/pinballmap/types.ts` and match its fields exactly — do not add a cast.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/pinballmap/snapshot-edit.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
pnpm run check
git add src/lib/pinballmap/snapshot-edit.ts src/lib/pinballmap/snapshot-edit.test.ts
git commit -m "feat(pinballmap): stored-snapshot edit helpers for outbound writes (PP-o355.30)"
```

---

## Task 3: List action

**Files:**

- Modify: `src/app/(app)/m/pinballmap-actions.ts` (generalise `authorizeListingRead` at ~line 137; add the new action after `linkPinballmapEntryAction`)
- Test: `src/test/integration/pinballmap-outbound-write.test.ts` (create)

**Interfaces:**

- Consumes: `getPinballMapWriteCredentials()` (Task 1), `withLmxAdded()` (Task 2), `getPinballMapClient()` from `~/lib/pinballmap/client`, `PbmAddMachineResult` from `~/lib/pinballmap/types`.
- Produces:
  - `authorizeListingAction(formData: FormData, permission: "machines.pinballmap.link" | "machines.pinballmap.push")` — the renamed, parameterised preamble. Task 4 calls it with `"machines.pinballmap.push"`.
  - `ListPinballmapResult = Result<{ lmxId: number }, "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "NOT_PROVISIONED" | "PBM_REJECTED" | "SERVER">`
  - `listMachineOnPinballMapAction(prev, formData)` — form-action shaped.

- [ ] **Step 1: Generalise the authorization preamble**

`authorizeListingRead` hardcodes `"machines.pinballmap.link"`. The write actions need `"machines.pinballmap.push"`, and copying the 45-line preamble to vary one string is the duplication Tim's Rule-of-Three caveat says to collapse at two when the shared thing is load-bearing — and a permission gate is load-bearing.

In `src/app/(app)/m/pinballmap-actions.ts`, rename `authorizeListingRead` to `authorizeListingAction` and give it a second parameter. Change the signature from:

```ts
async function authorizeListingRead(
  formData: FormData
): Promise<
```

to:

```ts
async function authorizeListingAction(
  formData: FormData,
  permission: "machines.pinballmap.link" | "machines.pinballmap.push"
): Promise<
```

and change the `checkPermission` call inside it from `"machines.pinballmap.link"` to `permission`. Update its docstring to say the caller chooses the gate: `.link` for the read-side capture actions, `.push` for the outbound writes.

Update both existing call sites (`linkPinballmapEntryAction` and `verifyPinballmapLinkAction`) to pass `"machines.pinballmap.link"`.

- [ ] **Step 2: Verify nothing broke**

Run: `pnpm run typecheck && pnpm exec vitest run --project integration --max-workers=2 src/test/integration/pinballmap-link-capture.test.ts`
Expected: typecheck clean; the existing link/verify permission tests still pass. This is a pure rename — if any assertion changed, revert and re-read.

- [ ] **Step 3: Commit the refactor separately**

```bash
pnpm run check
git add "src/app/(app)/m/pinballmap-actions.ts"
git commit -m "refactor(pinballmap): parameterise the listing-action permission gate (PP-o355.30)"
```

- [ ] **Step 4: Write the failing test**

Create `src/test/integration/pinballmap-outbound-write.test.ts`:

```ts
/**
 * Integration Test: PinballMap outbound list/unlist (PP-o355.30)
 *
 * The write half of the listing controls: `listMachineOnPinballMapAction` adds
 * the machine to PinballMap's lineup and captures the lmx it mints;
 * `unlistMachineFromPinballMapAction` deletes that lmx and clears our columns.
 *
 * The PinballMap client is pinned at the seam (CORE-TEST-006) — never reaches
 * pinballmap.com. Credentials are stubbed at `~/lib/pinballmap/credentials`
 * rather than seeded into Vault: Vault is Supabase's, not ours, and PGlite has
 * no `vault` schema to decrypt from.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  machines,
  userProfiles,
  authUsers,
  timelineEvents,
  pinballmapState,
} from "~/server/db/schema";
import type { LocationSnapshot } from "~/lib/pinballmap/types";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("~/lib/logger", () => ({
  log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("~/lib/pinballmap/credentials", () => ({
  getPinballMapWriteCredentials: vi.fn(),
}));

// Controllable PBM write seam. `lineup` is what PBM currently shows; the
// add/remove verbs mutate it exactly as the real mock client does, so the
// assertions describe PinballMap's state, not a call-count.
const pbm = vi.hoisted(() => ({
  lineup: [] as { id: number; machineId: number }[],
  nextLmxId: 500,
  addResult: null as { ok: false; reason: string; message?: string } | null,
  removeResult: null as { ok: false; reason: string; message?: string } | null,
}));

vi.mock("~/lib/pinballmap/client", () => ({
  getPinballMapClient: () =>
    Promise.resolve({
      addMachine: ({ machineId }: { machineId: number }) => {
        if (pbm.addResult) return Promise.resolve(pbm.addResult);
        const existing = pbm.lineup.find((l) => l.machineId === machineId);
        if (existing) return Promise.resolve({ ok: true, lmxId: existing.id });
        const id = pbm.nextLmxId;
        pbm.nextLmxId += 1;
        pbm.lineup.push({ id, machineId });
        return Promise.resolve({ ok: true, lmxId: id });
      },
      removeMachine: ({ lmxId }: { lmxId: number }) => {
        if (pbm.removeResult) return Promise.resolve(pbm.removeResult);
        const idx = pbm.lineup.findIndex((l) => l.id === lmxId);
        if (idx === -1) {
          return Promise.resolve({ ok: false, reason: "not_found" });
        }
        pbm.lineup.splice(idx, 1);
        return Promise.resolve({ ok: true });
      },
    }),
}));

const TITLE_ID = 7;

const snapshotOf = (
  rows: { id: number; machineId: number }[]
): LocationSnapshot => ({
  locationId: 26454,
  name: "APC",
  dateLastUpdated: null,
  lastUpdatedByUsername: null,
  machineCount: rows.length,
  lmxes: rows.map((r) => ({
    ...r,
    icEnabled: null,
    lastUpdatedByUsername: null,
    conditions: [],
  })),
  fetchedAtIso: "2026-08-03T00:00:00Z",
  raw: {},
});

async function createUser(role: "admin" | "member"): Promise<{ id: string }> {
  const db = await getTestDb();
  const id = randomUUID();
  await db.insert(authUsers).values({ id, email: `${id}@example.com` });
  const [user] = await db
    .insert(userProfiles)
    .values({
      id,
      email: `${id}@example.com`,
      firstName: "Test",
      lastName: "User",
      role,
    })
    .returning();
  return user;
}

async function mockAuthAs(userId: string): Promise<void> {
  const { createClient } = await import("~/lib/supabase/server");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

async function seedState(
  rows: { id: number; machineId: number }[]
): Promise<void> {
  const db = await getTestDb();
  await db.insert(pinballmapState).values({
    id: "singleton",
    locationId: 26454,
    enabled: true,
    snapshotJson: snapshotOf(rows),
    lastSyncStatus: "ok",
  });
}

function form(machineId: string): FormData {
  const fd = new FormData();
  fd.append("machineId", machineId);
  return fd;
}

describe("PinballMap outbound writes (PGlite)", () => {
  setupTestDb();

  beforeEach(async () => {
    pbm.lineup = [];
    pbm.nextLmxId = 500;
    pbm.addResult = null;
    pbm.removeResult = null;
    const { getPinballMapWriteCredentials } =
      await import("~/lib/pinballmap/credentials");
    vi.mocked(getPinballMapWriteCredentials).mockResolvedValue({
      email: "ops@example.com",
      token: "tok_123",
    });
  });

  it("lists a matched machine and captures the lmx PinballMap mints", async () => {
    const db = await getTestDb();
    const { listMachineOnPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedState([]);

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: TITLE_ID,
      })
      .returning();

    const result = await listMachineOnPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(true);
    // PinballMap now shows it — the assertion that matters, not a call count.
    expect(pbm.lineup).toEqual([{ id: 500, machineId: TITLE_ID }]);

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapListed).toBe(true);
    expect(row?.pinballmapLmxId).toBe(500);

    const events = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(events).toHaveLength(1);
    expect(events[0]?.eventData).toEqual({
      kind: "pinballmap_listing",
      action: "listed",
      lmxId: 500,
    });
    expect(events[0]?.authorId).toBe(admin.id);
  });

  it("adds the new lmx to the stored snapshot", async () => {
    // Otherwise the machine reads as `listed_locally_absent_on_pbm` — a desync
    // alert for a listing we just created — until the next hourly sync.
    const db = await getTestDb();
    const { listMachineOnPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedState([]);

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: TITLE_ID,
      })
      .returning();

    await listMachineOnPinballMapAction(undefined, form(machine.id));

    const state = await db.query.pinballmapState.findFirst();
    expect(state?.snapshotJson?.lmxes).toEqual([
      expect.objectContaining({ id: 500, machineId: TITLE_ID }),
    ]);
  });

  it("writes nothing to our DB when PinballMap rejects the add", async () => {
    // CORE-ARCH-012: a control that could not perform its action must not
    // report that it did.
    const db = await getTestDb();
    const { listMachineOnPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedState([]);
    pbm.addResult = {
      ok: false,
      reason: "rejected",
      message: "Failed to find machine",
    };

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: TITLE_ID,
      })
      .returning();

    const result = await listMachineOnPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PBM_REJECTED");

    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(row?.pinballmapListed).toBe(false);
    expect(row?.pinballmapLmxId).toBeNull();
    const events = await db.select().from(timelineEvents);
    expect(events).toHaveLength(0);
  });

  it("refuses without an operator credential, before calling PinballMap", async () => {
    const db = await getTestDb();
    const { getPinballMapWriteCredentials } =
      await import("~/lib/pinballmap/credentials");
    vi.mocked(getPinballMapWriteCredentials).mockResolvedValue(null);
    const { listMachineOnPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    await seedState([]);

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: TITLE_ID,
      })
      .returning();

    const result = await listMachineOnPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_PROVISIONED");
    expect(pbm.lineup).toEqual([]);
  });

  it("refuses a member without the push permission", async () => {
    const db = await getTestDb();
    const { listMachineOnPinballMapAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const member = await createUser("member");
    await mockAuthAs(member.id);
    await seedState([]);

    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: TITLE_ID,
      })
      .returning();

    const result = await listMachineOnPinballMapAction(
      undefined,
      form(machine.id)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNAUTHORIZED");
    expect(pbm.lineup).toEqual([]);
  });
});
```

If the `machines.pinballmap.push` matrix entry grants a plain `member` the permission, change the negative test's role to whichever role the matrix denies — read `src/lib/permissions/matrix.ts:408` and match it. Do not weaken the assertion to make it pass.

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm exec vitest run --project integration --max-workers=2 src/test/integration/pinballmap-outbound-write.test.ts`
Expected: FAIL — `listMachineOnPinballMapAction` is not exported.

- [ ] **Step 6: Write the action**

In `src/app/(app)/m/pinballmap-actions.ts`, add the imports:

```ts
import { getPinballMapWriteCredentials } from "~/lib/pinballmap/credentials";
import { withLmxAdded, withLmxRemoved } from "~/lib/pinballmap/snapshot-edit";
import { getPinballMapClient } from "~/lib/pinballmap/client";
```

(`getPinballMapClient` may already be imported — check before adding a duplicate.)

Then add, after `linkPinballmapEntryAction`:

```ts
export type ListPinballmapResult = Result<
  { lmxId: number },
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "NOT_PROVISIONED"
  | "PBM_REJECTED"
  | "SERVER"
>;

/**
 * Add a matched machine to PinballMap's lineup for our location and capture the
 * lmx PBM mints (PP-o355.30). The genuine outbound write — distinct from
 * `linkPinballmapEntryAction`, which only captures a handle for an entry PBM
 * already shows.
 *
 * Gated on `machines.pinballmap.push` (CORE-ARCH-008).
 *
 * **Ordering is a hard requirement, not a style choice** (CORE-ARCH-011). Two
 * non-transactional effects run first — decrypting the operator credential and
 * the PBM HTTP call — and only their results enter the transaction. A tripwire
 * throws `SideEffectInTransactionError` if either is moved inside it.
 *
 * On a PBM rejection nothing is written locally: a listing we could not create
 * must not be reported as created (CORE-ARCH-012).
 */
export async function listMachineOnPinballMapAction(
  _prev: ListPinballmapResult | undefined,
  formData: FormData
): Promise<ListPinballmapResult> {
  const authed = await authorizeListingAction(
    formData,
    "machines.pinballmap.push"
  );
  if (!authed.ok) return authed.result;
  const { userId, machine } = authed;
  const titleId = machine.pinballmapMachineId;
  if (titleId === null)
    return err("VALIDATION", "Machine isn't linked to a PinballMap title yet");

  // Idempotent: a machine already holding a listing has nothing to add.
  if (machine.pinballmapListed && machine.pinballmapLmxId !== null)
    return ok({ lmxId: machine.pinballmapLmxId });

  const state = await getPinballMapState();
  if (!state) return err("SERVER", "Pinball Map isn't configured yet");

  // --- non-transactional effects, both BEFORE the transaction ---
  const credentials = await getPinballMapWriteCredentials();
  if (!credentials)
    return err(
      "NOT_PROVISIONED",
      "No Pinball Map operator account is set up yet, so PinPoint can't write to Pinball Map."
    );

  const client = await getPinballMapClient();
  const written = await client.addMachine({
    credentials,
    locationId: state.locationId,
    machineId: titleId,
  });
  if (!written.ok) {
    log.error(
      { reason: written.reason, action: "pinballmap.addMachine" },
      "PinballMap add rejected"
    );
    return err("PBM_REJECTED", pbmWriteFailureMessage(written));
  }
  const lmxId = written.lmxId;
  // --- transaction: local state only ---

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(machines)
        .set({ pinballmapLmxId: lmxId, pinballmapListed: true })
        .where(eq(machines.id, machine.id));
      if (state.snapshotJson) {
        await tx
          .update(pinballmapState)
          .set({
            snapshotJson: withLmxAdded(state.snapshotJson, lmxId, titleId),
          })
          .where(eq(pinballmapState.id, "singleton"));
      }
      await createMachineTimelineEvent(
        machine.id,
        {
          sourceType: "lifecycle",
          tag: "lifecycle",
          eventData: { kind: "pinballmap_listing", action: "listed", lmxId },
          actorId: userId,
        },
        tx
      );
    });
  } catch (error) {
    // One lister per title at our location. PBM's find-or-create already handed
    // us the shared lmx, so the honest report is that another cabinet holds it.
    if (isPgErrorCode(error, "23505")) {
      return err(
        "VALIDATION",
        await pbmListingConflictMessage(titleId, machine.id)
      );
    }
    throw error;
  }

  revalidatePath(`/m/${machine.initials}`);
  return ok({ lmxId });
}
```

Add the failure-message helper above the action (both write actions use it):

```ts
/** Human-facing text for a PBM write failure, by reason. */
function pbmWriteFailureMessage(failure: PbmWriteFailure): string {
  switch (failure.reason) {
    case "rate_limited":
      return "Pinball Map is rate-limiting us. Try again in a few minutes.";
    case "unauthorized":
      return "Pinball Map rejected our operator account. An admin needs to re-provision it.";
    case "not_found":
      return "Pinball Map couldn't find that entry. It may already be gone.";
    case "rejected":
      return failure.message ?? "Pinball Map rejected the change.";
    case "transient":
      return "Pinball Map didn't respond properly. Try again.";
  }
}
```

Import `PbmWriteFailure` from `~/lib/pinballmap/types` and `pinballmapState` from `~/server/db/schema` if they are not already imported.

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm exec vitest run --project integration --max-workers=2 src/test/integration/pinballmap-outbound-write.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 8: Commit**

```bash
pnpm run check
git add "src/app/(app)/m/pinballmap-actions.ts" src/test/integration/pinballmap-outbound-write.test.ts
git commit -m "feat(pinballmap): list a matched machine onto the lineup (PP-o355.30)"
```

---

## Task 4: Unlist action, and proving auto-link cannot undo it

**Files:**

- Modify: `src/app/(app)/m/pinballmap-actions.ts`
- Test: `src/test/integration/pinballmap-outbound-write.test.ts` (extend)

**Interfaces:**

- Consumes: everything Task 3 produced, plus `withLmxRemoved()` (Task 2) and `reconcileAfterSync()` from `~/lib/pinballmap/sync`.
- Produces: `unlistMachineFromPinballMapAction(prev, formData): Promise<UnlistPinballmapResult>` where `UnlistPinballmapResult = Result<Record<string, never>, "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "NOT_PROVISIONED" | "PBM_REJECTED" | "SERVER">`.

**The test in Step 4 is the point of this whole bead.** Auto-link (PP-o355.20) re-lists any matched, unlisted cabinet whose title is on the stored lineup. If unlist does not also drop the lmx from the stored snapshot, the next reconcile pass or machine save silently re-lists it, and the button appears to do nothing. Write that test and watch it fail before wiring the snapshot edit.

- [ ] **Step 1: Write the failing tests**

Append to `src/test/integration/pinballmap-outbound-write.test.ts`, inside the existing `describe`:

```ts
it("unlists a listed machine and clears our columns", async () => {
  const db = await getTestDb();
  const { unlistMachineFromPinballMapAction } =
    await import("~/app/(app)/m/pinballmap-actions");
  const admin = await createUser("admin");
  await mockAuthAs(admin.id);
  pbm.lineup = [{ id: 500, machineId: TITLE_ID }];
  await seedState([{ id: 500, machineId: TITLE_ID }]);

  const [machine] = await db
    .insert(machines)
    .values({
      name: "Godzilla",
      initials: "GZ",
      pinballmapMachineId: TITLE_ID,
      pinballmapListed: true,
      pinballmapLmxId: 500,
    })
    .returning();

  const result = await unlistMachineFromPinballMapAction(
    undefined,
    form(machine.id)
  );

  expect(result.ok).toBe(true);
  expect(pbm.lineup).toEqual([]);

  const row = await db.query.machines.findFirst({
    where: eq(machines.id, machine.id),
  });
  expect(row?.pinballmapListed).toBe(false);
  expect(row?.pinballmapLmxId).toBeNull();

  const events = await db
    .select()
    .from(timelineEvents)
    .where(eq(timelineEvents.machineId, machine.id));
  expect(events).toHaveLength(1);
  expect(events[0]?.eventData).toEqual({
    kind: "pinballmap_listing",
    action: "unlisted",
    lmxId: 500,
  });
});

it("survives the next reconcile pass — auto-link does not undo it", async () => {
  // THE regression this bead exists to prevent. Auto-link (PP-o355.20)
  // re-lists any matched, unlisted cabinet whose title is on the STORED
  // lineup. If unlist leaves the lmx in the stored snapshot, the very next
  // reconcile pass — or any machine save inside the hour — puts the listing
  // back, and the Unlist button reads as broken.
  const db = await getTestDb();
  const { unlistMachineFromPinballMapAction } =
    await import("~/app/(app)/m/pinballmap-actions");
  const { reconcileAfterSync } = await import("~/lib/pinballmap/sync");
  const admin = await createUser("admin");
  await mockAuthAs(admin.id);
  pbm.lineup = [{ id: 500, machineId: TITLE_ID }];
  await seedState([{ id: 500, machineId: TITLE_ID }]);

  const [machine] = await db
    .insert(machines)
    .values({
      name: "Godzilla",
      initials: "GZ",
      pinballmapMachineId: TITLE_ID,
      pinballmapListed: true,
      pinballmapLmxId: 500,
    })
    .returning();

  await unlistMachineFromPinballMapAction(undefined, form(machine.id));
  const reconciled = await reconcileAfterSync();

  expect(reconciled.linked).toBe(0);
  const row = await db.query.machines.findFirst({
    where: eq(machines.id, machine.id),
  });
  expect(row?.pinballmapListed).toBe(false);
  expect(row?.pinballmapLmxId).toBeNull();
});

it("writes nothing locally when PinballMap rejects the removal", async () => {
  const db = await getTestDb();
  const { unlistMachineFromPinballMapAction } =
    await import("~/app/(app)/m/pinballmap-actions");
  const admin = await createUser("admin");
  await mockAuthAs(admin.id);
  await seedState([{ id: 500, machineId: TITLE_ID }]);
  pbm.removeResult = { ok: false, reason: "unauthorized" };

  const [machine] = await db
    .insert(machines)
    .values({
      name: "Godzilla",
      initials: "GZ",
      pinballmapMachineId: TITLE_ID,
      pinballmapListed: true,
      pinballmapLmxId: 500,
    })
    .returning();

  const result = await unlistMachineFromPinballMapAction(
    undefined,
    form(machine.id)
  );

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.code).toBe("PBM_REJECTED");

  const row = await db.query.machines.findFirst({
    where: eq(machines.id, machine.id),
  });
  // Still listed — we did not manage to remove it from Pinball Map.
  expect(row?.pinballmapListed).toBe(true);
  expect(row?.pinballmapLmxId).toBe(500);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project integration --max-workers=2 src/test/integration/pinballmap-outbound-write.test.ts`
Expected: FAIL — `unlistMachineFromPinballMapAction` is not exported.

- [ ] **Step 3: Write the action**

In `src/app/(app)/m/pinballmap-actions.ts`, after `listMachineOnPinballMapAction`:

```ts
export type UnlistPinballmapResult = Result<
  Record<string, never>,
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "NOT_PROVISIONED"
  | "PBM_REJECTED"
  | "SERVER"
>;

/**
 * Remove a machine from PinballMap's lineup for our location and clear our
 * listing columns (PP-o355.30).
 *
 * Gated on `machines.pinballmap.push` (CORE-ARCH-008). Same ordering rule as
 * the list action: credential decrypt and PBM call before the transaction
 * (CORE-ARCH-011).
 *
 * **The stored-snapshot edit is not bookkeeping — it is the correctness of this
 * action.** Auto-link (PP-o355.20) re-lists any matched, unlisted cabinet whose
 * title appears on the stored lineup. Clearing our columns while leaving the
 * lmx in the snapshot means the next reconcile pass, or any save on this machine
 * inside the hour, silently re-lists it. Dropping the row we just deleted is
 * what makes an unlist stick.
 */
export async function unlistMachineFromPinballMapAction(
  _prev: UnlistPinballmapResult | undefined,
  formData: FormData
): Promise<UnlistPinballmapResult> {
  const authed = await authorizeListingAction(
    formData,
    "machines.pinballmap.push"
  );
  if (!authed.ok) return authed.result;
  const { userId, machine } = authed;

  const lmxId = machine.pinballmapLmxId;
  if (!machine.pinballmapListed || lmxId === null)
    return err("VALIDATION", "This machine isn't listed on Pinball Map.");

  const state = await getPinballMapState();
  if (!state) return err("SERVER", "Pinball Map isn't configured yet");

  // --- non-transactional effects, both BEFORE the transaction ---
  const credentials = await getPinballMapWriteCredentials();
  if (!credentials)
    return err(
      "NOT_PROVISIONED",
      "No Pinball Map operator account is set up yet, so PinPoint can't write to Pinball Map."
    );

  const client = await getPinballMapClient();
  const written = await client.removeMachine({ credentials, lmxId });
  if (!written.ok) {
    log.error(
      { reason: written.reason, action: "pinballmap.removeMachine" },
      "PinballMap remove rejected"
    );
    return err("PBM_REJECTED", pbmWriteFailureMessage(written));
  }
  // --- transaction: local state only ---

  await db.transaction(async (tx) => {
    await tx
      .update(machines)
      .set({ pinballmapListed: false, pinballmapLmxId: null })
      .where(eq(machines.id, machine.id));
    if (state.snapshotJson) {
      await tx
        .update(pinballmapState)
        .set({ snapshotJson: withLmxRemoved(state.snapshotJson, lmxId) })
        .where(eq(pinballmapState.id, "singleton"));
    }
    await createMachineTimelineEvent(
      machine.id,
      {
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: { kind: "pinballmap_listing", action: "unlisted", lmxId },
        actorId: userId,
      },
      tx
    );
  });

  revalidatePath(`/m/${machine.initials}`);
  return ok({});
}
```

No 23505 catch here: this write only CLEARS `pinballmapListed`, and a row leaving the partial unique index cannot violate it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project integration --max-workers=2 src/test/integration/pinballmap-outbound-write.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Red-check the snapshot edit**

The auto-link survival test is the reason this bead exists; prove it actually catches the regression rather than passing for an unrelated reason. Temporarily neuter the snapshot edit in `unlistMachineFromPinballMapAction` — change `if (state.snapshotJson) {` to `if (false && state.snapshotJson) {` — and re-run:

Run: `pnpm exec vitest run --project integration --max-workers=2 src/test/integration/pinballmap-outbound-write.test.ts`
Expected: exactly one FAIL — "survives the next reconcile pass". If it passes, the test is not exercising what its name claims; fix the test before restoring.

Restore the line, re-run, confirm 8 pass.

- [ ] **Step 6: Commit**

```bash
pnpm run check
git add "src/app/(app)/m/pinballmap-actions.ts" src/test/integration/pinballmap-outbound-write.test.ts
git commit -m "feat(pinballmap): unlist a machine from the lineup (PP-o355.30)"
```

---

## Task 5: Operator-credential provisioning

**Files:**

- Create: `supabase/seed-pinballmap-creds.mjs`
- Modify: `docs/ENV_VARS.md` (§4.2)

**Interfaces:**

- Consumes: nothing from earlier tasks at runtime. Populates `pinballmap_state.outbound_email` and `outbound_token_vault_id`, which Task 1's RPC reads.
- Produces: no code interface. A `node supabase/seed-pinballmap-creds.mjs` entry point.

**Do not put a real credential anywhere in this task.** The script reads env vars; Tim supplies the values and runs it. An agent must not obtain, paste, echo, or commit a PinballMap operator token.

- [ ] **Step 1: Read the model**

Read `supabase/seed-discord.mjs` in full before writing anything. It is the same job: env var → `vault.create_secret()` → store the returned UUID on a singleton config row, idempotent, refusing to overwrite an existing secret. Match its structure, its guard conditions, and its logging style.

- [ ] **Step 2: Write the script**

Create `supabase/seed-pinballmap-creds.mjs`, mirroring `seed-discord.mjs`, with these differences:

- Env vars read: `PINBALLMAP_OUTBOUND_EMAIL` and `PINBALLMAP_OUTBOUND_TOKEN`. If either is unset, log a skip and exit 0 — the same "not configured is not an error" posture the Discord seed takes.
- Target row: `pinballmap_state WHERE id = 'singleton'`.
- Guard: only write when `outbound_token_vault_id IS NULL`, so a re-run never clobbers a provisioned credential. Log clearly when it skips for that reason.
- Vault secret name: `pinballmap_outbound_token`, description `PinballMap per-operator write token (PP-o355.30)`.
- After `vault.create_secret()` returns the UUID, update the row's `outbound_email` and `outbound_token_vault_id` in one statement, conditioned on `outbound_token_vault_id IS NULL`. If that UPDATE affects 0 rows (a concurrent seed won), delete the orphaned secret — `seed-discord.mjs` does exactly this; copy its cleanup.
- Never `console.log` the token. Log its length at most.

- [ ] **Step 3: Verify the skip path**

With neither env var set:

Run: `node supabase/seed-pinballmap-creds.mjs`
Expected: exit 0, a message that PinballMap outbound credentials are not configured, and no DB change. Confirm with:

```bash
psql "$(grep -m1 '^POSTGRES_URL=' .env.local | cut -d= -f2- | tr -d '"')" \
  -c "SELECT outbound_email, outbound_token_vault_id FROM pinballmap_state WHERE id='singleton';"
```

Expected: both NULL.

- [ ] **Step 4: Verify the happy path with a throwaway value**

A local-only dummy is fine here — it is not a real credential and never leaves the dev DB.

```bash
PINBALLMAP_OUTBOUND_EMAIL=dev@example.com \
PINBALLMAP_OUTBOUND_TOKEN=dev-not-a-real-token \
node supabase/seed-pinballmap-creds.mjs
```

Expected: reports the secret was created. Then confirm the RPC from Task 1 reads it back:

```bash
psql "$(grep -m1 '^POSTGRES_URL=' .env.local | cut -d= -f2- | tr -d '"')" \
  -c "SELECT outbound_email, outbound_token FROM public.get_pinballmap_credentials();"
```

Expected: `dev@example.com | dev-not-a-real-token`. This is the end-to-end proof that the migration, the Vault write, and the accessor's SQL all agree.

- [ ] **Step 5: Verify the re-run guard**

Run the same command from Step 4 again with a DIFFERENT dummy token.
Expected: it skips, reporting the credential is already provisioned. Re-run the `get_pinballmap_credentials()` query and confirm the ORIGINAL token is still there.

- [ ] **Step 6: Document the env vars**

Add both to `docs/ENV_VARS.md` §4.2 (optional-surface config, NOT the `next.config.ts` build registry — PinPoint is not broken without them; the outbound actions degrade to `NOT_PROVISIONED`, which is CORE-SEC-009's stated test). Record for each: name, that it is seed-time only and never read at runtime, and that the token lands in Vault while the email is a plain column.

- [ ] **Step 7: Full preflight and commit**

This branch carries a migration and new server actions, so run the full gate, not just `check`:

```bash
pnpm run preflight
git add supabase/seed-pinballmap-creds.mjs docs/ENV_VARS.md
git commit -m "feat(pinballmap): seed the operator write credential into Vault (PP-o355.30)"
```

---

## Handoff notes (not implementation steps)

- **The plan file itself** lives in the scratchpad while PR #1810 is in review. Move it to `docs/superpowers/plans/2026-08-03-pbm-outbound-list-unlist.md` in the `.30` worktree and commit it with Task 1.
- **No UI in this bead.** Nothing renders these actions; PP-o355.21 wires them into the six-state listing control. That is deliberate — `.30` is a complete, testable backend slice, and `.21` is the complete UI slice on top of it.
- **Production provisioning is Tim's.** Before `.21` ships, a real PinballMap operator account's email + token must be seeded into prod's Vault. An agent must not handle those values.
- **Update the bead on landing**: `bd update PP-o355.30 --notes` with the PR number and the migration number. Read the existing notes first — `--notes` is a full replace with no merge.

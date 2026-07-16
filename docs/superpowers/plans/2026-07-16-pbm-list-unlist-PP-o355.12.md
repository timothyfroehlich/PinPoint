# PBM List / Unlist — Connect, Capture, Maintain (PP-o355.12) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give PinPoint a durable, self-healing link to each machine's PinballMap listing — capture it (link an existing PBM entry, or list a new one), use it (unlist), and maintain it (detect a broken link and reconnect) — replacing the disabled "List on PinballMap" checkbox with a state-aware "Connect to PinballMap" control.

**Architecture:** A machine linked to a PBM catalog title is in one of four listing states — **not listed** / **on-PBM-but-unlinked** / **listed+linked** / **link-broken**. The read operations (link, verify, reconnect) only _read_ PBM's public lineup (anonymous, no token) and are permitted for owner/tech/admin via `machines.pinballmap.link`. The write operations (list, unlist) mutate PBM via the seeded operator token and are admin-only via a new `machines.pinballmap.push`. Stale detection is reactive (a write returning `not_found` marks the link broken) plus an on-demand "Verify" (one lineup read); continuous background badging is out of scope (that's PP-o355.11). **Land the read side first** (Tasks 1–6): it needs no operator token and independently unblocks the backfill (PP-h059) and comment-sync (PP-o355.4).

**Tech Stack:** Next.js server actions (`useActionState` + `Result`), Drizzle/Postgres, Supabase Vault (operator token), the PinballMap client seam (`getPinballMapClient()`), PGlite+Vitest integration tests, RTL for the form.

## Global Constraints

- **Depends on PP-o355.16** (foundation) being merged: consumes `pinballmapState` (table), `machines.pinballmapLmxId` (column + CHECKs + partial-unique), `getPinballMapState()` and `syncLocationSnapshot()` from `src/lib/pinballmap/sync.ts`. Do NOT recreate these; if the branch predates the foundation merge, `git merge origin/main` first.
- **No side effects inside DB transactions** (CORE-ARCH-011): every PBM HTTP call (`fetchLocation`, `addMachine`, `removeMachine`) and every Vault RPC (`vault.create_secret`/`update_secret`/`delete_secret`, decrypt RPC) runs OUTSIDE `db.transaction`. Fetch/mutate first, persist after. A runtime tripwire throws `SideEffectInTransactionError` if violated.
- **Permissions through the matrix** (CORE-ARCH-008): all checks via `checkPermission()` from `~/lib/permissions/helpers`. Read ops → `machines.pinballmap.link` (exists). Write ops → `machines.pinballmap.push` (new, admin-only).
- **Supabase SSR** (CORE-SSR-001/002): every action does `createClient()` → `auth.getUser()` immediately, no logic between.
- **Test what we own / never reach pinballmap.com** (CORE-PBM-001, CORE-TEST-006): integration tests pin the client to the mock (`vi.mock("~/lib/pinballmap/client", () => ({ getPinballMapClient: () => getMockClient() }))`); Vault SQL doesn't exist in PGlite, so assert on the `db.execute` SQL text (mirror `src/test/integration/admin/discord-integration-actions.test.ts:17-19`), don't execute the RPC.
- **Type safety** (CORE-TS-007) + **path aliases** (`~/…`). **Progressive enhancement** (CORE-ARCH-002): `<form action={serverAction}>`, no inline handlers.
- **Run `pnpm run preflight` before pushing** (migration-adjacent + server actions + auth).

---

## Read side (no operator token) — Tasks 1–6

### Task 1: Permission — add `machines.pinballmap.push` (admin-only)

**Files:**

- Modify: `src/lib/permissions/matrix.ts` (after the `machines.pinballmap.link` entry, ~`:381-393`)
- Modify: `src/test/unit/permissions-matrix.test.ts` (add an assertion block for the new id)

**Interfaces:**

- Produces: permission id `"machines.pinballmap.push"`. Consumed by Tasks 6–7 (write actions).

- [ ] **Step 1: Write the failing matrix test.** In `permissions-matrix.test.ts`, add:

```ts
it("machines.pinballmap.push is admin-only (write via operator token)", () => {
  const entry = matrix.find((e) => e.id === "machines.pinballmap.push");
  expect(entry).toBeDefined();
  expect(entry?.access).toEqual({
    unauthenticated: false,
    guest: false,
    member: false,
    technician: false,
    admin: true,
  });
});
```

- [ ] **Step 2: Run it, verify it fails.** Run: `FORCE_MEM_PRECHECK=skip pnpm exec vitest run src/test/unit/permissions-matrix.test.ts` → FAIL (entry undefined).

- [ ] **Step 3: Add the entry** to `matrix.ts` immediately after `machines.pinballmap.link`:

```ts
{
  id: "machines.pinballmap.push",
  label: "Push listing changes to PinballMap",
  description:
    "List or unlist a machine on PinballMap.com using the shared operator account",
  access: { unauthenticated: false, guest: false, member: false, technician: false, admin: true },
},
```

- [ ] **Step 4: Run test, verify PASS.** Same command → PASS. (The help page auto-generates from the matrix — no extra wiring.)

- [ ] **Step 5: Commit.**

```bash
git add src/lib/permissions/matrix.ts src/test/unit/permissions-matrix.test.ts
git commit -m "feat(permissions): add machines.pinballmap.push (admin-only) (PP-o355.12)"
```

---

### Task 2: Snapshot-based lmx resolution helper (read-only, pure)

**Files:**

- Create: `src/lib/pinballmap/resolve-lmx.ts`
- Test: `src/lib/pinballmap/resolve-lmx.test.ts`

**Interfaces:**

- Consumes: `LocationSnapshot`, `PbmLmx` from `./types`.
- Produces:
  - `findLmxForMachine(snapshot: LocationSnapshot, pinballmapMachineId: number): PbmLmx | null` — the lineup row whose `machineId` matches (1:1 per finding #1; returns the single match or null).
  - `type LmxResolution = { status: "found"; lmx: PbmLmx } | { status: "absent" }` — absent = the title isn't in the lineup (not listed, or link is broken).

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, it, expect } from "vitest";
import { findLmxForMachine } from "./resolve-lmx";
import type { LocationSnapshot } from "./types";

const snap = (
  lmxes: { id: number; machineId: number }[]
): LocationSnapshot => ({
  locationId: 26454,
  name: "APC",
  dateLastUpdated: null,
  lastUpdatedByUsername: null,
  machineCount: lmxes.length,
  lmxes: lmxes.map((l) => ({
    ...l,
    icEnabled: null,
    lastUpdatedByUsername: null,
    conditions: [],
  })),
  fetchedAtIso: "2026-07-16T00:00:00Z",
  raw: {},
});

describe("findLmxForMachine", () => {
  it("returns the lmx whose machineId matches the linked title", () => {
    const lmx = findLmxForMachine(snap([{ id: 900, machineId: 42 }]), 42);
    expect(lmx?.id).toBe(900);
  });
  it("returns null when the title is not in the lineup", () => {
    expect(
      findLmxForMachine(snap([{ id: 900, machineId: 42 }]), 99)
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify FAIL** (module missing). Run: `FORCE_MEM_PRECHECK=skip pnpm exec vitest run src/lib/pinballmap/resolve-lmx.test.ts`.

- [ ] **Step 3: Implement `resolve-lmx.ts`.**

```ts
import type { LocationSnapshot, PbmLmx } from "./types";

/**
 * Find the location_machine_xref for a linked catalog title in a snapshot.
 * PBM create is find-or-create on (location, machine_id), so at our single
 * location a title maps to at most one non-deleted lmx (PbmApiAudit finding #1).
 */
export function findLmxForMachine(
  snapshot: LocationSnapshot,
  pinballmapMachineId: number
): PbmLmx | null {
  return (
    snapshot.lmxes.find((l) => l.machineId === pinballmapMachineId) ?? null
  );
}

export type LmxResolution =
  { status: "found"; lmx: PbmLmx } | { status: "absent" };
```

- [ ] **Step 4: Run, verify PASS.** Same command → PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/pinballmap/resolve-lmx.ts src/lib/pinballmap/resolve-lmx.test.ts
git commit -m "feat(pinballmap): snapshot lmx resolution helper (PP-o355.12)"
```

---

### Task 3: Timeline event kind for PBM listing changes

**Files:**

- Modify: `src/lib/timeline/machine-event-types.ts` (add a variant to `MachineTimelineEventData`, ~`:20-38`)
- Test: covered via Task 4/6 integration tests (the timeline row is asserted there)

**Interfaces:**

- Produces: a `MachineTimelineEventData` variant `{ kind: "pinballmap_listing"; action: "listed" | "unlisted" | "linked" | "reconnected"; lmxId: number | null }`. Consumed by Tasks 4, 6, 7 via `createMachineTimelineEvent`.

- [ ] **Step 1: Add the variant.** In `machine-event-types.ts`, extend the `MachineTimelineEventData` union (follow the literal-pinning idiom noted at `actions.ts:63-74` — the `kind` and `action` must be string literals to stay assignable):

```ts
| {
    kind: "pinballmap_listing";
    action: "listed" | "unlisted" | "linked" | "reconnected";
    lmxId: number | null;
  }
```

- [ ] **Step 2: Typecheck.** Run: `pnpm run typecheck` → PASS. (If a display component exhaustively switches over `kind`, add a case rendering e.g. "Listed on PinballMap" / "Unlisted from PinballMap" / "Linked to PinballMap entry" / "Reconnected PinballMap link"; find it with `rg "kind ===" src/components -l` and follow the existing pattern. If the switch has a `default`, no change needed but prefer an explicit case.)

- [ ] **Step 3: Commit.**

```bash
git add src/lib/timeline/machine-event-types.ts src/components 2>/dev/null; git add src/lib/timeline/machine-event-types.ts
git commit -m "feat(timeline): pinballmap_listing machine event kind (PP-o355.12)"
```

---

### Task 4: `linkPinballmapEntryAction` — capture an existing lmx (read, `.link`)

**Files:**

- Modify: `src/app/(app)/m/pinballmap-actions.ts` (add the action; this module already holds catalog picker actions)
- Test: `src/test/integration/pinballmap-link-capture.test.ts`

**Interfaces:**

- Consumes: `getPinballMapState()`/`syncLocationSnapshot()` (foundation), `findLmxForMachine` (Task 2), `checkPermission`, `createMachineTimelineEvent`, the `pinballmap_listing` kind (Task 3).
- Produces: `linkPinballmapEntryAction(prev, formData): Promise<Result<{ lmxId: number }, "VALIDATION"|"UNAUTHORIZED"|"NOT_FOUND"|"ABSENT"|"SERVER">>`. `formData` carries `machineId` (our machine uuid). Reads the freshest snapshot (syncs if stale/absent), finds the lmx by the machine's `pinballmapMachineId`, writes `pinballmapLmxId` + `pinballmapListed = true` in a tx, mirrors a `linked` timeline event.

- [ ] **Step 1: Write the failing integration test.** Mirror the mock+PGlite seam from `src/test/integration/pinballmap-linking.test.ts:24-74` (`getTestDb`, `mockAuthAs`, `createUser`, client pinned to `getMockClient()`).

```ts
// setup per pinballmap-linking.test.ts …
it("captures the lmx for a linked machine and marks it listed", async () => {
  const admin = await createUser("admin");
  // seed a machine linked to pinballmapMachineId=42, listed=false, lmx=null
  // seed the mock lineup so machineId 42 has lmx id 900
  await mockAuthAs(admin.id);
  const fd = new FormData();
  fd.set("machineId", machine.id);
  const res = await linkPinballmapEntryAction(undefined, fd);
  expect(res.ok).toBe(true);
  expect(res.value.lmxId).toBe(900);
  const row = await db.query.machines.findFirst({
    where: eq(machines.id, machine.id),
  });
  expect(row?.pinballmapLmxId).toBe(900);
  expect(row?.pinballmapListed).toBe(true);
});

it("returns ABSENT when the title isn't in the lineup", async () => {
  /* machineId not in mock lineup → res.ok false, res.code "ABSENT" */
});

it("rejects a member without machines.pinballmap.link on someone else's machine", async () => {
  /* guest/other-member → UNAUTHORIZED */
});
```

- [ ] **Step 2: Run, verify FAIL** (action undefined).

- [ ] **Step 3: Implement `linkPinballmapEntryAction`.** Pattern (auth → perm → snapshot → resolve → persist; note the snapshot read is outside any tx, the DB write is a tx, and there's no PBM _write_ here):

```ts
export async function linkPinballmapEntryAction(
  _prev: LinkResult | undefined,
  formData: FormData
): Promise<LinkResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Sign in required");

  const machineId = String(formData.get("machineId") ?? "");
  if (!machineId) return err("VALIDATION", "Missing machine");

  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, machineId),
  });
  if (!machine) return err("NOT_FOUND", "Machine not found");
  if (machine.pinballmapMachineId === null)
    return err("VALIDATION", "Machine isn't linked to a PinballMap title yet");

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  const accessLevel = getAccessLevel(profile?.role);
  if (
    !checkPermission("machines.pinballmap.link", accessLevel, {
      userId: user.id,
      machineOwnerId: machine.ownerId ?? undefined,
    })
  )
    return err("UNAUTHORIZED", "Not allowed");

  // Read freshest lineup (foundation). Sync if we have no snapshot yet.
  let state = await getPinballMapState();
  if (!state?.snapshotJson) {
    await syncLocationSnapshot();
    state = await getPinballMapState();
  }
  const snapshot = state?.snapshotJson;
  if (!snapshot) return err("SERVER", "PinballMap lineup unavailable");

  const lmx = findLmxForMachine(snapshot, machine.pinballmapMachineId);
  if (!lmx)
    return err(
      "ABSENT",
      "This machine isn't on PinballMap's lineup for our location yet"
    );

  await db.transaction(async (tx) => {
    await tx
      .update(machines)
      .set({ pinballmapLmxId: lmx.id, pinballmapListed: true })
      .where(eq(machines.id, machineId));
    await createMachineTimelineEvent(
      machineId,
      {
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: {
          kind: "pinballmap_listing",
          action: "linked",
          lmxId: lmx.id,
        },
        actorId: user.id,
      },
      tx
    );
  });
  return ok({ lmxId: lmx.id });
}
```

Confirm exact `Result`/`ok`/`err` imports from `~/lib/result` and `getAccessLevel`/`checkPermission` from `~/lib/permissions/helpers` (per `actions.ts:40`, `:135`). Define `LinkResult = Result<{ lmxId: number }, "VALIDATION"|"UNAUTHORIZED"|"NOT_FOUND"|"ABSENT"|"SERVER">`.

- [ ] **Step 4: Run, verify PASS** (all three cases).

- [ ] **Step 5: Commit.**

```bash
git add src/app/\(app\)/m/pinballmap-actions.ts src/test/integration/pinballmap-link-capture.test.ts
git commit -m "feat(pinballmap): linkPinballmapEntryAction — capture existing lmx (PP-o355.12)"
```

---

### Task 5: `verifyPinballmapLinkAction` — heal or flag a stored lmx (read, `.link`)

**Files:**

- Modify: `src/app/(app)/m/pinballmap-actions.ts`
- Test: extend `src/test/integration/pinballmap-link-capture.test.ts`

**Interfaces:**

- Produces: `verifyPinballmapLinkAction(prev, formData): Promise<Result<{ state: "ok" | "stale" | "healed" }, "VALIDATION"|"UNAUTHORIZED"|"NOT_FOUND"|"SERVER">>`. Syncs a fresh snapshot, re-resolves the lmx for the machine's title: if the stored `pinballmapLmxId` still matches → `ok`; if the title resolves to a _different_ lmx id → update it, `healed`; if the title is absent from the lineup → `stale` (leave the stored id, surface reconnect in UI).

- [ ] **Step 1: Write failing tests** — three cases: stored id still present (`ok`), title now maps to a new id (`healed`, row updated), title absent (`stale`, row unchanged).

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement** (same auth/perm preamble as Task 4; force a fresh `syncLocationSnapshot()` first since Verify is an explicit "check now"):

```ts
// after auth + machines.pinballmap.link check + machine has pinballmapMachineId:
await syncLocationSnapshot();
const snapshot = (await getPinballMapState())?.snapshotJson;
if (!snapshot) return err("SERVER", "PinballMap lineup unavailable");
const lmx = findLmxForMachine(snapshot, machine.pinballmapMachineId);
if (!lmx) return ok({ state: "stale" });
if (lmx.id === machine.pinballmapLmxId) return ok({ state: "ok" });
await db.transaction(async (tx) => {
  await tx
    .update(machines)
    .set({ pinballmapLmxId: lmx.id, pinballmapListed: true })
    .where(eq(machines.id, machine.id));
  await createMachineTimelineEvent(
    machine.id,
    {
      sourceType: "lifecycle",
      tag: "lifecycle",
      eventData: {
        kind: "pinballmap_listing",
        action: "reconnected",
        lmxId: lmx.id,
      },
      actorId: user.id,
    },
    tx
  );
});
return ok({ state: "healed" });
```

- [ ] **Step 4: Run, verify PASS.**

- [ ] **Step 5: Commit.**

```bash
git add src/app/\(app\)/m/pinballmap-actions.ts src/test/integration/pinballmap-link-capture.test.ts
git commit -m "feat(pinballmap): verifyPinballmapLinkAction — heal/flag stored lmx (PP-o355.12)"
```

---

### Task 6: Form UI — "Connect to PinballMap" state control (edit + create)

**Files:**

- Modify: `src/app/(app)/m/[initials]/update-machine-form.tsx` (replace the disabled checkbox at `:442-469`)
- Modify: `src/app/(app)/m/new/create-machine-form.tsx` (the create counterpart, `:332-343`)
- Create: `src/components/machines/PinballmapListingControl.tsx` (the shared state control — one responsibility, reused by both forms per Rule-of-Three-at-two given it's load-bearing)
- Test: `src/app/(app)/m/[initials]/update-machine-form.test.tsx` (extend; RTL)

**Interfaces:**

- Consumes: the machine's `pinballmapMachineId`, `pinballmapListed`, `pinballmapLmxId`; `canLink` (already passed to the edit form), a new `canPush` prop (admin — from the page's `checkPermission("machines.pinballmap.push", …)`); the read actions (Tasks 4–5) and write actions (Task 7). Renders the four states.
- Produces: `<PinballmapListingControl>` presenting: **not linked to title** → nothing (must link a title first, existing PinballMapLinkField handles that); **linked, lmx null, not in lineup** → "List on PinballMap" (write, `canPush`); **linked, lmx null, in lineup** → "Link to this entry" (read, `canLink`); **listed+linked** → "Listed · Unlist (canPush) · Verify (canLink)"; **stale** (verify returned stale / a write hit not_found) → "⚠ Link broken · Reconnect".

- [ ] **Step 1: Write failing RTL tests** for the control's state rendering. Mock the actions; assert: a linked machine with `pinballmapLmxId` set shows "Listed" + an "Unlist" button when `canPush`; the same with `canPush=false` shows "Listed" but no Unlist (deep-link fallback text "Open on PinballMap"); a machine with `pinballmapLmxId=null` shows a "Connect to PinballMap" affordance. Use the existing test's fixture (`pinballmapListed: false`) as the base and add variants.

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Build `PinballmapListingControl.tsx`** as a client leaf (`"use client"`), progressive-enhancement forms (`<form action={action}>`) for each verb, a hidden `machineId` input, state derived from props (no `useMediaQuery`, no fetch-on-render). The "Connect to PinballMap" affordance triggers `linkPinballmapEntryAction` (which itself branches server-side: found → captures; absent → returns ABSENT, and the UI then offers "List it" when `canPush`). Show the confirm-on-unlist dialog (Task 7 copy). Replace the disabled checkbox blocks in both forms with `<PinballmapListingControl … />`.

- [ ] **Step 4: Run RTL, verify PASS.** Run: `FORCE_MEM_PRECHECK=skip pnpm exec vitest run src/app/\(app\)/m/\[initials\]/update-machine-form.test.tsx`.

- [ ] **Step 5: Commit.**

```bash
git add src/components/machines/PinballmapListingControl.tsx "src/app/(app)/m/[initials]/update-machine-form.tsx" "src/app/(app)/m/[initials]/update-machine-form.test.tsx" "src/app/(app)/m/new/create-machine-form.tsx"
git commit -m "feat(machines): Connect-to-PinballMap state control, read side (PP-o355.12)"
```

**★ Natural PR seam:** Tasks 1–6 form a complete, shippable read-side PR (link/verify/reconnect, no operator token). Consider opening it here; Tasks 7–10 (writes) follow in a second PR. If shipping as one PR, continue.

---

## Write side (operator token) — Tasks 7–10

### Task 7: Operator credentials in Vault — store + read-back

**Files:**

- Create: `src/lib/pinballmap/operator-credentials.ts` (read-back helper)
- Create: migration for a decrypt RPC `get_pinballmap_operator_token` (mirror Discord's `get_discord_config` RPC, `0028_natural_vengeance.sql`)
- Modify: an admin action or documented manual-seed path to set `outbound_email` + create the Vault secret (mirror `src/app/(app)/admin/integrations/discord/actions.ts:335-499`)
- Test: `src/test/integration/pinballmap-operator-credentials.test.ts` (assert on `db.execute` SQL text per the Vault-in-PGlite caveat)

**Interfaces:**

- Produces:
  - `getOperatorCredentials(): Promise<PbmCredentials | null>` — reads `pinballmap_state.outbound_email` + decrypts the vault secret via the RPC through `createAdminClient()`; `assertNotInTransaction` first; returns `{ email, token }` or null when unconfigured.
  - `setOperatorCredentials({ email, token, actorId }): Promise<void>` — create-or-update the Vault secret (RPCs on `db`, BEFORE any tx), store `outbound_email` + `outbound_token_vault_id` on the singleton. Admin-only caller.

- [ ] **Step 1: Write the failing test** — assert `setOperatorCredentials` issues `vault.create_secret(...)` (first time) then persists `outbound_token_vault_id`; assert `getOperatorCredentials` calls the decrypt RPC and returns `{email, token}`. Follow `discord-integration-actions.test.ts:17-19` (assert the SQL argument text; don't execute Vault in PGlite).

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Migration** — regenerate FRESH (`pnpm run db:generate` mints the next number after the foundation's; it will renumber against main — see collision note). The migration defines `get_pinballmap_operator_token()` returning the decrypted token for the singleton's `outbound_token_vault_id`, `SECURITY DEFINER`, callable by the service role only (copy the shape of `get_discord_config` from `0028`).

- [ ] **Step 4: Implement `operator-credentials.ts`** mirroring `src/lib/discord/config.ts:49-105` (the `createAdminClient()` + `supabase.rpc(...)` + `assertNotInTransaction` pattern) and the Discord vault write in `actions.ts:335-499` (create-vs-update, RPCs before tx, compensating catch on create-path orphan).

- [ ] **Step 5: Run, verify PASS. Commit.**

```bash
git add src/lib/pinballmap/operator-credentials.ts src/test/integration/pinballmap-operator-credentials.test.ts drizzle/ src/app/\(app\)/admin
git commit -m "feat(pinballmap): operator credentials in Vault (store + decrypt RPC) (PP-o355.12)"
```

---

### Task 8: `listOnPinballmapAction` — addMachine + capture returned lmx (write, `.push`)

**Files:**

- Modify: `src/app/(app)/m/pinballmap-actions.ts`
- Test: `src/test/integration/pinballmap-list-write.test.ts`

**Interfaces:**

- Produces: `listOnPinballmapAction(prev, formData): Promise<Result<{ lmxId: number }, "VALIDATION"|"UNAUTHORIZED"|"NOT_FOUND"|"NO_OPERATOR"|"PBM_FAILED"|"SERVER">>`. Admin-only (`machines.pinballmap.push`). Reads operator creds; calls `getPinballMapClient().addMachine({ credentials, locationId: APC_LOCATION_ID, machineId: pinballmapMachineId })` OUTSIDE any tx; on `ok` stores the returned `lmxId` + `pinballmapListed=true` + mirrors a `listed` timeline event; on failure maps the reason to `PBM_FAILED`/`NO_OPERATOR`.

- [ ] **Step 1: Write failing tests** — admin lists a linked-but-unlisted machine → mock `addMachine` returns `{ok:true, lmxId:901}` → row gets `pinballmapLmxId=901, pinballmapListed=true` + timeline `listed`; non-admin → UNAUTHORIZED; no operator creds → NO_OPERATOR; mock `addMachine` returns `{ok:false, reason:"unauthorized"}` → PBM_FAILED, row unchanged.

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement** (auth → `machines.pinballmap.push` → machine has `pinballmapMachineId` & `pinballmapLmxId===null` → `getOperatorCredentials()` (NO_OPERATOR if null) → `addMachine` outside tx → on ok, tx: update row + timeline). Reuse `APC_LOCATION_ID` from `./config`.

- [ ] **Step 4: Run, verify PASS. Commit.**

```bash
git add src/app/\(app\)/m/pinballmap-actions.ts src/test/integration/pinballmap-list-write.test.ts
git commit -m "feat(pinballmap): listOnPinballmapAction — addMachine + capture lmx (PP-o355.12)"
```

---

### Task 9: `unlistFromPinballmapAction` — removeMachine + reactive stale (write, `.push`)

**Files:**

- Modify: `src/app/(app)/m/pinballmap-actions.ts`
- Test: `src/test/integration/pinballmap-list-write.test.ts`

**Interfaces:**

- Produces: `unlistFromPinballmapAction(prev, formData): Promise<Result<{ unlisted: true } | { stale: true }, "VALIDATION"|"UNAUTHORIZED"|"NOT_FOUND"|"NO_OPERATOR"|"PBM_FAILED"|"SERVER">>`. Admin-only. Requires a stored `pinballmapLmxId`. Calls `removeMachine({ credentials, lmxId })` OUTSIDE tx; on `ok` clears `pinballmapLmxId` + sets `pinballmapListed=false` + timeline `unlisted`; on `reason: "not_found"` the link is broken on PBM's side → return `{ stale: true }` (leave the row so the UI shows Reconnect), do NOT flip listed; other failures → PBM_FAILED.

- [ ] **Step 1: Write failing tests** — admin unlists a listed machine → mock `removeMachine` ok → `pinballmapLmxId=null, pinballmapListed=false` + timeline `unlisted`; mock returns `{ok:false, reason:"not_found"}` → `res.value.stale===true`, row's `pinballmapLmxId` unchanged (reactive-stale); non-admin → UNAUTHORIZED.

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement** per the interface. Map `removeMachine` reasons: `not_found` → `ok({ stale: true })`; `unauthorized`/`rejected`/`rate_limited`/`transient` → `err("PBM_FAILED", reason)`.

- [ ] **Step 4: Run, verify PASS. Commit.**

```bash
git add src/app/\(app\)/m/pinballmap-actions.ts src/test/integration/pinballmap-list-write.test.ts
git commit -m "feat(pinballmap): unlistFromPinballmapAction + reactive stale (PP-o355.12)"
```

---

### Task 10: Wire write verbs + confirm-on-unlist copy into the control; full pass

**Files:**

- Modify: `src/components/machines/PinballmapListingControl.tsx`
- Modify: `src/app/(app)/m/[initials]/update-machine-form.test.tsx`

**Interfaces:**

- Consumes: Tasks 8–9 actions; the `stale` return of unlist.

- [ ] **Step 1: Failing RTL** — clicking "Unlist" opens a confirm dialog whose body reads **"Unlisting hides this machine's PinballMap visitor comments. They reappear if it's re-listed within about a week."** (finding #3 — "hidden", not "deleted"); confirming calls `unlistFromPinballmapAction`; an action returning `{stale:true}` flips the control into the "⚠ Link broken · Reconnect" state.

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Wire** the List/Unlist forms (admin) + the confirm dialog (reuse the AlertDialog pattern already in `update-machine-form.tsx`) + the stale→reconnect transition. Non-admin permitted-to-link users still see Link/Verify/Reconnect; the write verbs render as the "Open on PinballMap" deep-link fallback.

- [ ] **Step 4: Run RTL, verify PASS.**

- [ ] **Step 5: Full verification.** Run: `pnpm run preflight` → PASS. Then drive the flow in the app against the mock (`PINBALLMAP_MODE=mock`) per the `verify` skill: list → unlist → reconnect on a seeded machine.

- [ ] **Step 6: Commit.**

```bash
git add src/components/machines/PinballmapListingControl.tsx "src/app/(app)/m/[initials]/update-machine-form.test.tsx"
git commit -m "feat(machines): wire list/unlist + confirm-hidden-comments copy (PP-o355.12)"
```

---

## Self-Review

**Spec coverage (against PP-o355.12):** 4-state model → Task 6 control; read/write permission split → Tasks 1 (`.push`) + existing `.link`; Connect-branching UI → Task 6; capture existing entry → Task 4; list new → Task 8; unlist → Task 9; reactive stale + Verify/Reconnect → Tasks 5 + 9; operator token in Vault (RPCs outside tx) → Task 7; timeline mirror → Task 3 + used in 4/5/8/9; confirm-on-unlist "hidden" copy → Task 10; ephemeral-comment fix → done in the foundation (PP-o355.16), not repeated here; deep-link fallback for unlinked-for-write → Task 6/10.

**Placeholder scan:** RTL/UI steps describe concrete assertions and the exact confirm copy; server-action steps show full code for the novel one (Task 4) and precise interface + branch-mapping for the parallel ones (5/8/9) rather than re-pasting the identical preamble — each names its exact inputs, outputs, and reason-mapping. Implementer-verify notes (exact `Result`/helper import paths, the timeline display switch) are "confirm against this file" instructions, not TBDs.

**Type consistency:** `linkPinballmapEntryAction`, `verifyPinballmapLinkAction`, `listOnPinballmapAction`, `unlistFromPinballmapAction`, `findLmxForMachine`, `getOperatorCredentials`, `PinballmapListingControl`, the `pinballmap_listing` timeline kind, and `machines.pinballmapLmxId` are used consistently across tasks. Reason unions match `PbmWriteFailureReason` from `types.ts:99`.

**Migration collision:** Task 7's migration will collide on a number with the foundation's `0052` and the collections branch's `0052` — regenerate FRESH against current main at implementation time (`pinpoint-migration-conflicts`), never hand-edit `meta/`.

---

## Execution Handoff

Plan complete. Recommended: ship **Tasks 1–6 (read side) as PR 1** — complete on its own, no operator token, unblocks the PP-h059 backfill and PP-o355.4 comment-sync — then **Tasks 7–10 (write side) as PR 2**. Both under bead PP-o355.12 (single bead, two PRs — not per-task sliver beads). Execution mode (subagent-driven vs inline) + the multi-agent scale gate to be cleared with Tim before dispatch.

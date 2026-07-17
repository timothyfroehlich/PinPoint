# PBM Snapshot Sync — Cron, Status Derivation, Desync (PP-o355.11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the PinballMap location snapshot refresh automatically (hourly cron + on-demand "Sync now"), derive each machine's PBM status from the stored snapshot, and reconcile that against our local `pinballmapListed` flag / stored `pinballmapLmxId` so drift surfaces as a soft signal — including healing a machine's stored lmx id when the snapshot shows it moved.

**Architecture:** The foundation (PP-o355.16) already ships `pinballmap_state`, `getPinballMapState()`, and `syncLocationSnapshot()` (the fetch-and-persist). This bead adds the _scheduling_ and _derivation_ on top, recovered from the reverted `b6eb7dca` commit's `status.ts` + cron route: a `CRON_SECRET`-gated route that calls `syncLocationSnapshot()`, a technician+ "Sync now" server action, pure `derivePbmMachineStatus`/`shouldBeListedOnPbm` reworked to the three-concept model (linking / listing / availability kept separate; desync is a soft signal, never auto-derived from presence), and a reconcile pass that heals `pinballmapLmxId` drift. **No schema changes here** — the foundation owns them.

**Tech Stack:** Next.js route handler (cron), server actions, pure TS derivation module, PGlite+Vitest, the PinballMap client seam (mock in tests).

## Global Constraints

- **Depends on PP-o355.16** (foundation) merged: consumes `pinballmapState`, `machines.pinballmapLmxId`, `getPinballMapState()`, `syncLocationSnapshot()`. Do NOT recreate them; `git merge origin/main` if the branch predates the foundation.
- **No side effects inside DB transactions** (CORE-ARCH-011): `syncLocationSnapshot()` already fetches outside a tx; the reconcile pass reads the persisted snapshot then writes in a tx (no HTTP inside).
- **Permissions through the matrix** (CORE-ARCH-008): "Sync now" → re-add `machines.pinballmap.sync` (technician+), removed from the matrix in #1659; the help page auto-generates.
- **Three-concept model** (locked): catalog association (linking), PBM listing (`pinballmapListed`), and availability (`presenceStatus`) stay SEPARATE. Desync is a surfaced alert, never a rule that flips listing from presence.
- **Respect PBM conduct** (CORE-PBM-001): the cron is hourly (one location call/hour); never poll faster, never per-render.
- **Test what we own** (CORE-TEST-006): client pinned to the mock; `CRON_SECRET` path tested with a fake secret.
- **Type safety** (CORE-TS-007), **path aliases** (`~/…`). **Run `pnpm run preflight` before pushing** (server actions + route + reconcile).

---

### Task 1: Pure status derivation — `src/lib/pinballmap/status.ts`

**Files:**

- Create: `src/lib/pinballmap/status.ts` (no `server-only`, no DB — pure, so the Info card + unit tests use it directly)
- Test: `src/lib/pinballmap/status.test.ts`
- Modify: `src/lib/pinballmap/sync.ts` (re-export the status symbols, matching the b6eb7dca surface the rest of the app imports)

**Interfaces:**

- Consumes: `LocationSnapshot`, `PbmLmx` from `./types`; `findLmxForMachine` from `./resolve-lmx` IF PP-o355.12 merged first (else inline the same one-liner — see note).
- Produces:
  - `type PbmMachineStatus = { onPbm: boolean; lmxId: number | null; desynced: boolean; reason: "ok" | "listed_locally_absent_on_pbm" | "on_pbm_not_listed_locally" | "lmx_drifted" | "unlinked" }`
  - `derivePbmMachineStatus(args: { pinballmapMachineId: number | null; pinballmapListed: boolean; pinballmapLmxId: number | null; snapshot: LocationSnapshot | null }): PbmMachineStatus`
  - `shouldBeListedOnPbm(args): boolean` — reworked: returns the _local intent_ (`pinballmapListed`) only; it does NOT consult `presenceStatus` (the three-concept separation — this is the specific rework the bead calls out).

- [ ] **Step 1: Write the failing unit tests.** Cover the derivation matrix:

```ts
import { describe, it, expect } from "vitest";
import { derivePbmMachineStatus } from "./status";
import type { LocationSnapshot } from "./types";

const snap = (rows: { id: number; machineId: number }[]): LocationSnapshot => ({
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
  fetchedAtIso: "2026-07-16T00:00:00Z",
  raw: {},
});

describe("derivePbmMachineStatus", () => {
  it("ok: listed locally, lmx present and matching", () => {
    const s = derivePbmMachineStatus({
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
      snapshot: snap([{ id: 900, machineId: 42 }]),
    });
    expect(s).toEqual({
      onPbm: true,
      lmxId: 900,
      desynced: false,
      reason: "ok",
    });
  });
  it("desync: listed locally but title absent from lineup", () => {
    const s = derivePbmMachineStatus({
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
      snapshot: snap([]),
    });
    expect(s.desynced).toBe(true);
    expect(s.reason).toBe("listed_locally_absent_on_pbm");
  });
  it("desync: on PBM but not listed locally", () => {
    const s = derivePbmMachineStatus({
      pinballmapMachineId: 42,
      pinballmapListed: false,
      pinballmapLmxId: null,
      snapshot: snap([{ id: 900, machineId: 42 }]),
    });
    expect(s.reason).toBe("on_pbm_not_listed_locally");
    expect(s.desynced).toBe(true);
  });
  it("lmx_drifted: listed, title present but under a different lmx id than stored", () => {
    const s = derivePbmMachineStatus({
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
      snapshot: snap([{ id: 999, machineId: 42 }]),
    });
    expect(s.reason).toBe("lmx_drifted");
    expect(s.lmxId).toBe(999);
  });
  it("unlinked: no catalog title", () => {
    const s = derivePbmMachineStatus({
      pinballmapMachineId: null,
      pinballmapListed: false,
      pinballmapLmxId: null,
      snapshot: snap([]),
    });
    expect(s.reason).toBe("unlinked");
  });
  it("null snapshot: not desynced (no data), reason ok", () => {
    const s = derivePbmMachineStatus({
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
      snapshot: null,
    });
    expect(s.desynced).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify FAIL.** Run: `FORCE_MEM_PRECHECK=skip pnpm exec vitest run src/lib/pinballmap/status.test.ts`.

- [ ] **Step 3: Implement `status.ts`.**

```ts
import type { LocationSnapshot } from "./types";

export type PbmMachineStatus = {
  onPbm: boolean;
  lmxId: number | null;
  desynced: boolean;
  reason:
    | "ok"
    | "listed_locally_absent_on_pbm"
    | "on_pbm_not_listed_locally"
    | "lmx_drifted"
    | "unlinked";
};

export function derivePbmMachineStatus(args: {
  pinballmapMachineId: number | null;
  pinballmapListed: boolean;
  pinballmapLmxId: number | null;
  snapshot: LocationSnapshot | null;
}): PbmMachineStatus {
  const { pinballmapMachineId, pinballmapListed, pinballmapLmxId, snapshot } =
    args;
  if (pinballmapMachineId === null)
    return { onPbm: false, lmxId: null, desynced: false, reason: "unlinked" };
  if (!snapshot)
    return {
      onPbm: pinballmapListed,
      lmxId: pinballmapLmxId,
      desynced: false,
      reason: "ok",
    };

  const row =
    snapshot.lmxes.find((l) => l.machineId === pinballmapMachineId) ?? null;
  const onPbm = row !== null;

  if (pinballmapListed && !onPbm)
    return {
      onPbm: false,
      lmxId: pinballmapLmxId,
      desynced: true,
      reason: "listed_locally_absent_on_pbm",
    };
  if (!pinballmapListed && onPbm)
    return {
      onPbm: true,
      lmxId: row.id,
      desynced: true,
      reason: "on_pbm_not_listed_locally",
    };
  if (pinballmapListed && onPbm && row.id !== pinballmapLmxId)
    return {
      onPbm: true,
      lmxId: row.id,
      desynced: true,
      reason: "lmx_drifted",
    };
  return {
    onPbm,
    lmxId: onPbm ? row.id : pinballmapLmxId,
    desynced: false,
    reason: "ok",
  };
}

/** Local listing intent only. Deliberately independent of presenceStatus
 *  (three-concept model: linking / listing / availability stay separate). */
export function shouldBeListedOnPbm(args: {
  pinballmapListed: boolean;
}): boolean {
  return args.pinballmapListed;
}
```

- [ ] **Step 4: Add the re-export to `sync.ts`** (the app imports status symbols from `./sync` per the b6eb7dca surface):

```ts
export {
  shouldBeListedOnPbm,
  derivePbmMachineStatus,
  type PbmMachineStatus,
} from "./status";
```

- [ ] **Step 5: Run, verify PASS. Commit.**

```bash
git add src/lib/pinballmap/status.ts src/lib/pinballmap/status.test.ts src/lib/pinballmap/sync.ts
git commit -m "feat(pinballmap): pure PBM status derivation, three-concept model (PP-o355.11)"
```

Note: if PP-o355.12 has NOT merged, `resolve-lmx.ts` may not exist — `status.ts` above inlines the `.find(...)` so it has no dependency on it. If both merge, a later cleanup can DRY the one-liner; don't block on it.

---

### Task 2: `machines.pinballmap.sync` permission (technician+)

**Files:**

- Modify: `src/lib/permissions/matrix.ts`
- Modify: `src/test/unit/permissions-matrix.test.ts`

**Interfaces:**

- Produces: permission id `"machines.pinballmap.sync"`. Consumed by Task 4 ("Sync now" action).

- [ ] **Step 1: Failing test** asserting the entry exists with `access: { unauthenticated:false, guest:false, member:false, technician:true, admin:true }`.

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Add the entry** after `machines.pinballmap.link`:

```ts
{
  id: "machines.pinballmap.sync",
  label: "Trigger a PinballMap sync",
  description: "Manually refresh the stored PinballMap location snapshot",
  access: { unauthenticated: false, guest: false, member: false, technician: true, admin: true },
},
```

- [ ] **Step 4: Run, verify PASS. Commit.**

```bash
git add src/lib/permissions/matrix.ts src/test/unit/permissions-matrix.test.ts
git commit -m "feat(permissions): add machines.pinballmap.sync (technician+) (PP-o355.11)"
```

---

### Task 3: Reconcile pass — heal drifted `pinballmapLmxId` after a sync

**Files:**

- Modify: `src/lib/pinballmap/sync.ts` (add `reconcileAfterSync`)
- Test: `src/test/integration/pinballmap-reconcile.test.ts`

**Interfaces:**

- Consumes: the persisted snapshot (`getPinballMapState().snapshotJson`), `derivePbmMachineStatus` (Task 1), `machines`.
- Produces: `reconcileAfterSync(): Promise<{ healed: number; desynced: number }>` — reads the stored snapshot, and for every linked machine whose status is `lmx_drifted`, updates `pinballmapLmxId` to the snapshot's current id (a soft, safe heal: the title is present, just under a new lmx). Counts `desynced` machines (any `desynced: true`) for reporting but does NOT auto-flip `pinballmapListed` (that's a human decision on the status page, PP-o355.7). No PBM HTTP here — pure DB read/write off the stored snapshot.

- [ ] **Step 1: Failing integration test** — seed a machine `{pinballmapMachineId:42, pinballmapListed:true, pinballmapLmxId:900}`; store a snapshot where machineId 42 is under lmx 999; call `reconcileAfterSync()`; assert the row's `pinballmapLmxId` became 999 and `healed===1`; seed a second machine listed-but-absent and assert it's counted in `desynced` but its row is unchanged (no auto-unlist).

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement `reconcileAfterSync`** — load the snapshot once, `db.query.machines.findMany` for linked machines, compute status per row, collect drifted ids, apply updates in one `db.transaction`. Never call PBM.

- [ ] **Step 4: Run, verify PASS. Commit.**

```bash
git add src/lib/pinballmap/sync.ts src/test/integration/pinballmap-reconcile.test.ts
git commit -m "feat(pinballmap): reconcile pass heals drifted lmx ids (PP-o355.11)"
```

---

### Task 4: "Sync now" server action + cron route

**Files:**

- Create: `src/app/api/cron/pinballmap-sync/route.ts` (recover from `b6eb7dca`)
- Modify: `src/app/(app)/m/pinballmap-actions.ts` (add `syncPinballMapNowAction`)
- Test: `src/test/integration/pinballmap-sync-trigger.test.ts`

**Interfaces:**

- Consumes: `syncLocationSnapshot()` + `reconcileAfterSync()` (Task 3), `checkPermission("machines.pinballmap.sync", …)`, `CRON_SECRET` env.
- Produces:
  - Route `GET /api/cron/pinballmap-sync` — verifies `Authorization: Bearer ${CRON_SECRET}`, calls `syncLocationSnapshot()` then `reconcileAfterSync()`, returns JSON `{ ok, machineCount?, healed?, error? }`; 401 on bad secret. Registered hourly (document the schedule; scheduler-agnostic per b6eb7dca).
  - `syncPinballMapNowAction(prev, formData): Promise<Result<{ machineCount: number; healed: number }, "UNAUTHORIZED"|"SERVER">>` — technician+; same sync+reconcile, for the admin/status UI.

- [ ] **Step 1: Failing tests** — (a) route rejects a wrong bearer with 401; (b) route with the right bearer calls sync + reconcile and returns `ok:true`; (c) `syncPinballMapNowAction` denies a member (UNAUTHORIZED) and allows a technician.

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement** the route (recover the `CRON_SECRET` bearer check + response shape from `git show b6eb7dca:src/app/api/cron/pinballmap-sync/route.ts`) and the action (auth → `machines.pinballmap.sync` → `syncLocationSnapshot()` → `reconcileAfterSync()`).

- [ ] **Step 4: Run, verify PASS. Commit.**

```bash
git add src/app/api/cron/pinballmap-sync/route.ts src/app/\(app\)/m/pinballmap-actions.ts src/test/integration/pinballmap-sync-trigger.test.ts
git commit -m "feat(pinballmap): hourly cron + Sync-now action (PP-o355.11)"
```

---

### Task 5: Surface desync on the Info-tab status card

**Files:**

- Modify: `src/app/(app)/m/[initials]/(tabs)/machine-pinballmap-card.tsx` (the card shipped by PP-o355.3)
- Modify: `src/app/(app)/m/[initials]/(tabs)/page.tsx` (pass the derived status)
- Test: extend the card's existing RTL test (PP-o355.3 shipped 11 tests here)

**Interfaces:**

- Consumes: `derivePbmMachineStatus` (Task 1), `getPinballMapState()` for the snapshot.
- Produces: the card renders a soft desync alert when `status.desynced` (copy per `reason`: "Listed here but not showing on PinballMap", "On PinballMap but not marked listed here", "PinballMap link moved — verify"). Never blocks; it's informational + a link to act.

- [ ] **Step 1: Failing RTL** for each `desynced` reason → the right alert text; `reason:"ok"` → no alert (unchanged from today).

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement** — in `page.tsx`, read the snapshot via `getPinballMapState()`, derive status, pass `desynced`/`reason` into the card; render the alert block. Keep the existing "View on PinballMap" link-back (CORE-PBM-001 attribution).

- [ ] **Step 4: Run RTL, verify PASS.**

- [ ] **Step 5: Full verification.** Run: `pnpm run preflight` → PASS. Drive the app against the mock: force a desync (seed listed-locally + empty lineup), confirm the card shows the alert.

- [ ] **Step 6: Commit.**

```bash
git add "src/app/(app)/m/[initials]/(tabs)/machine-pinballmap-card.tsx" "src/app/(app)/m/[initials]/(tabs)/page.tsx" "src/app/(app)/m/[initials]/(tabs)/machine-pinballmap-card.test.tsx"
git commit -m "feat(pinballmap): surface snapshot desync on the Info status card (PP-o355.11)"
```

---

## Self-Review

**Spec coverage (against PP-o355.11):** snapshot singleton + inbound sync → foundation + Task 4 (cron/manual call it); reconcile against local flag + roster → Task 3; `machines.pinballmap.sync` re-added with Sync-now → Tasks 2 + 4; pure status derivation reworked (no presence→listing hard-link) → Task 1 (`shouldBeListedOnPbm` presence-independent); desync as a soft signal → Tasks 1 + 5; lmx heal on drift (the PP-o355.12 dependency for the remove path's auto-heal) → Task 3.

**Placeholder scan:** derivation + reconcile show full code; route/action steps give exact interface + the recovery source (`git show b6eb7dca:…`) rather than re-pasting; card copy strings are explicit.

**Type consistency:** `PbmMachineStatus`, `derivePbmMachineStatus`, `shouldBeListedOnPbm`, `reconcileAfterSync`, `syncPinballMapNowAction` used consistently; snapshot shape matches `LocationSnapshot` (`types.ts:40`); consumes the foundation's `getPinballMapState`/`syncLocationSnapshot` unchanged.

**Overlap with PP-o355.12:** both may add to `pinballmap-actions.ts` and both reference the snapshot lmx `.find`. Merge order handles it: whichever lands second resolves a small textual conflict in that file; the `.find` duplication is a one-liner (DRY later, don't block). No migration in this bead → no drizzle/meta collision from `.11`.

---

## Execution Handoff

Plan complete. `.11` is independent of `.12` once the foundation (PP-o355.16) is merged — they can run in parallel. Single bead, likely one PR (5 tasks, no migration). Execution mode + scale gate to be cleared with Tim before dispatch.

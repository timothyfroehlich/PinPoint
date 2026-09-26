/**
 * Integration Test: the Insider Connected intent (spec 3.8, PP-o355.59).
 *
 * The switch records an intent in PinPoint (`setInsiderConnectedIntentAction`)
 * and needs no Pinball Map credentials. Pushing it is the lineup sync's job:
 * `updateInsiderConnectedAction` when only Insider Connected differs, and
 * `addMachineToPinballMapAction` carrying the target with the entry. Both send
 * the target — On wins across same-title cabinets — never a flip, and an
 * unclear outcome is re-read, not retried.
 *
 * The PinballMap client is pinned at the seam (CORE-TEST-006) and credentials
 * are stubbed, as in `pinballmap-outbound-write.test.ts`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  machines,
  userProfiles,
  authUsers,
  pinballmapState,
  pinballmapCatalog,
} from "~/server/db/schema";
import type { LocationSnapshot, PbmWriteFailure } from "~/lib/pinballmap/types";

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

const LMX_ID = 300;
const TITLE_ID = 7;

interface PbmEntry {
  id: number;
  machineId: number;
  icEnabled: boolean | null;
}

// Pinball Map's lineup, and every Insider Connected write it received.
const pbm = vi.hoisted(() => ({
  lineup: [] as PbmEntry[],
  icCalls: [] as { lmxId: number; enabled: boolean }[],
  /** Failure to return from the IC write; `applyBeforeFailing` models a write
   *  that landed on PBM but whose response never arrived. */
  icResult: null as PbmWriteFailure | null,
  applyBeforeFailing: false,
}));

const snapshotOf = vi.hoisted(
  () =>
    (lineup: readonly PbmEntry[]): LocationSnapshot => ({
      locationId: 26454,
      name: "APC",
      dateLastUpdated: null,
      lastUpdatedByUsername: null,
      machineCount: lineup.length,
      lmxes: lineup.map((entry) => ({
        ...entry,
        lastUpdatedByUsername: null,
        conditions: [],
      })),
      fetchedAtIso: "2026-09-26T00:00:00Z",
      raw: {},
    })
);

vi.mock("~/lib/pinballmap/client", () => ({
  getPinballMapClient: () =>
    Promise.resolve({
      fetchLocation: () => Promise.resolve(snapshotOf(pbm.lineup)),
      addMachine: ({ machineId }: { machineId: number }) => {
        const id = LMX_ID;
        pbm.lineup.push({ id, machineId, icEnabled: null });
        return Promise.resolve({ ok: true, lmxId: id });
      },
      setInsiderConnected: ({
        lmxId,
        enabled,
      }: {
        lmxId: number;
        enabled: boolean;
      }) => {
        pbm.icCalls.push({ lmxId, enabled });
        const entry = pbm.lineup.find((l) => l.id === lmxId);
        if (pbm.icResult) {
          if (pbm.applyBeforeFailing && entry) entry.icEnabled = enabled;
          return Promise.resolve(pbm.icResult);
        }
        if (entry) entry.icEnabled = enabled;
        return Promise.resolve({ ok: true, icEnabled: enabled });
      },
    }),
}));

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
  if (!user) throw new Error("failed to seed user profile");
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

/** Seed the location with the entry present (or absent) and one machine. */
async function seed(opts: {
  onLineup?: boolean;
  pbmIcEnabled?: boolean | null;
  icEligible?: boolean;
  icIntent?: "on" | "off" | null;
  intent?: "on" | "off" | "no_sync";
  ownerId?: string;
}): Promise<string> {
  const db = await getTestDb();
  pbm.lineup =
    (opts.onLineup ?? true)
      ? [
          {
            id: LMX_ID,
            machineId: TITLE_ID,
            icEnabled: opts.pbmIcEnabled ?? null,
          },
        ]
      : [];
  await db.insert(pinballmapState).values({
    id: "singleton",
    locationId: 26454,
    snapshotJson: snapshotOf(pbm.lineup),
    lastSyncStatus: "ok",
    lastSyncedAt: new Date("2026-09-26T00:00:00Z"),
  });
  await db.insert(pinballmapCatalog).values({
    pinballmapMachineId: TITLE_ID,
    name: "Godzilla (Premium)",
    icEligible: opts.icEligible ?? true,
  });
  return addCabinet("GZ", {
    intent: opts.intent ?? "on",
    icIntent: opts.icIntent ?? null,
    ...(opts.ownerId ? { ownerId: opts.ownerId } : {}),
  });
}

async function addCabinet(
  initials: string,
  opts: {
    intent?: "on" | "off" | "no_sync";
    icIntent?: "on" | "off" | null;
    ownerId?: string;
  }
): Promise<string> {
  const db = await getTestDb();
  const [machine] = await db
    .insert(machines)
    .values({
      name: `Godzilla ${initials}`,
      initials,
      pinballmapMachineId: TITLE_ID,
      pinballmapIntent: opts.intent ?? "on",
      pinballmapIcIntent: opts.icIntent ?? null,
      ...(opts.ownerId ? { ownerId: opts.ownerId } : {}),
    })
    .returning();
  if (!machine) throw new Error("failed to seed machine");
  return machine.id;
}

function form(
  machineId: string,
  fields: Record<string, string> = {}
): FormData {
  const fd = new FormData();
  fd.append("machineId", machineId);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

async function storedIcIntent(machineId: string): Promise<string | null> {
  const db = await getTestDb();
  const row = await db.query.machines.findFirst({
    where: eq(machines.id, machineId),
    columns: { pinballmapIcIntent: true },
  });
  return row?.pinballmapIcIntent ?? null;
}

async function storedIcEnabled(): Promise<boolean | null | undefined> {
  const db = await getTestDb();
  const row = await db.query.pinballmapState.findFirst();
  return row?.snapshotJson?.lmxes.find((l) => l.id === LMX_ID)?.icEnabled;
}

describe("Insider Connected intent (PGlite)", () => {
  setupTestDb();

  beforeEach(async () => {
    pbm.lineup = [];
    pbm.icCalls = [];
    pbm.icResult = null;
    pbm.applyBeforeFailing = false;
    const { getPinballMapWriteCredentials } =
      await import("~/lib/pinballmap/credentials");
    vi.mocked(getPinballMapWriteCredentials).mockResolvedValue({
      email: "ops@example.com",
      token: "tok_123",
    });
  });

  describe("setInsiderConnectedIntentAction", () => {
    it("lets the owner record an intent without any Pinball Map credential", async () => {
      const { setInsiderConnectedIntentAction } =
        await import("~/app/(app)/m/pinballmap-actions");
      const { getPinballMapWriteCredentials } =
        await import("~/lib/pinballmap/credentials");
      vi.mocked(getPinballMapWriteCredentials).mockResolvedValue(null);
      const owner = await createUser("member");
      await mockAuthAs(owner.id);
      const machineId = await seed({ ownerId: owner.id });

      const result = await setInsiderConnectedIntentAction(
        undefined,
        form(machineId, { icIntent: "on" })
      );

      expect(result).toEqual({ ok: true, value: { icIntent: "on" } });
      expect(await storedIcIntent(machineId)).toBe("on");
      // Recording intent never writes to Pinball Map (3.8).
      expect(pbm.icCalls).toEqual([]);
    });

    it("works whatever the listing intent is", async () => {
      const { setInsiderConnectedIntentAction } =
        await import("~/app/(app)/m/pinballmap-actions");
      const admin = await createUser("admin");
      await mockAuthAs(admin.id);
      const machineId = await seed({ intent: "off", onLineup: false });

      const result = await setInsiderConnectedIntentAction(
        undefined,
        form(machineId, { icIntent: "off" })
      );

      expect(result.ok).toBe(true);
      expect(await storedIcIntent(machineId)).toBe("off");
    });

    it("refuses a title the catalog does not mark eligible", async () => {
      const { setInsiderConnectedIntentAction } =
        await import("~/app/(app)/m/pinballmap-actions");
      const admin = await createUser("admin");
      await mockAuthAs(admin.id);
      const machineId = await seed({ icEligible: false });

      const result = await setInsiderConnectedIntentAction(
        undefined,
        form(machineId, { icIntent: "on" })
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("VALIDATION");
      expect(await storedIcIntent(machineId)).toBeNull();
    });

    it("refuses a member who does not own the machine", async () => {
      const { setInsiderConnectedIntentAction } =
        await import("~/app/(app)/m/pinballmap-actions");
      const member = await createUser("member");
      await mockAuthAs(member.id);
      const machineId = await seed({});

      const result = await setInsiderConnectedIntentAction(
        undefined,
        form(machineId, { icIntent: "on" })
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("UNAUTHORIZED");
    });
  });

  describe("updateInsiderConnectedAction", () => {
    it("sends the stored target and stores Pinball Map's result", async () => {
      const { updateInsiderConnectedAction } =
        await import("~/app/(app)/m/pinballmap-actions");
      const admin = await createUser("admin");
      await mockAuthAs(admin.id);
      const machineId = await seed({ pbmIcEnabled: null, icIntent: "on" });

      const result = await updateInsiderConnectedAction(
        undefined,
        form(machineId)
      );

      expect(result).toEqual({ ok: true, value: { icEnabled: true } });
      expect(pbm.icCalls).toEqual([{ lmxId: LMX_ID, enabled: true }]);
      expect(await storedIcEnabled()).toBe(true);
    });

    it("takes On from a same-title cabinet when this one has no intent", async () => {
      const { updateInsiderConnectedAction } =
        await import("~/app/(app)/m/pinballmap-actions");
      const admin = await createUser("admin");
      await mockAuthAs(admin.id);
      const machineId = await seed({ pbmIcEnabled: false, icIntent: "off" });
      await addCabinet("GZ2", { icIntent: "on" });

      await updateInsiderConnectedAction(undefined, form(machineId));

      // On wins across the cabinets sharing the entry (3.8).
      expect(pbm.icCalls).toEqual([{ lmxId: LMX_ID, enabled: true }]);
    });

    it("still sends the target when the stored lineup already matches", async () => {
      // The stored lineup can be stale: PBM was changed after the last refresh.
      const { updateInsiderConnectedAction } =
        await import("~/app/(app)/m/pinballmap-actions");
      const admin = await createUser("admin");
      await mockAuthAs(admin.id);
      const machineId = await seed({ pbmIcEnabled: false, icIntent: "off" });
      pbm.lineup[0] = { id: LMX_ID, machineId: TITLE_ID, icEnabled: true };

      const result = await updateInsiderConnectedAction(
        undefined,
        form(machineId)
      );

      expect(result).toEqual({ ok: true, value: { icEnabled: false } });
      expect(pbm.icCalls).toEqual([{ lmxId: LMX_ID, enabled: false }]);
    });

    it("refuses when no cabinet has an intent", async () => {
      const { updateInsiderConnectedAction } =
        await import("~/app/(app)/m/pinballmap-actions");
      const admin = await createUser("admin");
      await mockAuthAs(admin.id);
      const machineId = await seed({ icIntent: null });

      const result = await updateInsiderConnectedAction(
        undefined,
        form(machineId)
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("VALIDATION");
      expect(pbm.icCalls).toEqual([]);
    });

    it("reports a Pinball Map rejection and leaves the stored lineup alone", async () => {
      const { updateInsiderConnectedAction } =
        await import("~/app/(app)/m/pinballmap-actions");
      const admin = await createUser("admin");
      await mockAuthAs(admin.id);
      const machineId = await seed({ icIntent: "on" });
      pbm.icResult = {
        ok: false,
        reason: "rejected",
        message: "Could not update Insider Connected for this machine",
      };

      const result = await updateInsiderConnectedAction(
        undefined,
        form(machineId)
      );

      expect(result).toEqual({
        ok: false,
        code: "PBM_REJECTED",
        message: "Could not update Insider Connected for this machine",
      });
      expect(await storedIcEnabled()).toBeNull();
    });

    it("does not retry an unclear outcome and re-reads the actual setting", async () => {
      const { updateInsiderConnectedAction } =
        await import("~/app/(app)/m/pinballmap-actions");
      const admin = await createUser("admin");
      await mockAuthAs(admin.id);
      const machineId = await seed({ pbmIcEnabled: false, icIntent: "on" });
      // The write landed on PBM, but its response never arrived.
      pbm.icResult = { ok: false, reason: "transient" };
      pbm.applyBeforeFailing = true;

      const result = await updateInsiderConnectedAction(
        undefined,
        form(machineId)
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("PBM_UNCLEAR");
      expect(pbm.icCalls).toHaveLength(1);
      expect(await storedIcEnabled()).toBe(true);
    });
  });

  describe("addMachineToPinballMapAction", () => {
    it("applies the Insider Connected target with the new entry in one push", async () => {
      const { addMachineToPinballMapAction } =
        await import("~/app/(app)/m/pinballmap-actions");
      const admin = await createUser("admin");
      await mockAuthAs(admin.id);
      const machineId = await seed({ onLineup: false, icIntent: "on" });

      const result = await addMachineToPinballMapAction(
        undefined,
        form(machineId)
      );

      expect(result).toEqual({ ok: true, value: { lmxId: LMX_ID } });
      expect(pbm.icCalls).toEqual([{ lmxId: LMX_ID, enabled: true }]);
      expect(await storedIcEnabled()).toBe(true);
    });

    it("sends no Insider Connected write when no cabinet has an intent", async () => {
      const { addMachineToPinballMapAction } =
        await import("~/app/(app)/m/pinballmap-actions");
      const admin = await createUser("admin");
      await mockAuthAs(admin.id);
      const machineId = await seed({ onLineup: false, icIntent: null });

      await addMachineToPinballMapAction(undefined, form(machineId));

      expect(pbm.icCalls).toEqual([]);
    });
  });

  describe("re-matching a machine to another title", () => {
    it("clears its Insider Connected intent", async () => {
      const { applyMachinePbmLink } = await import("~/services/machines");
      // The mocked app db (the same PGlite instance), so the transaction type
      // is the one `applyMachinePbmLink` takes.
      const { db } = await import("~/server/db");
      const admin = await createUser("admin");
      const machineId = await seed({ icIntent: "on", intent: "off" });

      await db.transaction(async (tx) => {
        await applyMachinePbmLink(
          tx,
          machineId,
          {
            columns: {
              pinballmapMachineId: 8,
              pinballmapExcluded: false,
              pinballmapExcludedReason: null,
              pinballmapIntent: "off",
              modelName: null,
              manufacturer: null,
              year: null,
              opdbId: null,
              ipdbId: null,
            },
            abandoned: null,
          },
          admin.id
        );
      });

      expect(await storedIcIntent(machineId)).toBeNull();
    });

    it("keeps it when the title is unchanged", async () => {
      const { applyMachinePbmLink } = await import("~/services/machines");
      // The mocked app db (the same PGlite instance), so the transaction type
      // is the one `applyMachinePbmLink` takes.
      const { db } = await import("~/server/db");
      const admin = await createUser("admin");
      const machineId = await seed({ icIntent: "on", intent: "off" });

      await db.transaction(async (tx) => {
        await applyMachinePbmLink(
          tx,
          machineId,
          {
            columns: {
              pinballmapMachineId: TITLE_ID,
              pinballmapExcluded: false,
              pinballmapExcludedReason: null,
              pinballmapIntent: "off",
              modelName: null,
              manufacturer: null,
              year: null,
              opdbId: null,
              ipdbId: null,
            },
            abandoned: null,
          },
          admin.id
        );
      });

      expect(await storedIcIntent(machineId)).toBe("on");
    });
  });
});

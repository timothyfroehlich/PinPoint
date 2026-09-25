/**
 * Integration Test: changing an entry's Insider Connected setting (spec 3.8,
 * PP-o355.59).
 *
 * `setInsiderConnectedAction` sends the target value — never a flip — and
 * writes PBM's reported result into the stored lineup. An unclear outcome is
 * not retried; the lineup is re-read instead.
 *
 * The PinballMap client is pinned at the seam (CORE-TEST-006) and credentials
 * are stubbed, as in `pinballmap-outbound-write.test.ts`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
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

// What PBM currently records, and every write request it received.
const pbm = vi.hoisted(() => ({
  icEnabled: null as boolean | null,
  calls: [] as { lmxId: number; enabled: boolean }[],
  /** Failure to return from the write; `applyBeforeFailing` models a write
   *  that landed on PBM but whose response never arrived. */
  writeResult: null as PbmWriteFailure | null,
  applyBeforeFailing: false,
}));

const LMX_ID = 300;
const TITLE_ID = 7;

const snapshotOf = vi.hoisted(
  () =>
    (icEnabled: boolean | null): LocationSnapshot => ({
      locationId: 26454,
      name: "APC",
      dateLastUpdated: null,
      lastUpdatedByUsername: null,
      machineCount: 1,
      lmxes: [
        {
          id: 300,
          machineId: 7,
          icEnabled,
          lastUpdatedByUsername: null,
          conditions: [],
        },
      ],
      fetchedAtIso: "2026-09-25T00:00:00Z",
      raw: {},
    })
);

vi.mock("~/lib/pinballmap/client", () => ({
  getPinballMapClient: () =>
    Promise.resolve({
      fetchLocation: () => Promise.resolve(snapshotOf(pbm.icEnabled)),
      setInsiderConnected: ({
        lmxId,
        enabled,
      }: {
        lmxId: number;
        enabled: boolean;
      }) => {
        pbm.calls.push({ lmxId, enabled });
        if (pbm.writeResult) {
          if (pbm.applyBeforeFailing) pbm.icEnabled = enabled;
          return Promise.resolve(pbm.writeResult);
        }
        pbm.icEnabled = enabled;
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

async function seed(opts: {
  stored: boolean | null;
  icEligible?: boolean;
  intent?: "on" | "off" | "no_sync";
  ownerId?: string;
}): Promise<string> {
  const db = await getTestDb();
  pbm.icEnabled = opts.stored;
  await db.insert(pinballmapState).values({
    id: "singleton",
    locationId: 26454,
    snapshotJson: snapshotOf(opts.stored),
    lastSyncStatus: "ok",
    lastSyncedAt: new Date("2026-09-25T00:00:00Z"),
  });
  await db.insert(pinballmapCatalog).values({
    pinballmapMachineId: TITLE_ID,
    name: "Godzilla (Premium)",
    icEligible: opts.icEligible ?? true,
  });
  const [machine] = await db
    .insert(machines)
    .values({
      name: "Godzilla",
      initials: "GZ",
      pinballmapMachineId: TITLE_ID,
      pinballmapIntent: opts.intent ?? "on",
      ...(opts.ownerId ? { ownerId: opts.ownerId } : {}),
    })
    .returning();
  if (!machine) throw new Error("failed to seed machine");
  return machine.id;
}

function form(machineId: string, enabled: string): FormData {
  const fd = new FormData();
  fd.append("machineId", machineId);
  fd.append("enabled", enabled);
  return fd;
}

async function storedIcEnabled(): Promise<boolean | null | undefined> {
  const db = await getTestDb();
  const row = await db.query.pinballmapState.findFirst();
  return row?.snapshotJson?.lmxes.find((l) => l.id === LMX_ID)?.icEnabled;
}

describe("setInsiderConnectedAction (PGlite)", () => {
  setupTestDb();

  beforeEach(async () => {
    pbm.icEnabled = null;
    pbm.calls = [];
    pbm.writeResult = null;
    pbm.applyBeforeFailing = false;
    const { getPinballMapWriteCredentials } =
      await import("~/lib/pinballmap/credentials");
    vi.mocked(getPinballMapWriteCredentials).mockResolvedValue({
      email: "ops@example.com",
      token: "tok_123",
    });
  });

  it("turns on a never-set entry by sending the target, and stores PBM's result", async () => {
    const { setInsiderConnectedAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    const machineId = await seed({ stored: null });

    const result = await setInsiderConnectedAction(
      undefined,
      form(machineId, "true")
    );

    expect(result).toEqual({ ok: true, value: { icEnabled: true } });
    expect(pbm.calls).toEqual([{ lmxId: LMX_ID, enabled: true }]);
    expect(await storedIcEnabled()).toBe(true);
  });

  it("makes no call when the stored setting already matches the target", async () => {
    const { setInsiderConnectedAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    const machineId = await seed({ stored: false });

    const result = await setInsiderConnectedAction(
      undefined,
      form(machineId, "false")
    );

    expect(result.ok).toBe(true);
    expect(pbm.calls).toEqual([]);
  });

  it("refuses a title the catalog does not mark eligible", async () => {
    const { setInsiderConnectedAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    const machineId = await seed({ stored: null, icEligible: false });

    const result = await setInsiderConnectedAction(
      undefined,
      form(machineId, "true")
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION");
    expect(pbm.calls).toEqual([]);
  });

  it("refuses a cabinet whose intent is not On", async () => {
    const { setInsiderConnectedAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    const machineId = await seed({ stored: true, intent: "off" });

    const result = await setInsiderConnectedAction(
      undefined,
      form(machineId, "false")
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION");
    expect(pbm.calls).toEqual([]);
  });

  it("refuses a member who does not own the machine", async () => {
    const { setInsiderConnectedAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const member = await createUser("member");
    await mockAuthAs(member.id);
    const machineId = await seed({ stored: null });

    const result = await setInsiderConnectedAction(
      undefined,
      form(machineId, "true")
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNAUTHORIZED");
    expect(pbm.calls).toEqual([]);
  });

  it("reports a PBM rejection and leaves the stored setting alone", async () => {
    const { setInsiderConnectedAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    const machineId = await seed({ stored: null });
    pbm.writeResult = {
      ok: false,
      reason: "rejected",
      message: "Could not update Insider Connected for this machine",
    };

    const result = await setInsiderConnectedAction(
      undefined,
      form(machineId, "true")
    );

    expect(result).toEqual({
      ok: false,
      code: "PBM_REJECTED",
      message: "Could not update Insider Connected for this machine",
    });
    expect(await storedIcEnabled()).toBeNull();
  });

  it("does not retry an unclear outcome and re-reads the actual setting", async () => {
    const { setInsiderConnectedAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const admin = await createUser("admin");
    await mockAuthAs(admin.id);
    const machineId = await seed({ stored: false });
    // The write landed on PBM, but its response never arrived.
    pbm.writeResult = { ok: false, reason: "transient" };
    pbm.applyBeforeFailing = true;

    const result = await setInsiderConnectedAction(
      undefined,
      form(machineId, "true")
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PBM_UNCLEAR");
    expect(pbm.calls).toHaveLength(1);
    // The re-read picked up what PBM actually has.
    expect(await storedIcEnabled()).toBe(true);
  });
});

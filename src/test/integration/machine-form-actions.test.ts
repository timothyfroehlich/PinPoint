/**
 * Integration Test: the machine form's server behavior (PP-wqit.14.2)
 *
 * - `createMachineAction` records the New Machine page's Pinball Map lineup
 *   choice — intent and Insider Connected — and, when the person ticked "Add
 *   to Pinball Map after creating", runs the add push afterwards through the
 *   Manage tab's own add action (pinballmap 4.11). A failed push never undoes
 *   the create.
 * - Both actions carry Owner's Requirements through the form's one save
 *   (machine-editing 2.5, 4.1).
 *
 * The PinballMap client and credentials are pinned at the seam
 * (CORE-TEST-006), as in `pinballmap-outbound-write.test.ts`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  machines,
  userProfiles,
  authUsers,
  timelineEvents,
  pinballmapState,
  pinballmapCatalog,
} from "~/server/db/schema";
import type { LocationSnapshot, PbmWriteFailure } from "~/lib/pinballmap/types";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import type * as UserCredentialsModule from "~/lib/pinballmap/user-credentials";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("~/lib/notifications", () => ({
  planNotification: vi.fn().mockResolvedValue({ deliveries: [] }),
  dispatchNotification: vi.fn(),
  getChannels: vi.fn().mockResolvedValue([]),
}));
vi.mock("~/lib/logger", () => ({
  log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
// The creator's linked Pinball Map account (spec 8.2), with the Vault decrypt
// stubbed: PGlite has no vault schema.
vi.mock("~/lib/pinballmap/user-credentials", async (importOriginal) => ({
  ...(await importOriginal<typeof UserCredentialsModule>()),
  getLinkedPinballMapCredentials: vi.fn(),
}));

// What Pinball Map currently shows; `addMachine` mutates it as the real
// service would, so assertions describe Pinball Map's state.
const pbm = vi.hoisted(() => ({
  lineup: [] as { id: number; machineId: number }[],
  nextLmxId: 500,
  addResult: null as PbmWriteFailure | null,
}));

const snapshotOf = vi.hoisted(
  () =>
    (rows: { id: number; machineId: number }[]): LocationSnapshot => ({
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
      fetchedAtIso: "2026-09-28T00:00:00Z",
      raw: {},
    })
);

vi.mock("~/lib/pinballmap/client", () => ({
  getPinballMapClient: () =>
    Promise.resolve({
      fetchLocation: () => Promise.resolve(snapshotOf(pbm.lineup)),
      addMachine: ({ machineId }: { machineId: number }) => {
        if (pbm.addResult) return Promise.resolve(pbm.addResult);
        const id = pbm.nextLmxId;
        pbm.nextLmxId += 1;
        pbm.lineup.push({ id, machineId });
        return Promise.resolve({ ok: true, lmxId: id });
      },
      setIcEnabled: () => Promise.resolve({ ok: true }),
    }),
}));

const TITLE_ID = 7;

async function createAdmin(): Promise<{ id: string }> {
  const db = await getTestDb();
  const id = randomUUID();
  await db.insert(authUsers).values({ id, email: `${id}@example.com` });
  const [user] = await db
    .insert(userProfiles)
    .values({
      id,
      email: `${id}@example.com`,
      firstName: "Test",
      lastName: "Admin",
      role: "admin",
    })
    .returning();
  if (!user) throw new Error("failed to seed user profile");
  const { createClient } = await import("~/lib/supabase/server");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id } } }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return user;
}

async function seedPinballmap(
  opts: {
    icEligible?: boolean;
    lineup?: { id: number; machineId: number }[];
  } = {}
): Promise<void> {
  const db = await getTestDb();
  await db.insert(pinballmapCatalog).values({
    pinballmapMachineId: TITLE_ID,
    name: "Godzilla (Premium)",
    manufacturer: "Stern",
    year: 2021,
    icEligible: opts.icEligible ?? false,
  });
  await db.insert(pinballmapState).values({
    id: "singleton",
    locationId: 26454,
    snapshotJson: snapshotOf(opts.lineup ?? []),
    lastSyncStatus: "ok",
  });
}

function createForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  fd.append("name", "APC Godzilla");
  fd.append("initials", "GZ");
  fd.append("pbmLinkPresent", "1");
  fd.append("pinballmapMachineId", String(TITLE_ID));
  for (const [key, value] of Object.entries(fields)) fd.append(key, value);
  return fd;
}

function doc(text: string): ProseMirrorDoc {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

async function createdMachine(): Promise<typeof machines.$inferSelect> {
  const db = await getTestDb();
  const row = await db.query.machines.findFirst({
    where: eq(machines.initials, "GZ"),
  });
  if (!row) throw new Error("machine was not created");
  return row;
}

async function eventKinds(machineId: string): Promise<unknown[]> {
  const db = await getTestDb();
  const rows = await db
    .select({ eventData: timelineEvents.eventData })
    .from(timelineEvents)
    .where(eq(timelineEvents.machineId, machineId));
  return rows.map((row) => row.eventData);
}

describe("createMachineAction — Pinball Map lineup choice (PGlite)", () => {
  setupTestDb();

  beforeEach(async () => {
    pbm.lineup = [];
    pbm.nextLmxId = 500;
    pbm.addResult = null;
    const { getLinkedPinballMapCredentials } =
      await import("~/lib/pinballmap/user-credentials");
    vi.mocked(getLinkedPinballMapCredentials).mockResolvedValue({
      credentials: { email: "ops@example.com", token: "tok_123" },
      tokenVaultId: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("records intent On and Insider Connected without pushing when not asked", async () => {
    const { createMachineAction } = await import("~/app/(app)/m/actions");
    await createAdmin();
    await seedPinballmap({ icEligible: true });

    const result = await createMachineAction(
      undefined,
      createForm({ pinballmapIntent: "on", pinballmapIcIntent: "on" })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.redirectTo).toBe("/m/GZ");
    const machine = await createdMachine();
    expect(machine.pinballmapIntent).toBe("on");
    expect(machine.pinballmapIcIntent).toBe("on");
    // Nothing was confirmed, so nothing was published.
    expect(pbm.lineup).toEqual([]);
    // The lineup choice lands on the timeline like the toggle's does.
    expect(await eventKinds(machine.id)).toContainEqual({
      kind: "pinballmap_intent",
      intent: "on",
    });
  });

  it("records no Insider Connected intent when the switch is left alone", async () => {
    const { createMachineAction } = await import("~/app/(app)/m/actions");
    await createAdmin();
    await seedPinballmap({ icEligible: true });

    // The form posts pinballmapIcIntent only when the person turned it On.
    const result = await createMachineAction(
      undefined,
      createForm({ pinballmapIntent: "on" })
    );

    expect(result.ok).toBe(true);
    expect((await createdMachine()).pinballmapIcIntent).toBeNull();
  });

  it("adds the machine to Pinball Map after creating when ticked", async () => {
    const { createMachineAction } = await import("~/app/(app)/m/actions");
    await createAdmin();
    await seedPinballmap();

    const result = await createMachineAction(
      undefined,
      createForm({ pinballmapIntent: "on", pbmAddAfterCreate: "1" })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.redirectTo).toBe("/m/GZ");
    expect(pbm.lineup).toEqual([{ id: 500, machineId: TITLE_ID }]);
    const machine = await createdMachine();
    expect(await eventKinds(machine.id)).toContainEqual({
      kind: "pinballmap_listing",
      action: "listed",
      lmxId: 500,
    });
  });

  it("keeps the machine and lands on Manage when the add push fails", async () => {
    const { createMachineAction } = await import("~/app/(app)/m/actions");
    await createAdmin();
    await seedPinballmap();
    pbm.addResult = { ok: false, reason: "rejected", message: "nope" };

    const result = await createMachineAction(
      undefined,
      createForm({ pinballmapIntent: "on", pbmAddAfterCreate: "1" })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.redirectTo).toBe("/m/GZ/edit?pbmAddFailed=1");
    // Created, intent On, entry absent: the Missing state, Add offered again.
    const machine = await createdMachine();
    expect(machine.pinballmapIntent).toBe("on");
    expect(pbm.lineup).toEqual([]);
  });

  it("adds nothing for a title already on the lineup (opened from a lineup entry)", async () => {
    const { createMachineAction } = await import("~/app/(app)/m/actions");
    await createAdmin();
    const entry = { id: 42, machineId: TITLE_ID };
    await seedPinballmap({ lineup: [entry] });
    pbm.lineup = [entry];

    const result = await createMachineAction(
      undefined,
      createForm({ pinballmapIntent: "on", pbmAddAfterCreate: "1" })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The new cabinet covers the existing entry; nothing is written out.
    expect(result.value.redirectTo).toBe("/m/GZ");
    expect(pbm.lineup).toEqual([entry]);
    expect((await createdMachine()).pinballmapIntent).toBe("on");
  });

  it("ignores the add checkbox unless intent is On", async () => {
    const { createMachineAction } = await import("~/app/(app)/m/actions");
    await createAdmin();
    await seedPinballmap();

    const result = await createMachineAction(
      undefined,
      createForm({ pinballmapIntent: "off", pbmAddAfterCreate: "1" })
    );

    expect(result.ok).toBe(true);
    expect(pbm.lineup).toEqual([]);
    expect((await createdMachine()).pinballmapIntent).toBe("off");
  });

  it("refuses intent On while Availability forbids the lineup", async () => {
    const { createMachineAction } = await import("~/app/(app)/m/actions");
    await createAdmin();
    await seedPinballmap();

    const result = await createMachineAction(
      undefined,
      createForm({
        pinballmapIntent: "on",
        presenceStatus: "removed",
        pbmAddAfterCreate: "1",
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe("Blocked by Availability: Removed");
    const db = await getTestDb();
    expect(
      await db.query.machines.findFirst({ where: eq(machines.initials, "GZ") })
    ).toBeUndefined();
    expect(pbm.lineup).toEqual([]);
  });

  it("refuses intent without a catalog title", async () => {
    const { createMachineAction } = await import("~/app/(app)/m/actions");
    await createAdmin();
    await seedPinballmap();
    const fd = new FormData();
    fd.append("name", "Homebrew");
    fd.append("initials", "HB");
    fd.append("pbmLinkPresent", "1");
    fd.append("pinballmapExcluded", "on");
    fd.append("pinballmapIntent", "on");

    const result = await createMachineAction(undefined, fd);

    expect(result.ok).toBe(false);
  });

  it("refuses Insider Connected for a title Pinball Map does not offer it on", async () => {
    const { createMachineAction } = await import("~/app/(app)/m/actions");
    await createAdmin();
    await seedPinballmap({ icEligible: false });

    const result = await createMachineAction(
      undefined,
      createForm({ pinballmapIcIntent: "on" })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe(
      "Pinball Map doesn't offer Insider Connected for this game."
    );
  });
});

describe("Owner's Requirements through the machine form (PGlite)", () => {
  setupTestDb();

  it("stores Owner's Requirements entered on New Machine", async () => {
    const { createMachineAction } = await import("~/app/(app)/m/actions");
    await createAdmin();
    await seedPinballmap();

    const result = await createMachineAction(
      undefined,
      createForm({ ownerRequirements: JSON.stringify(doc("No tilt bob")) })
    );

    expect(result.ok).toBe(true);
    expect((await createdMachine()).ownerRequirements).toEqual(
      doc("No tilt bob")
    );
  });

  it("saves them from Manage, and puts only a real change on the timeline", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    await createAdmin();
    const [machine] = await db
      .insert(machines)
      .values({ name: "Godzilla", initials: "GZ" })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    const save = async (text: string): Promise<void> => {
      const fd = new FormData();
      fd.append("id", machine.id);
      fd.append("name", "Godzilla");
      fd.append("ownerRequirements", JSON.stringify(doc(text)));
      const result = await updateMachineAction(undefined, fd);
      expect(result.ok).toBe(true);
    };
    const markerCount = async (): Promise<number> =>
      (
        await db
          .select()
          .from(timelineEvents)
          .where(and(eq(timelineEvents.machineId, machine.id)))
      ).filter(
        (row) =>
          JSON.stringify(row.eventData) ===
          JSON.stringify({ kind: "owner_requirements_updated" })
      ).length;

    await save("Keep the glass clean");
    expect((await createdMachine()).ownerRequirements).toEqual(
      doc("Keep the glass clean")
    );
    expect(await markerCount()).toBe(1);

    // The same text again is not a change.
    await save("Keep the glass clean");
    expect(await markerCount()).toBe(1);
  });

  it("an untouched save after a mentioned person's rename is not an edit (PP-0fg0.2)", async () => {
    const db = await getTestDb();
    const { updateMachineAction } = await import("~/app/(app)/m/actions");
    const { getMachineForLayout } =
      await import("~/app/(app)/m/[initials]/_data");
    const admin = await createAdmin();
    const mentioning = (text: string): ProseMirrorDoc => ({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text },
            { type: "mention", attrs: { id: admin.id, label: "Test Admin" } },
          ],
        },
      ],
    });
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        description: mentioning("Owned by "),
        ownerRequirements: mentioning("Ask "),
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");
    await db
      .update(userProfiles)
      .set({ firstName: "Renamed" })
      .where(eq(userProfiles.id, admin.id));

    // The Manage form opens on the loader's docs, which carry the new name,
    // and posts them back untouched.
    const opened = (await getMachineForLayout("GZ")).machine;
    const fd = new FormData();
    fd.append("id", machine.id);
    fd.append("name", "Godzilla");
    fd.append("description", JSON.stringify(opened?.description));
    fd.append("ownerRequirements", JSON.stringify(opened?.ownerRequirements));
    expect((await updateMachineAction(undefined, fd)).ok).toBe(true);

    const after = await createdMachine();
    expect(after.description).toEqual(mentioning("Owned by "));
    expect(after.ownerRequirements).toEqual(mentioning("Ask "));
    expect(await eventKinds(machine.id)).not.toContainEqual({
      kind: "owner_requirements_updated",
    });
  });
});

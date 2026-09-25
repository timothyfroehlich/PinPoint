/**
 * Integration Test: Pinball Map comments in covering timelines (PP-o355.4)
 *
 * Pinball Map spec §7:
 *  - 7.1 every intent-On same-title cabinet gets one copy; Off and Don't sync
 *    get none; repeated imports never duplicate a copy.
 *  - 7.4 the location's first import is a silent backfill; a comment first
 *    observed after it is new, but a cabinet that only just turned On gets
 *    history, not news.
 *  - 7.6 each copy knows the other cabinets carrying it.
 *  - 7.5 / 7.8 / 7.9 one conversion across every copy, and the copies follow
 *    the issue when it moves.
 *
 * Everything reads the stored snapshot; no Pinball Map client is involved.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  authUsers,
  issues,
  machines,
  pinballmapComments,
  pinballmapState,
  timelineEvents,
  userProfiles,
} from "~/server/db/schema";
import type { CommentImportResult } from "~/lib/pinballmap/comment-import";
import type { LocationSnapshot, PbmCondition } from "~/lib/pinballmap/types";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: vi.fn(),
}));

const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
);
vi.mock("next/navigation", () => ({ redirect }));

const LOCATION_ID = 26454;
const TITLE = 42; // the shared title
const OTHER_TITLE = 77;

interface Entry {
  lmxId: number;
  machineId: number;
  conditions: PbmCondition[];
}

function condition(id: number, comment: string): PbmCondition {
  return {
    id,
    comment,
    username: "pbm_user",
    createdAtIso: new Date(Date.UTC(2026, 0, id)).toISOString(),
  };
}

function snapshotFor(locationId: number, entries: Entry[]): LocationSnapshot {
  return {
    locationId,
    name: "APC",
    dateLastUpdated: null,
    lastUpdatedByUsername: null,
    machineCount: entries.length,
    lmxes: entries.map((e) => ({
      id: e.lmxId,
      machineId: e.machineId,
      icEnabled: null,
      lastUpdatedByUsername: null,
      conditions: e.conditions,
    })),
    fetchedAtIso: new Date().toISOString(),
    raw: { mock: true },
  };
}

async function seedState(
  entries: Entry[],
  opts: { locationId?: number | null; snapshotLocationId?: number } = {}
): Promise<void> {
  const db = await getTestDb();
  const locationId =
    opts.locationId === undefined ? LOCATION_ID : opts.locationId;
  await db
    .insert(pinballmapState)
    .values({
      id: "singleton",
      locationId,
      snapshotJson: snapshotFor(
        opts.snapshotLocationId ?? locationId ?? LOCATION_ID,
        entries
      ),
      lastSyncedAt: new Date(),
      lastSyncStatus: "ok",
    })
    .onConflictDoUpdate({
      target: pinballmapState.id,
      set: {
        locationId,
        snapshotJson: snapshotFor(
          opts.snapshotLocationId ?? locationId ?? LOCATION_ID,
          entries
        ),
      },
    });
}

async function seedMachine(
  initials: string,
  pinballmapMachineId: number,
  pinballmapIntent: "on" | "off" | "no_sync"
): Promise<{ id: string; initials: string }> {
  const db = await getTestDb();
  const [machine] = await db
    .insert(machines)
    .values({
      name: `${initials} cabinet`,
      initials,
      pinballmapMachineId,
      pinballmapIntent,
    })
    .returning({ id: machines.id, initials: machines.initials });
  if (!machine) throw new Error("seed failed");
  return machine;
}

async function createUser(role: "guest" | "member"): Promise<string> {
  const db = await getTestDb();
  const id = randomUUID();
  await db.insert(authUsers).values({ id, email: `${id}@example.com` });
  await db.insert(userProfiles).values({
    id,
    email: `${id}@example.com`,
    firstName: "Test",
    lastName: "User",
    role,
  });
  return id;
}

async function mockAuthAs(userId: string | null): Promise<void> {
  const { createClient } = await import("~/lib/supabase/server");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: userId ? { id: userId } : null } }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

async function copiesFor(machineId: string): Promise<number[]> {
  const db = await getTestDb();
  const rows = await db
    .select({ eventData: timelineEvents.eventData })
    .from(timelineEvents)
    .where(
      and(
        eq(timelineEvents.machineId, machineId),
        eq(timelineEvents.sourceType, "pinballmap")
      )
    );
  return rows
    .flatMap((r) =>
      r.eventData?.kind === "pinballmap_comment"
        ? [r.eventData.conditionId]
        : []
    )
    .sort((a, b) => a - b);
}

async function importComments(): Promise<CommentImportResult> {
  const { importPinballMapComments } =
    await import("~/lib/pinballmap/comment-import");
  return importPinballMapComments();
}

beforeEach(() => {
  redirect.mockClear();
});

describe("importPinballMapComments (PGlite)", () => {
  setupTestDb();

  it("fans each comment out to every intent-On same-title cabinet and nowhere else", async () => {
    const onA = await seedMachine("SHA", TITLE, "on");
    const onB = await seedMachine("SHB", TITLE, "on");
    const off = await seedMachine("SHC", TITLE, "off");
    const noSync = await seedMachine("SHD", TITLE, "no_sync");
    const otherTitle = await seedMachine("OTH", OTHER_TITLE, "on");
    await seedState([
      {
        lmxId: 900,
        machineId: TITLE,
        conditions: [condition(1, "left flipper weak"), condition(2, "fixed")],
      },
      { lmxId: 901, machineId: OTHER_TITLE, conditions: [] },
    ]);

    const result = await importComments();

    expect(result.backfill).toBe(true);
    expect(result.commentsObserved).toBe(2);
    expect(result.copies).toHaveLength(4);
    expect(await copiesFor(onA.id)).toEqual([1, 2]);
    expect(await copiesFor(onB.id)).toEqual([1, 2]);
    expect(await copiesFor(off.id)).toEqual([]);
    expect(await copiesFor(noSync.id)).toEqual([]);
    expect(await copiesFor(otherTitle.id)).toEqual([]);
  });

  it("dates each copy with the comment's own Pinball Map timestamp", async () => {
    const db = await getTestDb();
    const machine = await seedMachine("DTE", TITLE, "on");
    await seedState([
      { lmxId: 900, machineId: TITLE, conditions: [condition(5, "tilt bob")] },
    ]);

    await importComments();

    const [row] = await db
      .select({ createdAt: timelineEvents.createdAt, tag: timelineEvents.tag })
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(row?.createdAt.toISOString()).toBe(
      new Date(Date.UTC(2026, 0, 5)).toISOString()
    );
    expect(row?.tag).toBe("pinballmap");
  });

  it("never duplicates a copy across repeated imports", async () => {
    const machine = await seedMachine("DUP", TITLE, "on");
    await seedState([
      { lmxId: 900, machineId: TITLE, conditions: [condition(1, "a")] },
    ]);

    await importComments();
    const second = await importComments();

    expect(second.copies).toEqual([]);
    expect(second.commentsObserved).toBe(0);
    expect(await copiesFor(machine.id)).toEqual([1]);
  });

  it("treats the first import as a silent backfill and later comments as new, per covering cabinet", async () => {
    const db = await getTestDb();
    const a = await seedMachine("NWA", TITLE, "on");
    const b = await seedMachine("NWB", TITLE, "on");
    await seedState([
      { lmxId: 900, machineId: TITLE, conditions: [condition(1, "old")] },
    ]);

    const backfill = await importComments();
    expect(backfill.copies.every((c) => !c.isNew)).toBe(true);
    const [state] = await db
      .select({ baseline: pinballmapState.commentsBaselineLocationId })
      .from(pinballmapState);
    expect(state?.baseline).toBe(LOCATION_ID);

    await seedState([
      {
        lmxId: 900,
        machineId: TITLE,
        conditions: [condition(1, "old"), condition(2, "new")],
      },
    ]);
    const next = await importComments();

    expect(next.backfill).toBe(false);
    expect(
      next.copies.map((c) => [c.machineId, c.conditionId, c.isNew]).sort()
    ).toEqual(
      [
        [a.id, 2, true],
        [b.id, 2, true],
      ].sort()
    );
  });

  it("gives a cabinet that later turns On the entry's history, not news", async () => {
    const db = await getTestDb();
    const covering = await seedMachine("LTA", TITLE, "on");
    const later = await seedMachine("LTB", TITLE, "off");
    await seedState([
      { lmxId: 900, machineId: TITLE, conditions: [condition(1, "old")] },
    ]);
    await importComments();
    expect(await copiesFor(later.id)).toEqual([]);

    await db
      .update(machines)
      .set({ pinballmapIntent: "on" })
      .where(eq(machines.id, later.id));
    const result = await importComments();

    expect(result.copies).toEqual([
      { machineId: later.id, conditionId: 1, isNew: false },
    ]);
    expect(await copiesFor(covering.id)).toEqual([1]);
  });

  it("keeps imported copies when a cabinet later leaves coverage", async () => {
    const db = await getTestDb();
    const machine = await seedMachine("KPA", TITLE, "on");
    await seedState([
      { lmxId: 900, machineId: TITLE, conditions: [condition(1, "old")] },
    ]);
    await importComments();

    await db
      .update(machines)
      .set({ pinballmapIntent: "no_sync" })
      .where(eq(machines.id, machine.id));
    await importComments();

    expect(await copiesFor(machine.id)).toEqual([1]);
  });

  it("imports into a cabinet the moment the intent toggle turns it On", async () => {
    const machine = await seedMachine("TGL", TITLE, "off");
    const admin = await createUser("member");
    const db = await getTestDb();
    await db
      .update(userProfiles)
      .set({ role: "admin" })
      .where(eq(userProfiles.id, admin));
    await mockAuthAs(admin);
    await seedState([
      { lmxId: 900, machineId: TITLE, conditions: [condition(1, "old")] },
    ]);

    const { setPinballmapIntentAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const fd = new FormData();
    fd.set("machineId", machine.id);
    fd.set("intent", "on");
    const res = await setPinballmapIntentAction(undefined, fd);

    expect(res.ok).toBe(true);
    expect(await copiesFor(machine.id)).toEqual([1]);
  });

  it("is a no-op while not configured or when the snapshot belongs to another location", async () => {
    const machine = await seedMachine("NOP", TITLE, "on");
    const entries = [
      { lmxId: 900, machineId: TITLE, conditions: [condition(1, "a")] },
    ];

    await seedState(entries, { locationId: null });
    expect((await importComments()).copies).toEqual([]);

    await seedState(entries, { snapshotLocationId: 99999 });
    expect((await importComments()).copies).toEqual([]);

    expect(await copiesFor(machine.id)).toEqual([]);
  });

  it("runs a fresh silent backfill after the tracked location changes", async () => {
    const machine = await seedMachine("MOV", TITLE, "on");
    await seedState([
      { lmxId: 900, machineId: TITLE, conditions: [condition(1, "a")] },
    ]);
    await importComments();

    await seedState(
      [{ lmxId: 950, machineId: TITLE, conditions: [condition(7, "b")] }],
      { locationId: 30000 }
    );
    const result = await importComments();

    expect(result.backfill).toBe(true);
    expect(result.copies).toEqual([
      { machineId: machine.id, conditionId: 7, isNew: false },
    ]);
  });
});

describe("imported comments on the timeline (PGlite)", () => {
  setupTestDb();

  it("resolves the comment, its attribution location, and the other cabinets carrying it", async () => {
    const db = await getTestDb();
    const a = await seedMachine("RDA", TITLE, "on");
    const b = await seedMachine("RDB", TITLE, "on");
    await seedState([
      {
        lmxId: 900,
        machineId: TITLE,
        conditions: [condition(3, "shooter lane stuck")],
      },
    ]);
    await importComments();

    const { getMachineTimeline } =
      await import("~/lib/timeline/machine-events");
    const rows = await getMachineTimeline(asDbOrTx(db), { machineId: a.id });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.pinballmapComment).toEqual({
      conditionId: 3,
      comment: "shooter lane stuck",
      username: "pbm_user",
      locationId: LOCATION_ID,
      convertedIssue: null,
      otherCopies: [{ name: "RDB cabinet", initials: "RDB" }],
    });
    const [bRow] = await getMachineTimeline(asDbOrTx(db), { machineId: b.id });
    expect(bRow?.pinballmapComment?.otherCopies).toEqual([
      { name: "RDA cabinet", initials: "RDA" },
    ]);
  });
});

describe("converting an imported comment to an issue (PGlite)", () => {
  setupTestDb();

  async function seedShared(): Promise<{
    a: { id: string; initials: string };
    b: { id: string; initials: string };
  }> {
    const a = await seedMachine("CVA", TITLE, "on");
    const b = await seedMachine("CVB", TITLE, "on");
    await seedState([
      {
        lmxId: 900,
        machineId: TITLE,
        conditions: [condition(4, "Left flipper is weak\nneeds a coil")],
      },
    ]);
    await importComments();
    return { a, b };
  }

  function convertFd(
    machineId: string,
    overrides: Partial<Record<string, string>> = {}
  ): FormData {
    const fd = new FormData();
    fd.set("machineId", machineId);
    fd.set("conditionId", "4");
    fd.set("title", "Left flipper is weak");
    fd.set("severity", "minor");
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined) fd.set(k, v);
    }
    return fd;
  }

  it("creates one issue, quotes the comment, and links every copy to it", async () => {
    const db = await getTestDb();
    const { a, b } = await seedShared();
    const member = await createUser("member");
    await mockAuthAs(member);
    const { convertPinballMapCommentAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/timeline/pinballmap-comment-actions");

    await expect(
      convertPinballMapCommentAction(undefined, convertFd(a.id))
    ).rejects.toThrow("NEXT_REDIRECT:/m/CVA/i/1");

    const created = await db.query.issues.findFirst({
      where: eq(issues.machineInitials, "CVA"),
    });
    expect(created?.title).toBe("Left flipper is weak");
    expect(created?.severity).toBe("minor");
    expect(created?.reportedBy).toBe(member);
    expect(JSON.stringify(created?.description)).toContain(
      "Left flipper is weak"
    );
    expect(JSON.stringify(created?.description)).toContain(
      `by_location_id=${String(LOCATION_ID)}`
    );

    const { getMachineTimeline } =
      await import("~/lib/timeline/machine-events");
    for (const machine of [a, b]) {
      const rows = await getMachineTimeline(asDbOrTx(db), {
        machineId: machine.id,
      });
      const copy = rows.find((r) => r.sourceType === "pinballmap");
      expect(copy?.pinballmapComment?.convertedIssue).toEqual({
        machineInitials: "CVA",
        issueNumber: 1,
        title: "Left flipper is weak",
      });
    }
  });

  it("refuses a second conversion from a sibling copy and writes nothing", async () => {
    const db = await getTestDb();
    const { a, b } = await seedShared();
    const member = await createUser("member");
    await mockAuthAs(member);
    const { convertPinballMapCommentAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/timeline/pinballmap-comment-actions");

    await expect(
      convertPinballMapCommentAction(undefined, convertFd(a.id))
    ).rejects.toThrow("NEXT_REDIRECT");
    const second = await convertPinballMapCommentAction(
      undefined,
      convertFd(b.id)
    );

    expect(second).toMatchObject({ ok: false, code: "ALREADY_CONVERTED" });
    const onB = await db.query.issues.findMany({
      where: eq(issues.machineInitials, "CVB"),
    });
    expect(onB).toEqual([]);
  });

  it("claims the comment at most once even when the pre-check is bypassed", async () => {
    const db = await getTestDb();
    await seedShared();
    const member = await createUser("member");
    const { createIssue, PinballMapCommentAlreadyConvertedError } =
      await import("~/services/issues");

    await createIssue({
      title: "first",
      machineInitials: "CVA",
      severity: "minor",
      reportedBy: member,
      pinballmapConditionId: 4,
    });
    await expect(
      createIssue({
        title: "second",
        machineInitials: "CVB",
        severity: "minor",
        reportedBy: member,
        pinballmapConditionId: 4,
      })
    ).rejects.toBeInstanceOf(PinballMapCommentAlreadyConvertedError);

    // The losing attempt rolled back its issue and its number reservation.
    const machineB = await db.query.machines.findFirst({
      where: eq(machines.initials, "CVB"),
    });
    expect(machineB?.nextIssueNumber).toBe(1);
    const [comment] = await db
      .select({ issueId: pinballmapComments.convertedIssueId })
      .from(pinballmapComments);
    const first = await db.query.issues.findFirst({
      where: eq(issues.title, "first"),
    });
    expect(comment?.issueId).toBe(first?.id);
  });

  it("follows the issue when it is moved to another machine", async () => {
    const db = await getTestDb();
    const { a, b } = await seedShared();
    const member = await createUser("member");
    const { createIssue, reassignIssueMachine } =
      await import("~/services/issues");
    const { issue } = await createIssue({
      title: "wrong cabinet",
      machineInitials: "CVA",
      severity: "minor",
      reportedBy: member,
      pinballmapConditionId: 4,
    });

    await reassignIssueMachine({
      issueId: issue.id,
      newMachineInitials: "CVB",
      userId: member,
    });

    const { getMachineTimeline } =
      await import("~/lib/timeline/machine-events");
    const rows = await getMachineTimeline(asDbOrTx(db), { machineId: a.id });
    const copy = rows.find((r) => r.sourceType === "pinballmap");
    expect(copy?.pinballmapComment?.convertedIssue?.machineInitials).toBe(
      "CVB"
    );
    expect(b.initials).toBe("CVB");
  });

  it("refuses a comment that has no copy on the requested machine", async () => {
    const { a } = await seedShared();
    const stranger = await seedMachine("STR", OTHER_TITLE, "on");
    const member = await createUser("member");
    await mockAuthAs(member);
    const { convertPinballMapCommentAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/timeline/pinballmap-comment-actions");

    const res = await convertPinballMapCommentAction(
      undefined,
      convertFd(stranger.id)
    );

    expect(res).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(a.initials).toBe("CVA");
  });

  it("requires a signed-in person and a severity", async () => {
    const { a } = await seedShared();
    const { convertPinballMapCommentAction } =
      await import("~/app/(app)/m/[initials]/(tabs)/timeline/pinballmap-comment-actions");

    await mockAuthAs(null);
    expect(
      await convertPinballMapCommentAction(undefined, convertFd(a.id))
    ).toMatchObject({ ok: false, code: "UNAUTHORIZED" });

    await mockAuthAs(await createUser("member"));
    expect(
      await convertPinballMapCommentAction(
        undefined,
        convertFd(a.id, { severity: "" })
      )
    ).toMatchObject({ ok: false, code: "VALIDATION" });
  });
});

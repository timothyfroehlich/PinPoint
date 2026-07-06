import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { userProfiles, machines } from "~/server/db/schema";
import { createTestUser, createTestMachine } from "~/test/helpers/factories";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

vi.mock("server-only", () => ({}));
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

const { getMachineTimeline, createMachineComment } =
  await import("~/lib/timeline/machine-events");

const ALICE = "00000000-0000-0000-0000-00000000a001";
const BOB = "00000000-0000-0000-0000-00000000b002";
const doc = (t: string): ProseMirrorDoc => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
});

describe("getMachineTimeline author scope", () => {
  setupTestDb();
  let m1 = "";
  let m2 = "";

  beforeEach(async () => {
    const db = await getTestDb();
    await db
      .insert(userProfiles)
      .values([
        createTestUser({ id: ALICE, firstName: "Alice", lastName: "A" }),
        createTestUser({ id: BOB, firstName: "Bob", lastName: "B" }),
      ]);
    const [a] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "AA", name: "Game A" }))
      .returning({ id: machines.id });
    const [b] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "BB", name: "Game B" }))
      .returning({ id: machines.id });
    m1 = a.id;
    m2 = b.id;
    // Alice notes on two machines; Bob notes on one.
    await createMachineComment(
      m1,
      { content: doc("alice on A"), tag: "note", authorId: ALICE },
      db
    );
    await createMachineComment(
      m2,
      { content: doc("alice on B"), tag: "note", authorId: ALICE },
      db
    );
    await createMachineComment(
      m1,
      { content: doc("bob on A"), tag: "note", authorId: BOB },
      db
    );
  });

  it("returns only the author's events, across machines", async () => {
    const db = await getTestDb();
    const rows = await getMachineTimeline(db, { authorId: ALICE });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.authorId === ALICE)).toBe(true);
    expect(new Set(rows.map((r) => r.machineId))).toEqual(new Set([m1, m2]));
  });

  it("machineId scope still works unchanged", async () => {
    const db = await getTestDb();
    const rows = await getMachineTimeline(db, { machineId: m1 });
    expect(rows).toHaveLength(2); // alice + bob on A
  });

  it("returns [] when no scope is given", async () => {
    const db = await getTestDb();
    const rows = await getMachineTimeline(db, {});
    expect(rows).toEqual([]);
  });
});

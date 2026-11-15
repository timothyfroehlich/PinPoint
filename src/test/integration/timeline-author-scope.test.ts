import { describe, it, expect, beforeEach, vi } from "vitest";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import { seedMachine, seedUser } from "~/test/helpers/seed";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

vi.mock("server-only", () => ({}));

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
    const seedOpts = { authUser: false };
    await seedUser({ id: ALICE, firstName: "Alice", lastName: "A" }, seedOpts);
    await seedUser({ id: BOB, firstName: "Bob", lastName: "B" }, seedOpts);
    m1 = (await seedMachine({ initials: "AA", name: "Game A" })).id;
    m2 = (await seedMachine({ initials: "BB", name: "Game B" })).id;
    // Alice notes on two machines; Bob notes on one.
    await createMachineComment(
      m1,
      { content: doc("alice on A"), tag: "note", authorId: ALICE },
      asDbOrTx(db)
    );
    await createMachineComment(
      m2,
      { content: doc("alice on B"), tag: "note", authorId: ALICE },
      asDbOrTx(db)
    );
    await createMachineComment(
      m1,
      { content: doc("bob on A"), tag: "note", authorId: BOB },
      asDbOrTx(db)
    );
  });

  it("returns only the author's events, across machines", async () => {
    const db = await getTestDb();
    const rows = await getMachineTimeline(asDbOrTx(db), { authorId: ALICE });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.authorId === ALICE)).toBe(true);
    expect(new Set(rows.map((r) => r.machineId))).toEqual(new Set([m1, m2]));
  });

  it("machineId scope still works unchanged", async () => {
    const db = await getTestDb();
    const rows = await getMachineTimeline(asDbOrTx(db), { machineId: m1 });
    expect(rows).toHaveLength(2); // alice + bob on A
  });

  it("returns [] when no scope is given", async () => {
    const db = await getTestDb();
    const rows = await getMachineTimeline(asDbOrTx(db), {});
    expect(rows).toEqual([]);
  });
});

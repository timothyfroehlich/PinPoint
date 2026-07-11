import { describe, it, expect, beforeEach, vi } from "vitest";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import { userProfiles, machines } from "~/server/db/schema";
import { createTestUser, createTestMachine } from "~/test/helpers/factories";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

vi.mock("server-only", () => ({}));
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

const { getUserTimeline, resolveFeedMachineLabels } =
  await import("~/lib/profiles/queries");
const { createMachineComment } = await import("~/lib/timeline/machine-events");

const USER = "00000000-0000-0000-0000-00000000c001";
const doc = (t: string): ProseMirrorDoc => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
});

describe("profile feed queries", () => {
  setupTestDb();
  let m1 = "";

  beforeEach(async () => {
    const db = await getTestDb();
    await db
      .insert(userProfiles)
      .values(createTestUser({ id: USER, firstName: "Cam", lastName: "C" }));
    const [a] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "CC", name: "Game C" }))
      .returning({ id: machines.id });
    m1 = a.id;
    for (let i = 0; i < 3; i++) {
      await createMachineComment(
        m1,
        { content: doc(`n${i}`), tag: "note", authorId: USER },
        asDbOrTx(db)
      );
    }
  });

  it("getUserTimeline returns the user's events, capped by limit", async () => {
    const rows = await getUserTimeline(USER, { limit: 2 });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.authorId === USER)).toBe(true);
  });

  it("resolveFeedMachineLabels maps machineId -> name/href/initials", async () => {
    const rows = await getUserTimeline(USER, { limit: 8 });
    const labels = await resolveFeedMachineLabels(rows);
    expect(labels.get(m1)).toEqual({
      name: "Game C",
      href: "/m/CC",
      initials: "CC",
    });
  });
});

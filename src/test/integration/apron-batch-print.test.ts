/**
 * Integration Test: the cards the Print apron cards page lists (PP-qab5)
 *
 * Worker-scoped PGlite (CORE-TEST-001). Covers which saved cards the batch
 * page offers and in what order (apron-cards spec §12.2), and that each card
 * prints the same credits and PinTips line as a one-card export (§10.1) when
 * those are read for every machine at once, and that an @mention prints the
 * person's current name, as the Apron card tab's preview does.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  machineApronCards,
  machines,
  opdbMachines,
  pinTips,
  pinballmapCatalog,
  userProfiles,
} from "~/server/db/schema";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

const { getPrintableApronCards } =
  await import("~/app/(app)/m/apron-cards/_data");

describe("getPrintableApronCards", () => {
  setupTestDb();

  async function addMachine(
    overrides: Parameters<typeof createTestMachine>[0]
  ): Promise<string> {
    const db = await getTestDb();
    const machine = createTestMachine(overrides);
    await db.insert(machines).values(machine);
    return machine.id;
  }

  async function addCard(
    machineId: string,
    name: string,
    createdAt: Date
  ): Promise<void> {
    const db = await getTestDb();
    await db
      .insert(machineApronCards)
      .values({ machineId, name, size: "wpc", createdAt });
  }

  beforeEach(async () => {
    const db = await getTestDb();
    await db.insert(pinballmapCatalog).values({
      pinballmapMachineId: 501,
      name: "Medieval Madness",
      manufacturer: "Williams",
      opdbId: "GweeP-Ml9pZ",
    });
    await db.insert(opdbMachines).values({
      opdbId: "GweeP-Ml9pZ",
      name: "Medieval Madness",
      people: [
        { personId: 1, name: "Brian Eddy", role: "design", index: 0 },
        { personId: 2, name: "John Youssi", role: "art", index: 0 },
      ],
    });
    await db.insert(pinTips).values({
      tipId: 1,
      opdbGroupId: "GweeP",
      category: "general",
      voteTotal: 3,
      text: "Hit the castle.",
    });
  });

  it("lists every saved card of machines that are not Removed, by machine name then creation", async () => {
    const zeta = await addMachine({ initials: "ZZ", name: "Zeta" });
    const alpha = await addMachine({ initials: "AA", name: "Alpha" });
    const removed = await addMachine({
      initials: "RM",
      name: "Removed One",
      presenceStatus: "removed",
    });
    await addMachine({ initials: "NC", name: "No Cards" });
    await addCard(zeta, "Main card", new Date("2026-10-01"));
    await addCard(alpha, "Rules", new Date("2026-10-02"));
    await addCard(alpha, "Main card", new Date("2026-10-01"));
    await addCard(removed, "Main card", new Date("2026-10-01"));

    const cards = await getPrintableApronCards();

    expect(cards.map((c) => [c.machineInitials, c.cardName])).toEqual([
      ["AA", "Main card"],
      ["AA", "Rules"],
      ["ZZ", "Main card"],
    ]);
  });

  it("prints catalog credits and PinTips for a linked machine and hand-entered credits for an uncataloged one", async () => {
    const linked = await addMachine({
      initials: "MM",
      name: "Medieval Madness",
      pinballmapMachineId: 501,
    });
    const uncataloged = await addMachine({
      initials: "HM",
      name: "Homebrew",
      pinballmapExcluded: true,
      designers: ["Pat Builder"],
      artists: null,
    });
    await addCard(linked, "Main card", new Date("2026-10-01"));
    await addCard(uncataloged, "Main card", new Date("2026-10-01"));

    const cards = await getPrintableApronCards();
    const byInitials = new Map(cards.map((c) => [c.machineInitials, c]));

    expect(byInitials.get("MM")?.content).toMatchObject({
      credits: { design: ["Brian Eddy"], art: ["John Youssi"] },
      hasPinTips: true,
    });
    expect(byInitials.get("HM")?.content).toMatchObject({
      credits: { design: ["Pat Builder"], art: [] },
      hasPinTips: false,
    });
  });
  it("prints each @mention under the person's current name", async () => {
    const db = await getTestDb();
    const person = createTestUser({ firstName: "Alexis", lastName: "Rivera" });
    await db.insert(userProfiles).values(person);
    const mention = (text: string): ProseMirrorDoc => ({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: `${text} ` },
            { type: "mention", attrs: { id: person.id, label: "Alex Old" } },
          ],
        },
      ],
    });
    const machineId = await addMachine({
      initials: "AF",
      name: "Attack From Mars",
      description: mention("Ask"),
    });
    await db.insert(machineApronCards).values({
      machineId,
      name: "Main card",
      size: "wpc",
      tip: mention("Tip from"),
      tipEnabled: true,
    });

    const [card] = await getPrintableApronCards();
    const printed = JSON.stringify(card?.content);

    expect(printed).toContain("@Alexis Rivera");
    expect(printed).not.toContain("Alex Old");
  });
});

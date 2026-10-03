/**
 * Integration Test: the Apron card tab's save action (PP-o23o)
 *
 * Worker-scoped PGlite (CORE-TEST-001). Covers the permission split for
 * changing cards (apron-cards spec §3.6, §11.7: owner, technician, or admin —
 * the `machines.edit` capability), payload rejection (§4.3 size, §11.2 unique
 * names), and that one save adds, updates, renames, and deletes cards together
 * (§11.6).
 */

import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import {
  authUsers,
  machineApronCards,
  machines,
  userProfiles,
} from "~/server/db/schema";
import { docToPlainText, plainTextToDoc } from "~/lib/tiptap/types";
import { saveApronCardsAction } from "~/app/(app)/m/[initials]/(tabs)/apron/actions";
import type { SavedApronCardInput } from "~/app/(app)/m/[initials]/(tabs)/apron/schemas";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("saveApronCardsAction (PP-o23o)", () => {
  setupTestDb();

  async function makeUser(
    role: "guest" | "member" | "technician" | "admin"
  ): Promise<string> {
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

  let machineCounter = 0;
  async function makeMachine(ownerId: string | null): Promise<string> {
    const db = await getTestDb();
    machineCounter += 1;
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Test Machine",
        initials: `AP${String(machineCounter).padStart(3, "0")}`,
        ownerId,
      })
      .returning({ id: machines.id });
    if (!machine) throw new Error("machine insert failed");
    return machine.id;
  }

  async function mockAuth(userId: string | null): Promise<void> {
    const { createClient } = await import("~/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: userId ? { id: userId } : null },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  }

  async function savedCards(machineId: string) {
    const db = await getTestDb();
    return db.query.machineApronCards.findMany({
      where: eq(machineApronCards.machineId, machineId),
      orderBy: [asc(machineApronCards.createdAt), asc(machineApronCards.id)],
    });
  }

  function card(name: string, patch: Partial<SavedApronCardInput> = {}) {
    return {
      name,
      size: "stern" as const,
      useCustomDescription: true,
      description: plainTextToDoc("Shoot the ramps."),
      tip: plainTextToDoc("Extra ball at 3 modes."),
      tipEnabled: true,
      designEnabled: false,
      artEnabled: true,
      ...patch,
    };
  }

  async function save(
    machineId: string,
    cards: SavedApronCardInput[],
    deletedIds: string[] = []
  ) {
    return saveApronCardsAction({ machineId, cards, deletedIds });
  }

  /** Saves `names` as new cards and returns them as stored. */
  async function seedCards(machineId: string, names: string[]) {
    const result = await save(
      machineId,
      names.map((name) => card(name))
    );
    if (!result.ok) throw new Error(result.message);
    return result.value.cards;
  }

  it("lets the machine's owner save every card field", async () => {
    const owner = await makeUser("member");
    const machineId = await makeMachine(owner);
    await mockAuth(owner);

    const result = await save(machineId, [card("Card 1")]);
    expect(result.ok).toBe(true);

    const [stored, ...rest] = await savedCards(machineId);
    expect(rest).toHaveLength(0);
    expect(stored).toMatchObject({
      name: "Card 1",
      size: "stern",
      useCustomDescription: true,
      tipEnabled: true,
      designEnabled: false,
      artEnabled: true,
    });
    expect(docToPlainText(stored?.description)).toBe("Shoot the ramps.");
    expect(docToPlainText(stored?.tip)).toBe("Extra ball at 3 modes.");
  });

  it("adds, updates, and deletes cards in one save, keeping their order", async () => {
    const owner = await makeUser("member");
    const machineId = await makeMachine(owner);
    await mockAuth(owner);
    const [first, second] = await seedCards(machineId, ["Card 1", "Card 2"]);
    if (!first || !second) throw new Error("seed failed");

    const result = await save(
      machineId,
      [
        card("Card 1", { id: first.id, size: "wpc", tip: null }),
        card("Tournament"),
        card("Kids night"),
      ],
      [second.id]
    );
    expect(result.ok).toBe(true);

    const stored = await savedCards(machineId);
    expect(stored.map((c) => c.name)).toEqual([
      "Card 1",
      "Tournament",
      "Kids night",
    ]);
    expect(stored[0]).toMatchObject({ id: first.id, size: "wpc", tip: null });
    if (result.ok) {
      expect(result.value.cards.map((c) => c.name)).toEqual(
        stored.map((c) => c.name)
      );
    }
  });

  it("swaps two cards' names in one save (§11.5)", async () => {
    const owner = await makeUser("member");
    const machineId = await makeMachine(owner);
    await mockAuth(owner);
    const [a, b] = await seedCards(machineId, ["League", "Casual"]);
    if (!a || !b) throw new Error("seed failed");

    const result = await save(machineId, [
      card("Casual", { id: a.id }),
      card("League", { id: b.id }),
    ]);
    expect(result.ok).toBe(true);

    const stored = await savedCards(machineId);
    expect(stored.find((c) => c.id === a.id)?.name).toBe("Casual");
    expect(stored.find((c) => c.id === b.id)?.name).toBe("League");
  });

  it("lets a new card take the name of one deleted in the same save", async () => {
    const owner = await makeUser("member");
    const machineId = await makeMachine(owner);
    await mockAuth(owner);
    const [old] = await seedCards(machineId, ["Card 1"]);
    if (!old) throw new Error("seed failed");

    expect((await save(machineId, [card("Card 1")], [old.id])).ok).toBe(true);
    const stored = await savedCards(machineId);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.id).not.toBe(old.id);
  });

  it("deletes a machine's only card (§11.5)", async () => {
    const owner = await makeUser("member");
    const machineId = await makeMachine(owner);
    await mockAuth(owner);
    const [only] = await seedCards(machineId, ["Card 1"]);
    if (!only) throw new Error("seed failed");

    expect((await save(machineId, [], [only.id])).ok).toBe(true);
    expect(await savedCards(machineId)).toHaveLength(0);
  });

  it("stores only the formatting the card prints (§3.7)", async () => {
    const owner = await makeUser("member");
    const machineId = await makeMachine(owner);
    await mockAuth(owner);

    await save(machineId, [
      card("Card 1", {
        description: {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: "Rules" }],
            },
          ],
        },
        tip: { type: "doc", content: [{ type: "paragraph" }] },
      }),
    ]);

    const [stored] = await savedCards(machineId);
    expect(stored?.description?.content.map((n) => n.type)).toEqual([
      "paragraph",
    ]);
    expect(stored?.tip).toBeNull();
  });

  it("refuses to update a card deleted elsewhere since the page loaded", async () => {
    const owner = await makeUser("member");
    const machineId = await makeMachine(owner);
    await mockAuth(owner);
    const [gone] = await seedCards(machineId, ["Card 1"]);
    if (!gone) throw new Error("seed failed");
    await save(machineId, [], [gone.id]);

    const result = await save(machineId, [
      card("Card 1", { id: gone.id }),
      card("Card 2"),
    ]);
    expect(result).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(await savedCards(machineId)).toHaveLength(0);
  });

  it("refuses a card name another editor added since the page loaded", async () => {
    const owner = await makeUser("member");
    const machineId = await makeMachine(owner);
    await mockAuth(owner);
    await seedCards(machineId, ["Tournament"]);

    const result = await save(machineId, [card("Tournament")]);
    expect(result).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(await savedCards(machineId)).toHaveLength(1);
  });

  it.each(["technician", "admin"] as const)(
    "lets a %s save cards on a machine they do not own",
    async (role) => {
      const owner = await makeUser("member");
      const editor = await makeUser(role);
      const machineId = await makeMachine(owner);
      await mockAuth(editor);

      expect((await save(machineId, [card("Card 1")])).ok).toBe(true);
    }
  );

  it.each(["member", "guest"] as const)(
    "refuses a %s who does not own the machine",
    async (role) => {
      const owner = await makeUser("member");
      const other = await makeUser(role);
      const machineId = await makeMachine(owner);
      await mockAuth(other);

      const result = await save(machineId, [card("Card 1")]);
      expect(result).toMatchObject({ ok: false, code: "UNAUTHORIZED" });

      expect(await savedCards(machineId)).toHaveLength(0);
    }
  );

  it("refuses a signed-out caller", async () => {
    const machineId = await makeMachine(null);
    await mockAuth(null);

    expect(await save(machineId, [card("Card 1")])).toMatchObject({
      ok: false,
      code: "UNAUTHORIZED",
    });
  });

  it("rejects a card without a supported size (§4.3)", async () => {
    const owner = await makeUser("member");
    const machineId = await makeMachine(owner);
    await mockAuth(owner);

    const result = await save(machineId, [
      // @ts-expect-error -- an untrusted client can send any string
      card("Card 1", { size: "gottlieb" }),
    ]);
    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
  });

  it("caps a machine's cards even across saves that each send few", async () => {
    const owner = await makeUser("member");
    const machineId = await makeMachine(owner);
    await mockAuth(owner);
    await seedCards(
      machineId,
      Array.from({ length: 20 }, (_, i) => `Card ${i + 1}`)
    );

    // A client that leaves the saved cards out of its payload still cannot
    // add a twenty-first.
    const result = await save(machineId, [card("Extra")]);
    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(await savedCards(machineId)).toHaveLength(20);
  });

  it("rejects card text padded past the stored size limit", async () => {
    const owner = await makeUser("member");
    const machineId = await makeMachine(owner);
    await mockAuth(owner);

    const result = await save(machineId, [
      card("Card 1", {
        description: {
          type: "doc",
          content: Array.from({ length: 5000 }, () => ({ type: "paragraph" })),
        },
      }),
    ]);
    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
  });

  it("rejects a card that is both updated and deleted", async () => {
    const owner = await makeUser("member");
    const machineId = await makeMachine(owner);
    await mockAuth(owner);
    const [only] = await seedCards(machineId, ["Card 1"]);
    if (!only) throw new Error("seed failed");

    const result = await save(
      machineId,
      [card("Card 1", { id: only.id })],
      [only.id]
    );
    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(await savedCards(machineId)).toHaveLength(1);
  });

  it("rejects two cards with the same name (§11.2)", async () => {
    const owner = await makeUser("member");
    const machineId = await makeMachine(owner);
    await mockAuth(owner);

    const result = await save(machineId, [card("Card 1"), card(" Card 1 ")]);
    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(await savedCards(machineId)).toHaveLength(0);
  });
});

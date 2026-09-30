/**
 * Integration Test: apron card save action (PP-esta)
 *
 * Worker-scoped PGlite (CORE-TEST-001). Covers the permission split for
 * changing a card (apron-cards spec §3.6: owner, technician, or admin — the
 * `machines.edit` capability), payload rejection, and that saving writes every
 * field of the machine's first saved card (§11), creating it on first save and
 * updating it after.
 */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import {
  authUsers,
  machineApronCards,
  machines,
  userProfiles,
} from "~/server/db/schema";
import { docToPlainText } from "~/lib/tiptap/types";
import { saveApronCardAction } from "~/app/(app)/m/[initials]/apron/actions";
import type { SaveApronCardInput } from "~/app/(app)/m/[initials]/apron/schemas";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("saveApronCardAction (PP-esta)", () => {
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
    });
  }

  function input(machineId: string): SaveApronCardInput {
    return {
      machineId,
      size: "stern",
      useCustomDescription: true,
      description: "Shoot the ramps.",
      tip: "Extra ball at 3 modes.",
      tipEnabled: true,
      designEnabled: false,
      artEnabled: true,
    };
  }

  it("lets the machine's owner save every card field", async () => {
    const owner = await makeUser("member");
    const machineId = await makeMachine(owner);
    await mockAuth(owner);

    const result = await saveApronCardAction(input(machineId));
    expect(result.ok).toBe(true);

    const [card, ...rest] = await savedCards(machineId);
    expect(rest).toHaveLength(0);
    expect(card).toMatchObject({
      size: "stern",
      useCustomDescription: true,
      tipEnabled: true,
      designEnabled: false,
      artEnabled: true,
    });
    expect(docToPlainText(card?.description)).toBe("Shoot the ramps.");
    expect(docToPlainText(card?.tip)).toBe("Extra ball at 3 modes.");
  });

  it("updates the first saved card rather than adding another", async () => {
    const owner = await makeUser("member");
    const machineId = await makeMachine(owner);
    await mockAuth(owner);

    await saveApronCardAction(input(machineId));
    await saveApronCardAction({ ...input(machineId), size: "wpc", tip: "" });

    const cards = await savedCards(machineId);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ size: "wpc", tip: null });
  });

  it.each(["technician", "admin"] as const)(
    "lets a %s save a card on a machine they do not own",
    async (role) => {
      const owner = await makeUser("member");
      const editor = await makeUser(role);
      const machineId = await makeMachine(owner);
      await mockAuth(editor);

      expect((await saveApronCardAction(input(machineId))).ok).toBe(true);
    }
  );

  it.each(["member", "guest"] as const)(
    "refuses a %s who does not own the machine",
    async (role) => {
      const owner = await makeUser("member");
      const other = await makeUser(role);
      const machineId = await makeMachine(owner);
      await mockAuth(other);

      const result = await saveApronCardAction(input(machineId));
      expect(result).toMatchObject({ ok: false, code: "UNAUTHORIZED" });

      expect(await savedCards(machineId)).toHaveLength(0);
    }
  );

  it("refuses a signed-out caller", async () => {
    const machineId = await makeMachine(null);
    await mockAuth(null);

    expect(await saveApronCardAction(input(machineId))).toMatchObject({
      ok: false,
      code: "UNAUTHORIZED",
    });
  });

  it("rejects a size outside the supported set", async () => {
    const owner = await makeUser("member");
    const machineId = await makeMachine(owner);
    await mockAuth(owner);

    const result = await saveApronCardAction({
      ...input(machineId),
      // @ts-expect-error -- an untrusted client can send any string
      size: "gottlieb",
    });
    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
  });
});

/**
 * Integration Test: the apron card print queue (PP-uksf)
 *
 * Worker-scoped PGlite (CORE-TEST-001). Covers who may use a print queue
 * (apron-cards spec §13.1), that each member's queue is their own (§1), that
 * adding and removing touch only the named cards (§13.2, §13.6), and that a
 * queue offers only cards the Print apron cards page lists, losing a deleted
 * card (§13.3).
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
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { setApronCardsQueuedAction } =
  await import("~/app/(app)/m/apron-cards/actions");
const { getQueuedApronCardIds } =
  await import("~/app/(app)/m/apron-cards/_data");

describe("apron card print queue (PP-uksf)", () => {
  setupTestDb();

  async function makeUser(role: "guest" | "member"): Promise<string> {
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
  async function makeCard(
    presenceStatus: "on_the_floor" | "removed" = "on_the_floor"
  ): Promise<string> {
    const db = await getTestDb();
    machineCounter += 1;
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Test Machine",
        initials: `PQ${String(machineCounter).padStart(3, "0")}`,
        presenceStatus,
      })
      .returning({ id: machines.id });
    if (!machine) throw new Error("machine insert failed");
    const [card] = await db
      .insert(machineApronCards)
      .values({ machineId: machine.id, name: "Main card", size: "wpc" })
      .returning({ id: machineApronCards.id });
    if (!card) throw new Error("card insert failed");
    return card.id;
  }

  async function signInAs(userId: string | null): Promise<void> {
    const { createClient } = await import("~/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: userId ? { id: userId } : null },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  }

  it("lets a member queue cards and keeps each member's queue their own", async () => {
    const alex = await makeUser("member");
    const sam = await makeUser("member");
    const first = await makeCard();
    const second = await makeCard();

    await signInAs(alex);
    const added = await setApronCardsQueuedAction({
      cardIds: [first, second],
      queued: true,
    });
    // Queuing a card twice changes nothing.
    await setApronCardsQueuedAction({ cardIds: [first], queued: true });

    expect(added).toEqual({ ok: true, value: { queuedCount: 2 } });
    expect((await getQueuedApronCardIds(alex)).sort()).toEqual(
      [first, second].sort()
    );
    expect(await getQueuedApronCardIds(sam)).toEqual([]);
  });

  it("refuses guests and signed-out visitors", async () => {
    const card = await makeCard();
    const guest = await makeUser("guest");

    await signInAs(guest);
    const asGuest = await setApronCardsQueuedAction({
      cardIds: [card],
      queued: true,
    });
    await signInAs(null);
    const signedOut = await setApronCardsQueuedAction({
      cardIds: [card],
      queued: true,
    });

    expect(asGuest).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
    expect(signedOut).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
    expect(await getQueuedApronCardIds(guest)).toEqual([]);
  });

  it("removes only the named cards from the member's own queue", async () => {
    const alex = await makeUser("member");
    const sam = await makeUser("member");
    const printed = await makeCard();
    const kept = await makeCard();

    await signInAs(sam);
    await setApronCardsQueuedAction({ cardIds: [printed], queued: true });
    await signInAs(alex);
    await setApronCardsQueuedAction({
      cardIds: [printed, kept],
      queued: true,
    });
    const removed = await setApronCardsQueuedAction({
      cardIds: [printed],
      queued: false,
    });

    expect(removed).toEqual({ ok: true, value: { queuedCount: 1 } });
    expect(await getQueuedApronCardIds(alex)).toEqual([kept]);
    expect(await getQueuedApronCardIds(sam)).toEqual([printed]);
  });

  it("offers only cards of machines that are not Removed, and drops a deleted card", async () => {
    const db = await getTestDb();
    const alex = await makeUser("member");
    const listed = await makeCard();
    const onRemovedMachine = await makeCard("removed");
    const deleted = await makeCard();

    await signInAs(alex);
    const result = await setApronCardsQueuedAction({
      cardIds: [listed, onRemovedMachine, deleted],
      queued: true,
    });
    await db.delete(machineApronCards).where(eq(machineApronCards.id, deleted));

    expect(result).toEqual({ ok: true, value: { queuedCount: 2 } });
    expect(await getQueuedApronCardIds(alex)).toEqual([listed]);
    expect(await getQueuedApronCardIds(alex, [listed, deleted])).toEqual([
      listed,
    ]);
  });
});

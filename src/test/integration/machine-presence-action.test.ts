/**
 * Integration Test: updateMachinePresenceAction (PP-5sgt.3)
 *
 * Worker-scoped PGlite (CORE-TEST-001). Covers the Service-tab presence
 * control: owner/tech/admin may change availability; the change persists and
 * emits a `presence_changed` lifecycle event (so it surfaces in the Activity
 * feed); non-owners are denied; an unchanged value is a no-op (no event).
 */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import {
  authUsers,
  machines,
  timelineEvents,
  userProfiles,
} from "~/server/db/schema";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("updateMachinePresenceAction (PP-5sgt.3)", () => {
  setupTestDb();

  async function makeUser(
    role: "guest" | "member" | "technician" | "admin" = "member"
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

  let counter = 0;
  async function makeMachine(ownerId?: string): Promise<{
    id: string;
    initials: string;
  }> {
    const db = await getTestDb();
    counter += 1;
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Test Machine",
        initials: `PR${String(counter).padStart(3, "0")}`,
        ownerId: ownerId ?? null,
        presenceStatus: "on_the_floor",
      })
      .returning();
    return machine;
  }

  async function mockAuth(userId: string | null): Promise<void> {
    const { createClient } = await import("~/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: userId ? { id: userId } : null },
        }),
      },
    });
  }

  async function presenceEvents(machineId: string) {
    const db = await getTestDb();
    return db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machineId));
  }

  it("updates availability and emits a presence_changed lifecycle event", async () => {
    const adminId = await makeUser("admin");
    const machine = await makeMachine();
    await mockAuth(adminId);

    const { updateMachinePresenceAction } =
      await import("~/app/(app)/m/actions");
    const result = await updateMachinePresenceAction(
      machine.id,
      "off_the_floor"
    );
    expect(result.ok).toBe(true);

    const db = await getTestDb();
    const [row] = await db
      .select({ presenceStatus: machines.presenceStatus })
      .from(machines)
      .where(eq(machines.id, machine.id));
    expect(row?.presenceStatus).toBe("off_the_floor");

    const events = await presenceEvents(machine.id);
    const presence = events.filter(
      (e) =>
        e.eventData !== null &&
        (e.eventData as { kind?: string }).kind === "presence_changed"
    );
    expect(presence).toHaveLength(1);
    expect(presence[0]?.eventData).toMatchObject({
      kind: "presence_changed",
      from: "on_the_floor",
      to: "off_the_floor",
    });
  });

  it("lets the machine owner change availability", async () => {
    const ownerId = await makeUser("member");
    const machine = await makeMachine(ownerId);
    await mockAuth(ownerId);

    const { updateMachinePresenceAction } =
      await import("~/app/(app)/m/actions");
    const result = await updateMachinePresenceAction(machine.id, "on_loan");
    expect(result.ok).toBe(true);
  });

  it("denies a non-owner member", async () => {
    const ownerId = await makeUser("member");
    const strangerId = await makeUser("member");
    const machine = await makeMachine(ownerId);
    await mockAuth(strangerId);

    const { updateMachinePresenceAction } =
      await import("~/app/(app)/m/actions");
    const result = await updateMachinePresenceAction(machine.id, "removed");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNAUTHORIZED");

    // Value unchanged.
    const db = await getTestDb();
    const [row] = await db
      .select({ presenceStatus: machines.presenceStatus })
      .from(machines)
      .where(eq(machines.id, machine.id));
    expect(row?.presenceStatus).toBe("on_the_floor");
  });

  it("is a no-op (no event) when the value is unchanged", async () => {
    const adminId = await makeUser("admin");
    const machine = await makeMachine();
    await mockAuth(adminId);

    const { updateMachinePresenceAction } =
      await import("~/app/(app)/m/actions");
    const result = await updateMachinePresenceAction(
      machine.id,
      "on_the_floor"
    );
    expect(result.ok).toBe(true);

    const events = await presenceEvents(machine.id);
    expect(
      events.filter(
        (e) =>
          e.eventData !== null &&
          (e.eventData as { kind?: string }).kind === "presence_changed"
      )
    ).toHaveLength(0);
  });

  it("rejects unauthenticated callers", async () => {
    const machine = await makeMachine();
    await mockAuth(null);

    const { updateMachinePresenceAction } =
      await import("~/app/(app)/m/actions");
    const result = await updateMachinePresenceAction(
      machine.id,
      "off_the_floor"
    );
    expect(result.ok).toBe(false);
  });
});

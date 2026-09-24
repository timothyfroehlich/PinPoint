/**
 * Integration Test: apron card save action (PP-esta)
 *
 * Worker-scoped PGlite (CORE-TEST-001). Covers the permission split for
 * changing a card (apron-cards spec §3.6: owner, technician, or admin — the
 * `machines.edit` capability), payload rejection, and that saving writes every
 * card field plus the saved timestamp export depends on (§9.1).
 */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { authUsers, machines, userProfiles } from "~/server/db/schema";
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

  function input(machineId: string): SaveApronCardInput {
    return {
      machineId,
      size: "stern",
      useCustomDescription: true,
      description: "Shoot the ramps.",
      tip: "Extra ball at 3 modes.",
      tipEnabled: true,
    };
  }

  it("lets the machine's owner save every card field", async () => {
    const owner = await makeUser("member");
    const machineId = await makeMachine(owner);
    await mockAuth(owner);

    const result = await saveApronCardAction(input(machineId));
    expect(result.ok).toBe(true);

    const db = await getTestDb();
    const row = await db.query.machines.findFirst({
      where: eq(machines.id, machineId),
    });
    expect(row).toMatchObject({
      apronSize: "stern",
      apronUseCustomDescription: true,
      apronDescription: "Shoot the ramps.",
      apronTip: "Extra ball at 3 modes.",
      apronTipEnabled: true,
    });
    expect(row?.apronSavedAt).toBeInstanceOf(Date);
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

      const db = await getTestDb();
      const row = await db.query.machines.findFirst({
        where: eq(machines.id, machineId),
      });
      expect(row?.apronSavedAt).toBeNull();
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

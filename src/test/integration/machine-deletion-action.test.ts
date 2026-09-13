import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { machines, authUsers, userProfiles } from "~/server/db/schema";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

const authState = vi.hoisted(() => {
  const state: { userId: string | null } = { userId: null };
  return state;
});

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: {
            user: authState.userId === null ? null : { id: authState.userId },
          },
        })
      ),
    },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("deleteMachineAction", () => {
  setupTestDb();

  async function createUser(role: "member" | "technician" | "admin") {
    const db = await getTestDb();
    const id = randomUUID();

    await db.insert(authUsers).values({ id, email: `${id}@example.com` });
    await db.insert(userProfiles).values({
      id,
      email: `${id}@example.com`,
      firstName: "Delete",
      lastName: "Tester",
      role,
    });

    return { id };
  }

  async function createMachine(ownerId: string | null) {
    const db = await getTestDb();
    return db
      .insert(machines)
      .values({
        name: "Deletion Test Machine",
        initials: `D${randomUUID().slice(0, 3).toUpperCase()}`,
        ownerId,
      })
      .returning()
      .then(([machine]) => machine);
  }

  it("requires authentication", async () => {
    const { deleteMachineAction } = await import("~/app/(app)/m/actions");
    authState.userId = null;

    const formData = new FormData();
    formData.set("id", randomUUID());

    const result = await deleteMachineAction(undefined, formData);

    expect(result).toEqual({
      ok: false,
      code: "UNAUTHORIZED",
      message: "Unauthorized. Please log in.",
    });
  });

  it("returns not found for a machine that does not exist", async () => {
    const { deleteMachineAction } = await import("~/app/(app)/m/actions");
    const member = await createUser("member");
    authState.userId = member.id;

    const formData = new FormData();
    formData.set("id", randomUUID());

    const result = await deleteMachineAction(undefined, formData);

    expect(result).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Machine not found.",
    });
  });

  it("allows an admin to delete an unowned machine", async () => {
    const { deleteMachineAction } = await import("~/app/(app)/m/actions");
    const db = await getTestDb();
    const admin = await createUser("admin");
    const machine = await createMachine(null);
    authState.userId = admin.id;

    const formData = new FormData();
    formData.set("id", machine.id);

    const result = await deleteMachineAction(undefined, formData);

    expect(result).toEqual({ ok: true, value: { machineId: machine.id } });
    const deletedMachine = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(deletedMachine).toBeUndefined();
  });

  it("allows an admin to delete another member's machine", async () => {
    const { deleteMachineAction } = await import("~/app/(app)/m/actions");
    const db = await getTestDb();
    const owner = await createUser("member");
    const admin = await createUser("admin");
    const machine = await createMachine(owner.id);
    authState.userId = admin.id;

    const formData = new FormData();
    formData.set("id", machine.id);

    const result = await deleteMachineAction(undefined, formData);

    expect(result).toEqual({ ok: true, value: { machineId: machine.id } });
    const deletedMachine = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(deletedMachine).toBeUndefined();
  });

  it("allows a member to delete a machine they own", async () => {
    const { deleteMachineAction } = await import("~/app/(app)/m/actions");
    const db = await getTestDb();
    const owner = await createUser("member");
    const machine = await createMachine(owner.id);
    authState.userId = owner.id;

    const formData = new FormData();
    formData.set("id", machine.id);

    const result = await deleteMachineAction(undefined, formData);

    expect(result).toEqual({ ok: true, value: { machineId: machine.id } });
    const deletedMachine = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(deletedMachine).toBeUndefined();
  });

  it("denies a member deleting another member's machine", async () => {
    const { deleteMachineAction } = await import("~/app/(app)/m/actions");
    const db = await getTestDb();
    const owner = await createUser("member");
    const caller = await createUser("member");
    const machine = await createMachine(owner.id);
    authState.userId = caller.id;

    const formData = new FormData();
    formData.set("id", machine.id);

    const result = await deleteMachineAction(undefined, formData);

    expect(result).toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "You do not have permission to delete this machine.",
    });
    const retainedMachine = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(retainedMachine?.id).toBe(machine.id);
  });

  it("denies a technician deleting another member's machine", async () => {
    const { deleteMachineAction } = await import("~/app/(app)/m/actions");
    const db = await getTestDb();
    const owner = await createUser("member");
    const technician = await createUser("technician");
    const machine = await createMachine(owner.id);
    authState.userId = technician.id;

    const formData = new FormData();
    formData.set("id", machine.id);

    const result = await deleteMachineAction(undefined, formData);

    expect(result).toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "You do not have permission to delete this machine.",
    });
    const retainedMachine = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(retainedMachine?.id).toBe(machine.id);
  });

  it.each([
    { label: "missing", id: undefined },
    { label: "malformed", id: "not-a-machine-id" },
  ])("rejects a $label machine ID", async ({ id }) => {
    const { deleteMachineAction } = await import("~/app/(app)/m/actions");
    const db = await getTestDb();
    const owner = await createUser("member");
    const machine = await createMachine(owner.id);
    authState.userId = owner.id;

    const formData = new FormData();
    if (id !== undefined) {
      formData.set("id", id);
    }

    const result = await deleteMachineAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
    }
    const retainedMachine = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(retainedMachine?.id).toBe(machine.id);
  });
});

/**
 * Integration Test: Machine Timeline Comment Server Actions (PP-0x98)
 *
 * Covers `addMachineCommentAction` (insert + validation) and
 * `deleteMachineCommentAction` (matrix-driven permission scenarios for
 * `machines.timeline.comment.delete` — `own_or_owner` semantics).
 *
 * AGENTS.md rule 12: authorization is delegated to `checkPermission` against
 * the matrix entry. These tests therefore exercise the four meaningful
 * actors (author, machine owner, site admin, unrelated member) to confirm
 * the matrix wiring + OwnershipContext are correct end-to-end.
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

// Route the production `db` import to the PGlite worker instance.
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Machine timeline comment Server Actions (PP-0x98)", () => {
  setupTestDb();

  async function makeUser(
    role: "guest" | "member" | "technician" | "admin" = "member",
    overrides: { firstName?: string; lastName?: string } = {}
  ) {
    const db = await getTestDb();
    const id = randomUUID();
    await db.insert(authUsers).values({ id, email: `${id}@example.com` });
    const [user] = await db
      .insert(userProfiles)
      .values({
        id,
        email: `${id}@example.com`,
        firstName: overrides.firstName ?? "Test",
        lastName: overrides.lastName ?? "User",
        role,
      })
      .returning();
    return user;
  }

  let machineCounter = 0;
  async function makeMachine(ownerId?: string) {
    const db = await getTestDb();
    machineCounter += 1;
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Test Machine",
        initials: `MT${String(machineCounter).padStart(3, "0")}`,
        ownerId: ownerId ?? null,
      })
      .returning();
    return machine;
  }

  async function mockAuth(userId: string) {
    const { createClient } = await import("~/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  }

  async function mockAuthUnauthenticated() {
    const { createClient } = await import("~/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  }

  const VALID_DOC_JSON = JSON.stringify({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Cleaned" }] },
    ],
  });

  describe("addMachineCommentAction", () => {
    it("inserts a comment with tag and author from current session", async () => {
      const db = await getTestDb();
      const member = await makeUser("member");
      const machine = await makeMachine();
      await mockAuth(member.id);

      const { addMachineCommentAction } =
        await import("~/app/(app)/m/[initials]/timeline/actions");
      const result = await addMachineCommentAction({
        machineId: machine.id,
        tag: "maintenance",
        contentJson: VALID_DOC_JSON,
      });

      expect(result.success).toBe(true);
      const rows = await db
        .select()
        .from(timelineEvents)
        .where(eq(timelineEvents.machineId, machine.id));
      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row).toBeDefined();
      expect(row.authorId).toBe(member.id);
      expect(row.tag).toBe("maintenance");
      expect(row.sourceType).toBe("comment");
    });

    it("rejects a reserved tag (lifecycle)", async () => {
      const member = await makeUser("member");
      const machine = await makeMachine();
      await mockAuth(member.id);
      const { addMachineCommentAction } =
        await import("~/app/(app)/m/[initials]/timeline/actions");

      const result = await addMachineCommentAction({
        machineId: machine.id,
        // `z.input<userTagSchema>` is the full TimelineTag enum (refine
        // narrows the OUTPUT, not the input) — "lifecycle" is accepted at
        // the TS layer and rejected at runtime, which is what we want.
        tag: "lifecycle",
        contentJson: VALID_DOC_JSON,
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/reserved/i);
    });

    it("rejects an unauthenticated user", async () => {
      const machine = await makeMachine();
      await mockAuthUnauthenticated();
      const { addMachineCommentAction } =
        await import("~/app/(app)/m/[initials]/timeline/actions");

      const result = await addMachineCommentAction({
        machineId: machine.id,
        tag: "maintenance",
        contentJson: VALID_DOC_JSON,
      });

      expect(result.success).toBe(false);
    });

    it("rejects a guest (member-only permission)", async () => {
      const guest = await makeUser("guest");
      const machine = await makeMachine();
      await mockAuth(guest.id);
      const { addMachineCommentAction } =
        await import("~/app/(app)/m/[initials]/timeline/actions");

      const result = await addMachineCommentAction({
        machineId: machine.id,
        tag: "maintenance",
        contentJson: VALID_DOC_JSON,
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Forbidden");
    });
  });

  describe("deleteMachineCommentAction permission scenarios", () => {
    async function seedCommentByMember() {
      const owner = await makeUser("member", { firstName: "Owner" });
      const machine = await makeMachine(owner.id);
      const member = await makeUser("member", { firstName: "Member" });
      const otherMember = await makeUser("member", { firstName: "Other" });
      const admin = await makeUser("admin", { firstName: "Admin" });

      await mockAuth(member.id);
      const { addMachineCommentAction } =
        await import("~/app/(app)/m/[initials]/timeline/actions");
      const insertResult = await addMachineCommentAction({
        machineId: machine.id,
        tag: "maintenance",
        contentJson: VALID_DOC_JSON,
      });
      expect(insertResult.success).toBe(true);

      const db = await getTestDb();
      const rows = await db
        .select()
        .from(timelineEvents)
        .where(eq(timelineEvents.machineId, machine.id));
      const comment = rows[0];
      return { machine, owner, member, otherMember, admin, comment };
    }

    it("author can delete own comment", async () => {
      const db = await getTestDb();
      const { member, comment } = await seedCommentByMember();
      await mockAuth(member.id);
      const { deleteMachineCommentAction } =
        await import("~/app/(app)/m/[initials]/timeline/actions");

      const result = await deleteMachineCommentAction({ id: comment.id });
      expect(result.success).toBe(true);

      const rows = await db
        .select()
        .from(timelineEvents)
        .where(eq(timelineEvents.id, comment.id));
      const row = rows[0];
      expect(row).toBeDefined();
      expect(row.deletedAt).toBeInstanceOf(Date);
      expect(row.deletedBy).toBe(member.id);
    });

    it("machine owner can delete another member's comment", async () => {
      const { owner, comment } = await seedCommentByMember();
      await mockAuth(owner.id);
      const { deleteMachineCommentAction } =
        await import("~/app/(app)/m/[initials]/timeline/actions");

      const result = await deleteMachineCommentAction({ id: comment.id });
      expect(result.success).toBe(true);
    });

    it("site admin can delete any comment", async () => {
      const { admin, comment } = await seedCommentByMember();
      await mockAuth(admin.id);
      const { deleteMachineCommentAction } =
        await import("~/app/(app)/m/[initials]/timeline/actions");

      const result = await deleteMachineCommentAction({ id: comment.id });
      expect(result.success).toBe(true);
    });

    it("non-author non-owner non-admin member CANNOT delete", async () => {
      const db = await getTestDb();
      const { otherMember, comment } = await seedCommentByMember();
      await mockAuth(otherMember.id);
      const { deleteMachineCommentAction } =
        await import("~/app/(app)/m/[initials]/timeline/actions");

      const result = await deleteMachineCommentAction({ id: comment.id });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Forbidden");

      const rows = await db
        .select()
        .from(timelineEvents)
        .where(eq(timelineEvents.id, comment.id));
      const row = rows[0];
      expect(row).toBeDefined();
      expect(row.deletedAt).toBeNull();
    });
  });
});

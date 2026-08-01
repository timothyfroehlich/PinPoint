/**
 * Integration Test: MCP tool handlers (PP-u4ab.2)
 *
 * Worker-scoped PGlite (CORE-TEST-001). Exercises each tool's core
 * `run*(args, ctx)` function directly — validate→permission→service flow — with
 * a stubbed {@link McpAuthContext} (admin vs member), against real seeded rows.
 * Auth-at-the-door (`verifyToken`) is unit-tested separately; here we verify the
 * per-tool `checkPermission` gate (defense in depth) and the service wiring.
 *
 * `getChannels` → `[]` and `dispatchNotification` → no-op avoid external effects;
 * `after` runs its callback inline so post-commit dispatch is exercised.
 */

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { authUsers, issues, machines, userProfiles } from "~/server/db/schema";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import type * as NotificationsModule from "~/lib/notifications";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof NotificationsModule>();
  return {
    ...actual,
    getChannels: vi.fn().mockResolvedValue([]),
    dispatchNotification: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("next/server", () => ({
  after: (cb: () => unknown) => {
    void cb();
  },
}));

import { runAddMachine } from "~/lib/mcp/tools/add-machine";
import { runCreateIssue } from "~/lib/mcp/tools/create-issue";
import { runGetMachine } from "~/lib/mcp/tools/get-machine";
import { runListMachines } from "~/lib/mcp/tools/list-machines";
import { runSetMachineAvailability } from "~/lib/mcp/tools/set-machine-availability";
import { runSetMachineOwner } from "~/lib/mcp/tools/set-machine-owner";
import { McpToolError } from "~/lib/mcp/tools/shared";

describe("MCP tool handlers (PP-u4ab.2)", () => {
  setupTestDb();

  function ctx(
    accessLevel: McpAuthContext["accessLevel"],
    userId: string
  ): McpAuthContext {
    return { userId, accessLevel, clientId: "test-client" };
  }

  async function makeUser(
    role: "guest" | "member" | "technician" | "admin",
    firstName = "Test",
    lastName = "User"
  ): Promise<string> {
    const db = await getTestDb();
    const id = randomUUID();
    await db.insert(authUsers).values({ id, email: `${id}@example.com` });
    await db.insert(userProfiles).values({
      id,
      email: `${id}@example.com`,
      firstName,
      lastName,
      role,
    });
    return id;
  }

  let counter = 0;
  function nextInitials(): string {
    counter += 1;
    return `MC${String(counter).padStart(3, "0")}`;
  }

  async function seedMachine(overrides?: {
    name?: string;
    ownerId?: string | null;
    presenceStatus?: "on_the_floor" | "off_the_floor";
  }): Promise<{ id: string; initials: string }> {
    const db = await getTestDb();
    const [machine] = await db
      .insert(machines)
      .values({
        name: overrides?.name ?? "Seed Machine",
        initials: nextInitials(),
        ownerId: overrides?.ownerId ?? null,
        presenceStatus: overrides?.presenceStatus ?? "on_the_floor",
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");
    return machine;
  }

  describe("list_machines", () => {
    it("returns machines with owner name and open-issue count", async () => {
      const admin = await makeUser("admin");
      const owner = await makeUser("member", "Pat", "Owner");
      const machine = await seedMachine({
        name: "Twilight Zone",
        ownerId: owner,
      });
      await runCreateIssue(
        { machine: machine.initials, title: "flipper weak" },
        ctx("admin", admin)
      );

      const outcome = await runListMachines(
        { search: "Twilight" },
        ctx("admin", admin)
      );
      const result = outcome.result as {
        count: number;
        machines: {
          initials: string;
          owner: string | null;
          openIssues: number;
        }[];
      };

      expect(result.count).toBe(1);
      expect(result.machines[0]?.owner).toBe("Pat Owner");
      expect(result.machines[0]?.openIssues).toBe(1);
    });
  });

  describe("get_machine", () => {
    it("returns detail with recent open issues", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ name: "Attack from Mars" });
      await runCreateIssue(
        { machine: machine.initials, title: "no ball" },
        ctx("admin", admin)
      );

      const outcome = await runGetMachine(
        { machine: machine.initials },
        ctx("admin", admin)
      );
      const result = outcome.result as {
        name: string;
        openIssues: { title: string }[];
      };

      expect(result.name).toBe("Attack from Mars");
      expect(result.openIssues).toHaveLength(1);
      expect(result.openIssues[0]?.title).toBe("no ball");
    });

    it("throws not_found for an unknown machine", async () => {
      const admin = await makeUser("admin");
      await expect(
        runGetMachine({ machine: "ZZZ" }, ctx("admin", admin))
      ).rejects.toBeInstanceOf(McpToolError);
    });
  });

  describe("set_machine_availability", () => {
    it("changes presence for an admin and reports changed", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ presenceStatus: "on_the_floor" });

      const outcome = await runSetMachineAvailability(
        { machine: machine.initials, presence: "off_the_floor" },
        ctx("admin", admin)
      );
      const result = outcome.result as { presence: string; changed: boolean };

      expect(result).toMatchObject({
        presence: "off_the_floor",
        changed: true,
      });
      const db = await getTestDb();
      const row = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
        columns: { presenceStatus: true },
      });
      expect(row?.presenceStatus).toBe("off_the_floor");
    });

    it("reports changed:false when already at that status", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ presenceStatus: "on_the_floor" });

      const outcome = await runSetMachineAvailability(
        { machine: machine.initials, presence: "on_the_floor" },
        ctx("admin", admin)
      );
      expect((outcome.result as { changed: boolean }).changed).toBe(false);
    });

    it("denies a member who does not own the machine", async () => {
      const member = await makeUser("member");
      const machine = await seedMachine({ ownerId: null });

      await expect(
        runSetMachineAvailability(
          { machine: machine.initials, presence: "off_the_floor" },
          ctx("member", member)
        )
      ).rejects.toMatchObject({ reason: "denied" });
    });
  });

  describe("add_machine", () => {
    it("creates a machine for an admin", async () => {
      const admin = await makeUser("admin");
      const initials = nextInitials();

      const outcome = await runAddMachine(
        { name: "Medieval Madness", initials },
        ctx("admin", admin)
      );
      const result = outcome.result as { initials: string; name: string };

      expect(result).toMatchObject({ initials, name: "Medieval Madness" });
      const db = await getTestDb();
      const row = await db.query.machines.findFirst({
        where: eq(machines.initials, initials),
      });
      expect(row?.name).toBe("Medieval Madness");
    });

    it("denies a member", async () => {
      const member = await makeUser("member");
      await expect(
        runAddMachine(
          { name: "Nope", initials: nextInitials() },
          ctx("member", member)
        )
      ).rejects.toMatchObject({ reason: "denied" });
    });

    it("rejects duplicate initials", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine();
      await expect(
        runAddMachine(
          { name: "Dup", initials: machine.initials },
          ctx("admin", admin)
        )
      ).rejects.toMatchObject({ reason: "invalid" });
    });
  });

  describe("set_machine_owner", () => {
    it("sets the owner by full name for an admin", async () => {
      const admin = await makeUser("admin");
      await makeUser("member", "Dale", "Cooper");
      const machine = await seedMachine({ ownerId: null });

      const outcome = await runSetMachineOwner(
        { machine: machine.initials, owner: "Dale Cooper" },
        ctx("admin", admin)
      );
      expect((outcome.result as { owner: string | null }).owner).toBe(
        "Dale Cooper"
      );
    });

    it("clears the owner when owner is omitted", async () => {
      const admin = await makeUser("admin");
      const owner = await makeUser("member", "Gone", "Owner");
      const machine = await seedMachine({ ownerId: owner });

      const outcome = await runSetMachineOwner(
        { machine: machine.initials },
        ctx("admin", admin)
      );
      expect((outcome.result as { owner: string | null }).owner).toBeNull();

      const db = await getTestDb();
      const row = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
        columns: { ownerId: true },
      });
      expect(row?.ownerId).toBeNull();
    });

    it("throws invalid for an unknown owner name", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine();
      await expect(
        runSetMachineOwner(
          { machine: machine.initials, owner: "Nobody Here" },
          ctx("admin", admin)
        )
      ).rejects.toMatchObject({ reason: "not_found" });
    });

    it("denies a member who does not own the machine", async () => {
      const member = await makeUser("member");
      const machine = await seedMachine({ ownerId: null });
      await expect(
        runSetMachineOwner(
          { machine: machine.initials, owner: member },
          ctx("member", member)
        )
      ).rejects.toMatchObject({ reason: "denied" });
    });
  });

  describe("create_issue", () => {
    it("files an issue attributed to the caller", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine();

      const outcome = await runCreateIssue(
        {
          machine: machine.initials,
          title: "left flipper dead",
          description: "No response when pressed.",
          severity: "major",
        },
        ctx("admin", admin)
      );
      const result = outcome.result as {
        number: number;
        severity: string;
        machine: string;
      };

      expect(result).toMatchObject({
        machine: machine.initials,
        severity: "major",
      });
      const db = await getTestDb();
      const [row] = await db
        .select()
        .from(issues)
        .where(
          and(
            eq(issues.machineInitials, machine.initials),
            eq(issues.reportedBy, admin)
          )
        );
      expect(row?.title).toBe("left flipper dead");
    });

    it("throws not_found when the machine is unknown", async () => {
      const admin = await makeUser("admin");
      await expect(
        runCreateIssue({ machine: "NOPE", title: "x" }, ctx("admin", admin))
      ).rejects.toBeInstanceOf(McpToolError);
    });
  });
});

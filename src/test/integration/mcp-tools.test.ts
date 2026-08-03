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

import {
  authUsers,
  issues,
  machines,
  timelineEvents,
  userProfiles,
} from "~/server/db/schema";
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
import { runSetMachineName } from "~/lib/mcp/tools/set-machine-name";
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

    it("reports total and hasMore when the page is truncated (PP-u4ab.4)", async () => {
      const admin = await makeUser("admin");
      for (const name of ["Truncate A", "Truncate B", "Truncate C"]) {
        await seedMachine({ name });
      }

      const outcome = await runListMachines(
        { search: "Truncate", limit: 2 },
        ctx("admin", admin)
      );
      const result = outcome.result as {
        count: number;
        total: number;
        hasMore: boolean;
      };

      // The bug this pins: `count` alone reads as "there are 2", which is how a
      // 100+ machine collection gets miscounted from a 50-row page.
      expect(result.count).toBe(2);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it("pages past the limit with offset until hasMore clears (PP-u4ab.4)", async () => {
      const admin = await makeUser("admin");
      for (const name of ["Page A", "Page B", "Page C"]) {
        await seedMachine({ name });
      }

      interface Page {
        count: number;
        total: number;
        hasMore: boolean;
      }
      const first = (
        await runListMachines(
          { search: "Page", limit: 2, offset: 0 },
          ctx("admin", admin)
        )
      ).result as Page;
      const second = (
        await runListMachines(
          { search: "Page", limit: 2, offset: 2 },
          ctx("admin", admin)
        )
      ).result as Page;

      expect(first.hasMore).toBe(true);
      // The last page must report hasMore false even though total > count —
      // otherwise an enumerating caller loops forever.
      expect(second.count).toBe(1);
      expect(second.total).toBe(3);
      expect(second.hasMore).toBe(false);
    });

    it("reports hasMore false when the page holds every match", async () => {
      const admin = await makeUser("admin");
      await seedMachine({ name: "Complete Alpha" });

      const outcome = await runListMachines(
        { search: "Complete Alpha" },
        ctx("admin", admin)
      );
      const result = outcome.result as {
        count: number;
        total: number;
        hasMore: boolean;
      };

      expect(result.count).toBe(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    describe("pinballmap link-state filter (PP-u4ab.9)", () => {
      interface LinkStatePage {
        count: number;
        total: number;
        offset: number;
        hasMore: boolean;
        machines: { initials: string; name: string }[];
      }

      let pbmCatalogId = 800_000;

      /**
       * Move a seeded machine into a PinballMap link state. An UPDATE after
       * `seedMachine` rather than a second insert path, so machine creation
       * (and the initials counter) stays in one place.
       */
      async function setLinkState(
        id: string,
        state: "linked" | "excluded"
      ): Promise<void> {
        const db = await getTestDb();
        if (state === "linked") {
          pbmCatalogId += 1;
          await db
            .update(machines)
            .set({ pinballmapMachineId: pbmCatalogId })
            .where(eq(machines.id, id));
        } else {
          await db
            .update(machines)
            .set({
              pinballmapExcluded: true,
              pinballmapExcludedReason: "Homebrew, no catalog title",
            })
            .where(eq(machines.id, id));
        }
      }

      async function list(
        args: Parameters<typeof runListMachines>[0],
        admin: string
      ): Promise<LinkStatePage> {
        const outcome = await runListMachines(args, ctx("admin", admin));
        return outcome.result as LinkStatePage;
      }

      it("'unlinked' skips machines marked as not on PinballMap", async () => {
        const admin = await makeUser("admin");
        const worklist = await seedMachine({ name: "Link Alpha" });
        const linked = await seedMachine({ name: "Link Bravo" });
        const excluded = await seedMachine({ name: "Link Charlie" });
        await setLinkState(linked.id, "linked");
        await setLinkState(excluded.id, "excluded");

        const result = await list({ pinballmap: "unlinked" }, admin);

        // The exclusion half is the point: a machine deliberately marked as not
        // on PinballMap is finished work, so it must not come back as a to-do on
        // every sweep of the linking pass.
        expect(result.machines.map((m) => m.initials)).toEqual([
          worklist.initials,
        ]);
        expect(result.total).toBe(1);
        expect(result.hasMore).toBe(false);
      });

      it("'linked' and 'excluded' return their own buckets", async () => {
        const admin = await makeUser("admin");
        await seedMachine({ name: "Bucket Alpha" });
        const linked = await seedMachine({ name: "Bucket Bravo" });
        const excluded = await seedMachine({ name: "Bucket Charlie" });
        await setLinkState(linked.id, "linked");
        await setLinkState(excluded.id, "excluded");

        const linkedPage = await list({ pinballmap: "linked" }, admin);
        const excludedPage = await list({ pinballmap: "excluded" }, admin);

        expect(linkedPage.machines.map((m) => m.initials)).toEqual([
          linked.initials,
        ]);
        expect(linkedPage.total).toBe(1);
        expect(excludedPage.machines.map((m) => m.initials)).toEqual([
          excluded.initials,
        ]);
        expect(excludedPage.total).toBe(1);
      });

      it("composes with search and presence", async () => {
        const admin = await makeUser("admin");
        const target = await seedMachine({
          name: "Sweep Target",
          presenceStatus: "off_the_floor",
        });
        // Each of these fails exactly one of the three filters.
        await seedMachine({
          name: "Sweep Onfloor",
          presenceStatus: "on_the_floor",
        });
        await seedMachine({
          name: "Other Offfloor",
          presenceStatus: "off_the_floor",
        });
        const linked = await seedMachine({
          name: "Sweep Linked",
          presenceStatus: "off_the_floor",
        });
        await setLinkState(linked.id, "linked");

        const result = await list(
          {
            search: "Sweep",
            presence: "off_the_floor",
            pinballmap: "unlinked",
          },
          admin
        );

        expect(result.machines.map((m) => m.initials)).toEqual([
          target.initials,
        ]);
        expect(result.total).toBe(1);
      });

      it("pages a 100+ machine fleet by link state without repeats or gaps", async () => {
        const admin = await makeUser("admin");
        const db = await getTestDb();

        const rows: (typeof machines.$inferInsert)[] = [];
        const expectedUnlinked: string[] = [];
        for (let i = 0; i < 110; i += 1) {
          const initials = nextInitials();
          // Eight cabinets share each title. Duplicate same-title cabinets are
          // real in this collection, and 8 does not divide the page size of 25,
          // so every page boundary lands INSIDE a tie group — which is the only
          // arrangement that can catch an unstable sort.
          const name = `Fleet Title ${String(Math.floor(i / 8)).padStart(2, "0")}`;
          if (i % 5 === 0) {
            rows.push({ name, initials, pinballmapMachineId: 900_000 + i });
          } else if (i % 17 === 0) {
            rows.push({ name, initials, pinballmapExcluded: true });
          } else {
            rows.push({ name, initials });
            expectedUnlinked.push(initials);
          }
        }
        // Inserted in reverse, so within every tie group the heap order is the
        // OPPOSITE of the order the tool must return. Without a tiebreaker
        // Postgres is free to hand back the heap order, and the sweep below
        // sees one cabinet twice while another never appears.
        await db.insert(machines).values([...rows].reverse());

        const seen: string[] = [];
        const limit = 25;
        let offset = 0;
        let total = -1;
        // Bounded: a `hasMore` that never clears is the bug this guards, and an
        // unbounded loop would hang the suite instead of failing it.
        for (let page = 0; page < 10; page += 1) {
          const result = await list(
            { pinballmap: "unlinked", limit, offset },
            admin
          );
          total = result.total;
          seen.push(...result.machines.map((m) => m.initials));
          if (!result.hasMore) break;
          offset += limit;
        }

        // The count query and the page query must share the filter — a total
        // that outruns what paging can reach is a loop that never terminates.
        expect(total).toBe(expectedUnlinked.length);
        // No repeats, and no gaps. Set equality is the assertion that matters:
        // a sweep can return the right NUMBER of rows while having handed back
        // one machine twice and skipped another, and that failure reports
        // itself as a completed pass.
        expect(new Set(seen).size).toBe(seen.length);
        expect([...seen].sort()).toEqual([...expectedUnlinked].sort());
      });

      it("breaks name ties by initials, so a paged sweep is a total order", async () => {
        const admin = await makeUser("admin");
        const db = await getTestDb();

        // Six cabinets, one title. `name` is not a unique key in this
        // collection — duplicate same-title cabinets are a supported case (see
        // the PinballMap tie guard, PP-o355.15).
        const expected = Array.from({ length: 6 }, () => nextInitials()).sort();
        await db
          .insert(machines)
          .values(
            [...expected]
              .reverse()
              .map((initials) => ({ name: "Medieval Madness", initials }))
          );

        const seen: string[] = [];
        for (let offset = 0; offset < expected.length; offset += 2) {
          const page = await list(
            { pinballmap: "unlinked", limit: 2, offset },
            admin
          );
          seen.push(...page.machines.map((m) => m.initials));
        }

        // Every page boundary falls inside the tie group, so an order that is
        // only stable within a single query — not across the separate queries
        // paging actually issues — shows up here as a duplicate plus a miss.
        expect(seen).toEqual(expected);
      });
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

    it("returns the original issue when an identical call is retried (PP-u4ab.4)", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine();
      const args = {
        machine: machine.initials,
        title: "right flipper sticking",
        description: "Sticks on multiball.",
        severity: "major",
      } as const;

      const first = await runCreateIssue({ ...args }, ctx("admin", admin));
      const second = await runCreateIssue({ ...args }, ctx("admin", admin));

      // A transport-level retry resends identical arguments; it must resolve to
      // the issue already filed rather than a second one.
      expect(second.issueId).toBe(first.issueId);

      // ...and it must SAY so. Reporting the pre-existing issue's number with
      // no signal that nothing was written is the success-for-work-not-done
      // shape CORE-ARCH-012 forbids — the caller would tell a member their
      // second report was logged when it was dropped.
      expect((first.result as { created: boolean }).created).toBe(true);
      expect((second.result as { created: boolean }).created).toBe(false);

      const db = await getTestDb();
      const rows = await db
        .select()
        .from(issues)
        .where(eq(issues.machineInitials, machine.initials));
      expect(rows).toHaveLength(1);
    });

    it("files a separate issue when the content differs", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine();

      const first = await runCreateIssue(
        { machine: machine.initials, title: "left flipper weak" },
        ctx("admin", admin)
      );
      const second = await runCreateIssue(
        { machine: machine.initials, title: "right flipper weak" },
        ctx("admin", admin)
      );

      expect(second.issueId).not.toBe(first.issueId);
      const db = await getTestDb();
      const rows = await db
        .select()
        .from(issues)
        .where(eq(issues.machineInitials, machine.initials));
      expect(rows).toHaveLength(2);
    });
  });

  describe("set_machine_name (PP-u4ab.10)", () => {
    /** Every timeline event recorded against a machine. */
    async function timelineFor(machineId: string): Promise<
      {
        eventData: unknown;
        authorId: string | null;
      }[]
    > {
      const db = await getTestDb();
      return db
        .select({
          eventData: timelineEvents.eventData,
          authorId: timelineEvents.authorId,
        })
        .from(timelineEvents)
        .where(eq(timelineEvents.machineId, machineId));
    }

    it("renames the machine and writes exactly one name_changed event", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({
        name: "Elvira's House of Horrors",
      });

      const outcome = await runSetMachineName(
        {
          machine: machine.initials,
          name: "Elvira's House of Horrors (Premium)",
        },
        ctx("admin", admin)
      );

      expect(outcome.result).toMatchObject({
        initials: machine.initials,
        name: "Elvira's House of Horrors (Premium)",
        previousName: "Elvira's House of Horrors",
        changed: true,
      });

      const db = await getTestDb();
      const row = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
        columns: { name: true, initials: true },
      });
      expect(row?.name).toBe("Elvira's House of Horrors (Premium)");
      // Initials are the FK target for issues and the /m/<initials> URL — a
      // rename must never touch them.
      expect(row?.initials).toBe(machine.initials);

      const events = await timelineFor(machine.id);
      expect(events).toHaveLength(1);
      expect(events[0]?.eventData).toEqual({
        kind: "name_changed",
        from: "Elvira's House of Horrors",
        to: "Elvira's House of Horrors (Premium)",
      });
      expect(events[0]?.authorId).toBe(admin);
    });

    it("is a no-op when the name already matches, and says so", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ name: "Medieval Madness" });

      const outcome = await runSetMachineName(
        { machine: machine.initials, name: "Medieval Madness" },
        ctx("admin", admin)
      );

      // CORE-ARCH-012: nothing was written, so the response must not claim a
      // change happened.
      expect((outcome.result as { changed: boolean }).changed).toBe(false);
      expect(await timelineFor(machine.id)).toHaveLength(0);
    });

    it("denies a member who does not own the machine", async () => {
      const member = await makeUser("member");
      const machine = await seedMachine({ ownerId: null, name: "Attack" });

      await expect(
        runSetMachineName(
          { machine: machine.initials, name: "Attack from Mars" },
          ctx("member", member)
        )
      ).rejects.toMatchObject({ reason: "denied" });

      const db = await getTestDb();
      const row = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
        columns: { name: true },
      });
      expect(row?.name).toBe("Attack");
    });

    it("lets the machine's owner rename it", async () => {
      const owner = await makeUser("member", "Pat", "Owner");
      const machine = await seedMachine({ ownerId: owner, name: "Getaway" });

      const outcome = await runSetMachineName(
        { machine: machine.initials, name: "The Getaway: High Speed II" },
        ctx("member", owner)
      );

      expect((outcome.result as { changed: boolean }).changed).toBe(true);
    });

    it("throws not_found when the machine is unknown", async () => {
      const admin = await makeUser("admin");
      await expect(
        runSetMachineName({ machine: "NOPE", name: "x" }, ctx("admin", admin))
      ).rejects.toMatchObject({ reason: "not_found" });
    });
  });
});

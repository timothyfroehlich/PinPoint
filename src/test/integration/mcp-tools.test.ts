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
  pinballmapCatalog,
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
import { runSearchPinballmapCatalog } from "~/lib/mcp/tools/search-pinballmap-catalog";
import type {
  McpCatalogEditionResult,
  McpCatalogFamilyResult,
} from "~/lib/mcp/tools/search-pinballmap-catalog";
import type { McpMachinePinballmap } from "~/lib/mcp/tools/pinballmap-block";
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

  /** PinballMap columns a seeded machine may carry (schema CHECKs still apply). */
  interface SeedPbm {
    pinballmapMachineId?: number;
    pinballmapExcluded?: boolean;
    pinballmapExcludedReason?: string;
    pinballmapListed?: boolean;
    pinballmapLmxId?: number;
    manufacturer?: string;
    year?: number;
    opdbId?: string;
    ipdbId?: number;
  }

  async function seedMachine(overrides?: {
    name?: string;
    ownerId?: string | null;
    presenceStatus?: "on_the_floor" | "off_the_floor";
    pbm?: SeedPbm;
  }): Promise<{ id: string; initials: string }> {
    const db = await getTestDb();
    const [machine] = await db
      .insert(machines)
      .values({
        name: overrides?.name ?? "Seed Machine",
        initials: nextInitials(),
        ownerId: overrides?.ownerId ?? null,
        presenceStatus: overrides?.presenceStatus ?? "on_the_floor",
        ...(overrides?.pbm ?? {}),
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");
    return machine;
  }

  /**
   * Seed the local PinballMap catalog mirror. Every catalog read in these tests
   * is served from this table — nothing reaches pinballmap.com (CORE-PBM-001).
   */
  async function seedCatalog(
    rows: {
      pinballmapMachineId: number;
      name: string;
      manufacturer?: string;
      year?: number;
      opdbId?: string;
      ipdbId?: number;
      machineGroupId?: number;
      groupName?: string;
    }[]
  ): Promise<void> {
    const db = await getTestDb();
    await db.insert(pinballmapCatalog).values(rows);
  }

  const ELVIRA_GROUP_ID = 7001;
  const ELVIRA_PREMIUM_ID = 70012;

  /** The Elvira family (Pro/Premium/LE) plus one standalone title. */
  async function seedElviraCatalog(): Promise<void> {
    await seedCatalog([
      {
        pinballmapMachineId: 70011,
        name: "Elvira's House of Horrors (Pro)",
        manufacturer: "Stern",
        year: 2019,
        machineGroupId: ELVIRA_GROUP_ID,
        groupName: "Elvira's House of Horrors",
      },
      {
        pinballmapMachineId: ELVIRA_PREMIUM_ID,
        name: "Elvira's House of Horrors (Premium)",
        manufacturer: "Stern",
        year: 2019,
        opdbId: "GRBN4-MQGE5",
        ipdbId: 6587,
        machineGroupId: ELVIRA_GROUP_ID,
        groupName: "Elvira's House of Horrors",
      },
      {
        pinballmapMachineId: 70013,
        name: "Elvira's House of Horrors (LE)",
        manufacturer: "Stern",
        year: 2019,
        machineGroupId: ELVIRA_GROUP_ID,
        groupName: "Elvira's House of Horrors",
      },
      {
        pinballmapMachineId: 70020,
        name: "Elvira and the Party Monsters",
        manufacturer: "Bally",
        year: 1989,
      },
    ]);
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

    describe("pinballmap block (PP-u4ab.8)", () => {
      it("reports the linked catalog title, edition family, model metadata and listing state", async () => {
        const admin = await makeUser("admin");
        await seedElviraCatalog();
        const machine = await seedMachine({
          name: "Elvira's House of Horrors",
          pbm: {
            pinballmapMachineId: ELVIRA_PREMIUM_ID,
            pinballmapListed: true,
            pinballmapLmxId: 55555,
            manufacturer: "Stern",
            year: 2019,
            opdbId: "GRBN4-MQGE5",
            ipdbId: 6587,
          },
        });

        const outcome = await runGetMachine(
          { machine: machine.initials },
          ctx("admin", admin)
        );
        const { pinballmap } = outcome.result as {
          pinballmap: McpMachinePinballmap | null;
        };

        // The walk-the-floor question this bead exists for: "is our Elvira
        // recorded as the Premium?" must be answerable from this block alone.
        expect(pinballmap).toEqual({
          status: "linked",
          pinballmapMachineId: ELVIRA_PREMIUM_ID,
          title: "Elvira's House of Horrors (Premium)",
          machineGroupId: ELVIRA_GROUP_ID,
          group: "Elvira's House of Horrors",
          manufacturer: "Stern",
          year: 2019,
          opdbId: "GRBN4-MQGE5",
          ipdbId: 6587,
          listed: true,
          lmxId: 55555,
        });
      });

      it("reports a null title for a link the catalog mirror no longer holds", async () => {
        const admin = await makeUser("admin");
        const machine = await seedMachine({
          pbm: { pinballmapMachineId: 999_111 },
        });

        const outcome = await runGetMachine(
          { machine: machine.initials },
          ctx("admin", admin)
        );
        const { pinballmap } = outcome.result as {
          pinballmap: McpMachinePinballmap | null;
        };

        // Still "linked" — the stored id is real; the mirror just can't name it.
        expect(pinballmap).toMatchObject({
          status: "linked",
          pinballmapMachineId: 999_111,
          title: null,
          machineGroupId: null,
          group: null,
        });
      });

      it("reports the excluded state and its reason, not null", async () => {
        const admin = await makeUser("admin");
        const machine = await seedMachine({
          pbm: {
            pinballmapExcluded: true,
            pinballmapExcludedReason: "Homebrew, not a catalog title",
          },
        });

        const outcome = await runGetMachine(
          { machine: machine.initials },
          ctx("admin", admin)
        );
        const { pinballmap } = outcome.result as {
          pinballmap: McpMachinePinballmap | null;
        };

        // "Deliberately not on Pinball Map" is a recorded fact; collapsing it to
        // null would make it indistinguishable from "nobody has looked yet".
        expect(pinballmap).toEqual({
          status: "excluded",
          reason: "Homebrew, not a catalog title",
        });
      });

      it("returns pinballmap as an explicit null when neither linked nor excluded", async () => {
        const admin = await makeUser("admin");
        const machine = await seedMachine();

        const outcome = await runGetMachine(
          { machine: machine.initials },
          ctx("admin", admin)
        );
        const result = outcome.result as {
          pinballmap: McpMachinePinballmap | null;
        };

        expect(result.pinballmap).toBeNull();
        // Present-and-null, never absent: an omitted key reads as "this tool
        // doesn't report PBM state" rather than "this machine has none".
        expect(Object.keys(result)).toContain("pinballmap");
      });
    });
  });

  describe("search_pinballmap_catalog (PP-u4ab.8)", () => {
    it("returns the family with its edition count for a query", async () => {
      const admin = await makeUser("admin");
      await seedElviraCatalog();

      const outcome = await runSearchPinballmapCatalog(
        { query: "elvira" },
        ctx("admin", admin)
      );
      const result = outcome.result as McpCatalogFamilyResult;

      expect(result.mode).toBe("families");
      expect(result.hasMore).toBe(false);
      const family = result.families.find(
        (f) => f.machineGroupId === ELVIRA_GROUP_ID
      );
      expect(family?.editionCount).toBeGreaterThan(1);
      // A multi-edition family must NOT resolve to a single id — that's the
      // second step's job.
      expect(family?.pinballmapMachineId).toBeNull();
      // The standalone Bally title is its own family alongside the group.
      expect(result.returned).toBe(2);
    });

    it("returns a family's individual editions for its machineGroupId", async () => {
      const admin = await makeUser("admin");
      await seedElviraCatalog();

      const outcome = await runSearchPinballmapCatalog(
        { machineGroupId: ELVIRA_GROUP_ID },
        ctx("admin", admin)
      );
      const result = outcome.result as McpCatalogEditionResult;

      expect(result.mode).toBe("editions");
      expect(result.returned).toBe(3);
      expect(
        result.editions.find(
          (e) => e.name === "Elvira's House of Horrors (Premium)"
        )?.pinballmapMachineId
      ).toBe(ELVIRA_PREMIUM_ID);
      // The response says whose editions these are, so the caller can check it
      // got the family it asked for.
      expect(result.familyName).toBe("Elvira's House of Horrors");
      // No catalog row has 7001 as its machine id, so there's no ambiguity.
      expect(result.idAlsoMatchesEdition).toBeNull();
    });

    it("names the family it actually returned when the group id collides with an edition id", async () => {
      const admin = await makeUser("admin");
      await seedElviraCatalog();
      // PBM machine ids and machine-group ids are SEPARATE id spaces, so one
      // integer can be valid in both. Here Godzilla's machineGroupId is exactly
      // Elvira Premium's pinballmapMachineId — the collision that makes a
      // wrong-id lookup succeed with real rows, so the not_found guard cannot
      // fire and only the payload can reveal the mistake.
      await seedCatalog([
        {
          pinballmapMachineId: 80011,
          name: "Godzilla (Pro)",
          manufacturer: "Stern",
          year: 2021,
          machineGroupId: ELVIRA_PREMIUM_ID,
          groupName: "Godzilla",
        },
        {
          pinballmapMachineId: 80012,
          name: "Godzilla (Premium)",
          manufacturer: "Stern",
          year: 2021,
          machineGroupId: ELVIRA_PREMIUM_ID,
          groupName: "Godzilla",
        },
      ]);

      const outcome = await runSearchPinballmapCatalog(
        { machineGroupId: ELVIRA_PREMIUM_ID },
        ctx("admin", admin)
      );
      const result = outcome.result as McpCatalogEditionResult;

      // The worst outcome this tool can produce is linking a cabinet to the
      // wrong title from a plausible-looking payload. The response must name
      // the family it actually returned...
      expect(result.returned).toBe(2);
      expect(result.familyName).toBe("Godzilla");
      expect(result.editions.map((e) => e.name)).not.toContain(
        "Elvira's House of Horrors (Premium)"
      );
      // ...and point at the title the caller almost certainly meant.
      expect(result.idAlsoMatchesEdition).toEqual({
        pinballmapMachineId: ELVIRA_PREMIUM_ID,
        name: "Elvira's House of Horrors (Premium)",
      });
    });

    it("reports hasMore when more families match than the limit returns", async () => {
      const admin = await makeUser("admin");
      await seedElviraCatalog();

      const outcome = await runSearchPinballmapCatalog(
        { query: "elvira", limit: 1 },
        ctx("admin", admin)
      );
      const result = outcome.result as McpCatalogFamilyResult;

      expect(result.returned).toBe(1);
      expect(result.hasMore).toBe(true);
    });

    it("throws not_found for a group id no family has", async () => {
      const admin = await makeUser("admin");
      await seedElviraCatalog();

      // An empty success here would read as "that family has no editions" —
      // a confident answer to a lookup that never happened (CORE-ARCH-012).
      await expect(
        runSearchPinballmapCatalog(
          { machineGroupId: 424_242 },
          ctx("admin", admin)
        )
      ).rejects.toMatchObject({ reason: "not_found" });
    });

    it("throws not_found when handed an edition's pinballmapMachineId instead of the family's machineGroupId", async () => {
      const admin = await makeUser("admin");
      await seedElviraCatalog();

      // The families payload carries both ids as bare integers, so confusing
      // them is the predictable mistake. It must correct the caller, not hand
      // back an empty family it can report as fact.
      const error = await runSearchPinballmapCatalog(
        { machineGroupId: ELVIRA_PREMIUM_ID },
        ctx("admin", admin)
      ).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(McpToolError);
      expect((error as McpToolError).reason).toBe("not_found");
      expect((error as McpToolError).message).toContain("pinballmapMachineId");
    });

    it("returns a standalone title with its pinballmapMachineId already resolved", async () => {
      const admin = await makeUser("admin");
      await seedElviraCatalog();

      const outcome = await runSearchPinballmapCatalog(
        { query: "Party Monsters" },
        ctx("admin", admin)
      );
      const result = outcome.result as McpCatalogFamilyResult;

      // Most pre-1990s titles are standalone, so this is the common path for
      // our fleet: no group, one edition, id already in hand. A second call
      // with machineGroupId would be both impossible (it's null) and pointless.
      expect(result.returned).toBe(1);
      expect(result.families[0]?.machineGroupId).toBeNull();
      expect(result.families[0]?.editionCount).toBe(1);
      expect(result.families[0]?.pinballmapMachineId).toBe(70_020);
    });

    describe("when the catalog mirror is empty", () => {
      // No seedElviraCatalog() anywhere in this block: the mirror is a weekly
      // cron's output that no-ops on an empty upstream read, so "no rows at
      // all" is a live state on a fresh preview branch or a prod-seeded local.

      it("refuses to report a query as 'no such title'", async () => {
        const admin = await makeUser("admin");

        // Returning families: [] here would read as "that title isn't on
        // Pinball Map" — a claim about PBM made from a table we never filled.
        const error = await runSearchPinballmapCatalog(
          { query: "elvira" },
          ctx("admin", admin)
        ).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(McpToolError);
        expect((error as McpToolError).message).toContain("mirror is empty");
      });

      it("blames the empty mirror, not the caller's id, for an editions lookup", async () => {
        const admin = await makeUser("admin");

        const error = await runSearchPinballmapCatalog(
          { machineGroupId: ELVIRA_GROUP_ID },
          ctx("admin", admin)
        ).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(McpToolError);
        expect((error as McpToolError).message).toContain("mirror is empty");
        // The wrong-id diagnosis must NOT fire here: the id is fine, the table
        // is empty. Asserting a specific caller mistake we haven't established
        // is the confident wrong answer this whole guard exists to prevent.
        expect((error as McpToolError).message).not.toContain(
          "pinballmapMachineId"
        );
      });
    });

    it("rejects a call with neither query nor machineGroupId", async () => {
      const admin = await makeUser("admin");
      await expect(
        runSearchPinballmapCatalog({}, ctx("admin", admin))
      ).rejects.toMatchObject({ reason: "invalid" });
    });

    it("rejects a call with both query and machineGroupId", async () => {
      const admin = await makeUser("admin");
      await expect(
        runSearchPinballmapCatalog(
          { query: "elvira", machineGroupId: ELVIRA_GROUP_ID },
          ctx("admin", admin)
        )
      ).rejects.toMatchObject({ reason: "invalid" });
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

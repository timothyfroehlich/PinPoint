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
  invitedUsers,
  issueComments,
  issues,
  machines,
  pinballmapAbandonedListings,
  pinballmapCatalog,
  pinballmapState,
  timelineEvents,
  userProfiles,
} from "~/server/db/schema";
import { docToPlainText } from "~/lib/tiptap/types";
import {
  VALID_MACHINE_PRESENCE_STATUSES,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";
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

import { runAddIssueComment } from "~/lib/mcp/tools/add-issue-comment";
import { runAddMachine } from "~/lib/mcp/tools/add-machine";
import { runCreateIssue } from "~/lib/mcp/tools/create-issue";
import { runGetIssue } from "~/lib/mcp/tools/get-issue";
import { runGetMachine } from "~/lib/mcp/tools/get-machine";
import { registerPinpointTools } from "~/lib/mcp/tools";
import { runListIssues } from "~/lib/mcp/tools/list-issues";
import {
  listMachinesSchema,
  runListMachines,
} from "~/lib/mcp/tools/list-machines";
import { runSearchPinballmapCatalog } from "~/lib/mcp/tools/search-pinballmap-catalog";
import type {
  McpCatalogEditionResult,
  McpCatalogFamilyResult,
} from "~/lib/mcp/tools/search-pinballmap-catalog";
import type { McpMachinePinballmap } from "~/lib/mcp/tools/pinballmap-block";
import { runSetMachineAvailability } from "~/lib/mcp/tools/set-machine-availability";
import { runSetMachineName } from "~/lib/mcp/tools/set-machine-name";
import { runSetMachineOwner } from "~/lib/mcp/tools/set-machine-owner";
import {
  runSetMachinePinballmap,
  setMachinePinballmapSchema,
} from "~/lib/mcp/tools/set-machine-pinballmap";
import { updateMachineSchema } from "~/app/(app)/m/schemas";
import { updateMachinePbmLink } from "~/services/machines";
import { runUpdateIssue } from "~/lib/mcp/tools/update-issue";
import {
  McpToolError,
  resolveAssignee,
  resolveAssigneeFilter,
  resolveIssue,
} from "~/lib/mcp/tools/shared";

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
    pinballmapIntent?: "on" | "off" | "no_sync";
    modelName?: string;
    manufacturer?: string;
    year?: number;
    opdbId?: string;
    ipdbId?: number;
  }

  async function seedMachine(overrides?: {
    name?: string;
    ownerId?: string | null;
    presenceStatus?: MachinePresenceStatus;
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

    describe("presence set filter (PP-u4ab.13)", () => {
      interface PresencePage {
        count: number;
        total: number;
        hasMore: boolean;
        machines: { initials: string; presence: string }[];
      }

      async function list(
        args: Parameters<typeof runListMachines>[0],
        admin: string
      ): Promise<PresencePage> {
        const outcome = await runListMachines(args, ctx("admin", admin));
        return outcome.result as PresencePage;
      }

      /**
       * One cabinet in each presence state, all sharing a name so `search`
       * isolates them from the rest of the worker-scoped database.
       *
       * The `Record<MachinePresenceStatus, …>` return annotation is what keeps
       * this exhaustive: adding a sixth presence state fails to compile here
       * rather than quietly leaving it unseeded and untested.
       */
      async function seedOnePerState(
        name: string
      ): Promise<Record<MachinePresenceStatus, string>> {
        const seed = async (
          presenceStatus: MachinePresenceStatus
        ): Promise<string> =>
          (await seedMachine({ name, presenceStatus })).initials;
        return {
          on_the_floor: await seed("on_the_floor"),
          off_the_floor: await seed("off_the_floor"),
          on_loan: await seed("on_loan"),
          pending_arrival: await seed("pending_arrival"),
          removed: await seed("removed"),
        };
      }

      it("still accepts a single presence value", async () => {
        const admin = await makeUser("admin");
        const byState = await seedOnePerState("Single Presence");

        const result = await list(
          { search: "Single Presence", presence: "off_the_floor" },
          admin
        );

        // The pre-PP-u4ab.13 call shape. Every existing caller sends this, so
        // widening the parameter must not change what it means.
        expect(result.machines.map((m) => m.initials)).toEqual([
          byState.off_the_floor,
        ]);
        expect(result.total).toBe(1);
      });

      it("accepts a set and returns exactly the listed states", async () => {
        const admin = await makeUser("admin");
        const byState = await seedOnePerState("Set Presence");

        const result = await list(
          {
            search: "Set Presence",
            presence: ["on_the_floor", "on_loan", "off_the_floor"],
          },
          admin
        );

        // Set equality on the states, not just the row count: an OR that leaked
        // an unlisted state in while dropping a listed one returns the same
        // number of rows and would pass a length assertion.
        expect(new Set(result.machines.map((m) => m.presence))).toEqual(
          new Set(["on_the_floor", "on_loan", "off_the_floor"])
        );
        expect(result.machines.map((m) => m.initials).sort()).toEqual(
          [byState.on_the_floor, byState.on_loan, byState.off_the_floor].sort()
        );
        expect(result.total).toBe(3);
        expect(result.hasMore).toBe(false);
      });

      it("narrows the unlinked worklist to cabinets that are still around", async () => {
        const admin = await makeUser("admin");
        const db = await getTestDb();
        const byState = await seedOnePerState("Worklist");
        // A linked cabinet on the floor: in the presence set, out of the
        // worklist. Without it the presence filter alone would produce the same
        // answer as the two filters together.
        const linked = await seedMachine({
          name: "Worklist",
          presenceStatus: "on_the_floor",
        });
        await db
          .update(machines)
          .set({ pinballmapMachineId: 910_001 })
          .where(eq(machines.id, linked.id));

        const wide = await list(
          { search: "Worklist", pinballmap: "unlinked" },
          admin
        );
        const narrowed = await list(
          {
            search: "Worklist",
            pinballmap: "unlinked",
            presence: ["on_the_floor", "on_loan", "off_the_floor"],
          },
          admin
        );

        // This is the bead: 'unlinked' alone keeps handing back the cabinets
        // nobody will ever link, so they sit in every page of every sweep and
        // hold `total` above zero permanently.
        expect(wide.total).toBe(VALID_MACHINE_PRESENCE_STATUSES.length);
        expect(wide.machines.map((m) => m.presence)).toContain("removed");
        expect(wide.machines.map((m) => m.presence)).toContain(
          "pending_arrival"
        );

        expect(narrowed.machines.map((m) => m.initials).sort()).toEqual(
          [byState.on_the_floor, byState.on_loan, byState.off_the_floor].sort()
        );
        expect(narrowed.total).toBe(3);
      });

      it("counts the same set the page returns while paging a set filter", async () => {
        const admin = await makeUser("admin");
        const db = await getTestDb();

        const rows: (typeof machines.$inferInsert)[] = [];
        const expected: string[] = [];
        const wanted: MachinePresenceStatus[] = [
          "on_the_floor",
          "on_loan",
          "off_the_floor",
        ];
        for (let i = 0; i < 60; i += 1) {
          const initials = nextInitials();
          const presenceStatus =
            VALID_MACHINE_PRESENCE_STATUSES[
              i % VALID_MACHINE_PRESENCE_STATUSES.length
            ];
          if (presenceStatus === undefined) throw new Error("no state");
          // Four cabinets per title, so page boundaries land inside tie groups.
          const name = `Presence Fleet ${String(Math.floor(i / 4)).padStart(2, "0")}`;
          rows.push({ name, initials, presenceStatus });
          if (wanted.includes(presenceStatus)) expected.push(initials);
        }
        await db.insert(machines).values([...rows].reverse());

        const seen: string[] = [];
        const limit = 7;
        let offset = 0;
        let total = -1;
        // Bounded: a `hasMore` that never clears is one of the failures this
        // guards, and an unbounded loop would hang the suite instead.
        for (let page = 0; page < 12; page += 1) {
          const result = await list(
            { search: "Presence Fleet", presence: wanted, limit, offset },
            admin
          );
          total = result.total;
          seen.push(...result.machines.map((m) => m.initials));
          if (!result.hasMore) break;
          offset += limit;
        }

        // The condition is pushed onto the shared array, so the count query and
        // the page query see the same WHERE. A `total` the page can never reach
        // is a sweep that never terminates (CORE-ARCH-012).
        expect(total).toBe(expected.length);
        expect(new Set(seen).size).toBe(seen.length);
        expect([...seen].sort()).toEqual([...expected].sort());
      });

      it("rejects an empty presence set rather than matching nothing", () => {
        // An empty array would type-check and produce `inArray(col, [])` — a
        // predicate matching no row — so the tool would answer `total: 0` for
        // the whole collection as if that were the truth (CORE-ARCH-012).
        expect(listMachinesSchema.safeParse({ presence: [] }).success).toBe(
          false
        );
        expect(
          listMachinesSchema.safeParse({ presence: ["removed"] }).success
        ).toBe(true);
        expect(
          listMachinesSchema.safeParse({ presence: "removed" }).success
        ).toBe(true);
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

    describe("pinballmap block (PP-u4ab.8)", () => {
      it("reports the linked catalog title, edition family, model metadata and listing intent", async () => {
        const admin = await makeUser("admin");
        await seedElviraCatalog();
        const machine = await seedMachine({
          name: "Elvira's House of Horrors",
          pbm: {
            pinballmapMachineId: ELVIRA_PREMIUM_ID,
            pinballmapIntent: "on",
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
          catalogLookup: "found",
          title: "Elvira's House of Horrors (Premium)",
          machineGroupId: ELVIRA_GROUP_ID,
          group: "Elvira's House of Horrors",
          manufacturer: "Stern",
          year: 2019,
          opdbId: "GRBN4-MQGE5",
          ipdbId: 6587,
          intent: "on",
        });
      });

      it("calls a link stale only when the populated mirror really lacks the id", async () => {
        const admin = await makeUser("admin");
        // Mirror has rows — just not this id. Only then is "stale" a fact.
        await seedElviraCatalog();
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
          catalogLookup: "missing",
          title: null,
          machineGroupId: null,
          group: null,
        });
      });

      it("says the mirror is unpopulated rather than calling a good link stale", async () => {
        const admin = await makeUser("admin");
        // No seedElviraCatalog(): the mirror is empty, which is a live state on
        // a fresh preview branch or a local seeded from a prod dump.
        const machine = await seedMachine({
          pbm: { pinballmapMachineId: ELVIRA_PREMIUM_ID },
        });

        const outcome = await runGetMachine(
          { machine: machine.initials },
          ctx("admin", admin)
        );
        const { pinballmap } = outcome.result as {
          pinballmap: McpMachinePinballmap | null;
        };

        // Byte-identical to the stale case without this field — which would
        // report every linked machine in the fleet as broken when none is.
        expect(pinballmap).toMatchObject({
          status: "linked",
          pinballmapMachineId: ELVIRA_PREMIUM_ID,
          catalogLookup: "mirror_unpopulated",
          title: null,
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
      // wrong title from a plausible-looking payload. The one thing that
      // catches it is the response naming the family it actually returned: a
      // caller that asked about Elvira and reads "Godzilla" can see the miss.
      //
      // Nothing here flags the id itself. PBM group ids (small and dense) sit
      // inside the machine-id range (1..~10k), so "this integer is also a
      // machine id" is true for nearly every CORRECT group id — a flag on it
      // would fire on the common path and teach the caller to throw away good
      // results.
      expect(result.returned).toBe(2);
      expect(result.familyName).toBe("Godzilla");
      expect(result.editions.map((e) => e.name)).not.toContain(
        "Elvira's House of Horrors (Premium)"
      );
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

    it("sets the owner by a single-token name", async () => {
      // The PP-if48 regression: last name is optional, so a Discord signup has
      // none. Matching on `first_name || ' ' || last_name` compares
      // "PresidentNick " against "PresidentNick" and finds nobody — the picker
      // silently reports "no such member" for exactly the users the fix exists
      // to make findable. The generated `name` column is btrimmed; this asserts
      // the lookup uses it.
      const admin = await makeUser("admin");
      await makeUser("member", "PresidentNick", "");
      const machine = await seedMachine({ ownerId: null });

      const outcome = await runSetMachineOwner(
        { machine: machine.initials, owner: "PresidentNick" },
        ctx("admin", admin)
      );
      expect((outcome.result as { owner: string | null }).owner).toBe(
        "PresidentNick"
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

  describe("set_machine_pinballmap (PP-u4ab.12)", () => {
    /**
     * A lineup the local snapshot already holds. Auto-link reads this table and
     * never pinballmap.com (CORE-PBM-001, CORE-TEST-006); `enabled` is
     * load-bearing, since save-time auto-link stands down while the integration
     * is off.
     */
    async function seedLineup(
      rows: { id: number; machineId: number }[]
    ): Promise<void> {
      const db = await getTestDb();
      await db.insert(pinballmapState).values({
        id: "singleton",
        locationId: 26454,
        enabled: true,
        lastSyncStatus: "ok",
        snapshotJson: {
          locationId: 26454,
          name: "APC",
          dateLastUpdated: null,
          lastUpdatedByUsername: null,
          machineCount: rows.length,
          lmxes: rows.map((r) => ({
            ...r,
            icEnabled: null,
            lastUpdatedByUsername: null,
            conditions: [],
          })),
          fetchedAtIso: "2026-08-02T00:00:00Z",
          raw: {},
        },
      });
    }

    async function pbmRow(machineId: string): Promise<{
      pinballmapMachineId: number | null;
      pinballmapExcluded: boolean;
      pinballmapExcludedReason: string | null;
      pinballmapIntent: "on" | "off" | "no_sync";
      modelName: string | null;
      manufacturer: string | null;
      year: number | null;
      opdbId: string | null;
      ipdbId: number | null;
    }> {
      const db = await getTestDb();
      const row = await db.query.machines.findFirst({
        where: eq(machines.id, machineId),
        columns: {
          pinballmapMachineId: true,
          pinballmapExcluded: true,
          pinballmapExcludedReason: true,
          modelName: true,
          pinballmapIntent: true,
          manufacturer: true,
          year: true,
          opdbId: true,
          ipdbId: true,
        },
      });
      if (!row) throw new Error("machine vanished");
      return row;
    }

    it("links an unlinked machine and derives the metadata from the catalog", async () => {
      const admin = await makeUser("admin");
      await seedElviraCatalog();
      const machine = await seedMachine({ name: "Elvira" });

      const outcome = await runSetMachinePinballmap(
        { machine: machine.initials, pinballmapMachineId: ELVIRA_PREMIUM_ID },
        ctx("admin", admin)
      );

      // The echo is the same shape `get_machine` returns — one description of a
      // machine's PBM state, never a second one invented by the write path.
      expect(outcome.result).toMatchObject({
        initials: machine.initials,
        previousPinballmap: null,
        pinballmap: {
          status: "linked",
          pinballmapMachineId: ELVIRA_PREMIUM_ID,
          catalogLookup: "found",
          title: "Elvira's House of Horrors (Premium)",
          manufacturer: "Stern",
          year: 2019,
          opdbId: "GRBN4-MQGE5",
          ipdbId: 6587,
          intent: "off",
        },
      });

      // Model metadata is copied from the mirror, not accepted from the caller —
      // there is no argument that can write these four columns.
      expect(await pbmRow(machine.id)).toMatchObject({
        pinballmapMachineId: ELVIRA_PREMIUM_ID,
        manufacturer: "Stern",
        year: 2019,
        opdbId: "GRBN4-MQGE5",
        ipdbId: 6587,
      });
    });

    it("resets intent when an intent-On machine is re-targeted, and records the abandoned entry", async () => {
      const db = await getTestDb();
      const admin = await makeUser("admin");
      await seedElviraCatalog();
      // The entry the machine is about to walk away from has to be on the
      // stored lineup, because that is where the abandonment is resolved from.
      await seedLineup([{ id: 44_710, machineId: ELVIRA_PREMIUM_ID }]);
      const machine = await seedMachine({
        name: "Elvira",
        pbm: {
          pinballmapMachineId: ELVIRA_PREMIUM_ID,
          pinballmapIntent: "on",
          manufacturer: "Stern",
          year: 2019,
        },
      });

      const outcome = await runSetMachinePinballmap(
        { machine: machine.initials, pinballmapMachineId: 70_013 },
        ctx("admin", admin)
      );

      // The old public entry describes the OLD title, so it cannot follow the
      // machine to the new one (PP-l81u / PP-o355.19).
      expect(outcome.result).toMatchObject({
        pinballmap: {
          status: "linked",
          pinballmapMachineId: 70_013,
          title: "Elvira's House of Horrors (LE)",
          intent: "off",
        },
      });
      expect(await pbmRow(machine.id)).toMatchObject({
        pinballmapMachineId: 70_013,
        pinballmapIntent: "off",
      });

      // Resetting intent without writing down the live entry is what leaves an
      // orphan on pinballmap.com that nobody can find.
      const abandoned = await db
        .select()
        .from(pinballmapAbandonedListings)
        .where(eq(pinballmapAbandonedListings.machineId, machine.id));
      expect(abandoned).toHaveLength(1);
      expect(abandoned[0]).toMatchObject({
        lmxId: 44_710,
        pinballmapMachineId: ELVIRA_PREMIUM_ID,
      });
    });

    it("keeps intent when the SAME title is re-sent", async () => {
      const admin = await makeUser("admin");
      await seedElviraCatalog();
      const machine = await seedMachine({
        pbm: {
          pinballmapMachineId: ELVIRA_PREMIUM_ID,
          pinballmapIntent: "on",
        },
      });

      await runSetMachinePinballmap(
        { machine: machine.initials, pinballmapMachineId: ELVIRA_PREMIUM_ID },
        ctx("admin", admin)
      );

      // The carry-over is the whole reason intent is read from the row rather
      // than taken as an argument: a re-save that silently took a machine off
      // the lineup is PP-o355.19.
      expect(await pbmRow(machine.id)).toMatchObject({
        pinballmapMachineId: ELVIRA_PREMIUM_ID,
        pinballmapIntent: "on",
      });
    });

    it("marks a machine excluded, clearing any existing link and its metadata", async () => {
      const admin = await makeUser("admin");
      await seedElviraCatalog();
      const machine = await seedMachine({
        pbm: {
          pinballmapMachineId: ELVIRA_PREMIUM_ID,
          manufacturer: "Stern",
          year: 2019,
        },
      });

      const outcome = await runSetMachinePinballmap(
        {
          machine: machine.initials,
          pinballmapExcluded: true,
          pinballmapExcludedReason: "Homebrew, not a catalog title",
        },
        ctx("admin", admin)
      );

      expect(outcome.result).toMatchObject({
        pinballmap: {
          status: "excluded",
          reason: "Homebrew, not a catalog title",
        },
      });
      // `machines_pinballmap_link_exclusive` forbids linked AND excluded, so the
      // link has to come off in the same write — the row landing at all is the
      // proof the CHECK held.
      expect(await pbmRow(machine.id)).toMatchObject({
        pinballmapMachineId: null,
        pinballmapExcluded: true,
        pinballmapExcludedReason: "Homebrew, not a catalog title",
        manufacturer: null,
        year: null,
      });
    });

    it("leaves intent Off even when the title is already on the lineup", async () => {
      // Auto-link used to capture the entry here and flip the machine on. Spec
      // 5.1 forbids it: matching a cabinet to a title says what game it is, not
      // that somebody wants it on a public lineup, and inferring the second
      // from the first is exactly how a deliberate Off gets overridden.
      //
      // The honest result is the machine reading as Lingering afterwards — an
      // entry on the lineup that nothing covers — which is a state with a
      // control attached rather than a decision made on the operator's behalf.
      const admin = await makeUser("admin");
      await seedElviraCatalog();
      await seedLineup([{ id: 88_001, machineId: ELVIRA_PREMIUM_ID }]);
      const machine = await seedMachine({ name: "Elvira" });

      const outcome = await runSetMachinePinballmap(
        { machine: machine.initials, pinballmapMachineId: ELVIRA_PREMIUM_ID },
        ctx("admin", admin)
      );

      expect(outcome.result).toMatchObject({
        pinballmap: { status: "linked", intent: "off" },
      });
      expect(await pbmRow(machine.id)).toMatchObject({
        pinballmapIntent: "off",
      });
    });

    it("links a duplicate cabinet without disturbing the other one's intent", async () => {
      const admin = await makeUser("admin");
      await seedElviraCatalog();
      await seedLineup([{ id: 88_001, machineId: ELVIRA_PREMIUM_ID }]);
      const incumbent = await seedMachine({
        name: "Elvira (by the door)",
        pbm: {
          pinballmapMachineId: ELVIRA_PREMIUM_ID,
          pinballmapIntent: "on",
        },
      });
      const duplicate = await seedMachine({ name: "Elvira (back row)" });

      // Two cabinets of one title is ordinary in a 100+ machine collection, and
      // under the coverage model (PP-o355.21) both may be On at once — there is
      // no unique index left to trip. This must succeed quietly.
      const outcome = await runSetMachinePinballmap(
        { machine: duplicate.initials, pinballmapMachineId: ELVIRA_PREMIUM_ID },
        ctx("admin", admin)
      );

      expect(outcome.result).toMatchObject({
        pinballmap: {
          status: "linked",
          pinballmapMachineId: ELVIRA_PREMIUM_ID,
          intent: "off",
        },
      });
      // The other cabinet keeps its intent: an edit to one machine must never
      // silently change what another says about the public lineup.
      expect(await pbmRow(incumbent.id)).toMatchObject({
        pinballmapIntent: "on",
      });
    });

    it("denies a member who does not own the machine", async () => {
      const member = await makeUser("member", "Not", "Owner");
      await seedElviraCatalog();
      const machine = await seedMachine({ name: "Elvira" });

      await expect(
        runSetMachinePinballmap(
          { machine: machine.initials, pinballmapMachineId: ELVIRA_PREMIUM_ID },
          ctx("member", member)
        )
      ).rejects.toMatchObject({ reason: "denied" });

      // Denied means nothing was written, not "written and reported as denied".
      expect(await pbmRow(machine.id)).toMatchObject({
        pinballmapMachineId: null,
      });
    });

    it("lets the machine's owner set its title", async () => {
      const owner = await makeUser("member", "Pat", "Owner");
      await seedElviraCatalog();
      const machine = await seedMachine({ name: "Elvira", ownerId: owner });

      await runSetMachinePinballmap(
        { machine: machine.initials, pinballmapMachineId: ELVIRA_PREMIUM_ID },
        ctx("member", owner)
      );

      expect(await pbmRow(machine.id)).toMatchObject({
        pinballmapMachineId: ELVIRA_PREMIUM_ID,
      });
    });

    it("refuses a call that states neither a title nor exclusion, instead of unlinking", async () => {
      const admin = await makeUser("admin");
      await seedElviraCatalog();
      const machine = await seedMachine({
        pbm: { pinballmapMachineId: ELVIRA_PREMIUM_ID, manufacturer: "Stern" },
      });

      await expect(
        runSetMachinePinballmap(
          { machine: machine.initials },
          ctx("admin", admin)
        )
      ).rejects.toMatchObject({ reason: "invalid" });

      // The resolver reads "neither" as "clear everything", which is right for a
      // human emptying the picker and catastrophic for a forgotten argument.
      expect(await pbmRow(machine.id)).toMatchObject({
        pinballmapMachineId: ELVIRA_PREMIUM_ID,
      });
    });

    it("refuses a call that is both linked and excluded", async () => {
      const admin = await makeUser("admin");
      await seedElviraCatalog();
      const machine = await seedMachine();

      await expect(
        runSetMachinePinballmap(
          {
            machine: machine.initials,
            pinballmapMachineId: ELVIRA_PREMIUM_ID,
            pinballmapExcluded: true,
          },
          ctx("admin", admin)
        )
      ).rejects.toMatchObject({ reason: "invalid" });
    });

    it("rejects a catalog id the mirror does not have", async () => {
      const admin = await makeUser("admin");
      await seedElviraCatalog();
      const machine = await seedMachine();

      // The predictable mistake is passing a `machineGroupId` where a
      // `pinballmapMachineId` belongs. A group id that matches no catalog row
      // must fail rather than store a link to a title we cannot name.
      await expect(
        runSetMachinePinballmap(
          { machine: machine.initials, pinballmapMachineId: ELVIRA_GROUP_ID },
          ctx("admin", admin)
        )
      ).rejects.toMatchObject({ reason: "invalid" });
      expect(await pbmRow(machine.id)).toMatchObject({
        pinballmapMachineId: null,
      });
    });

    it("throws not_found when the machine is unknown", async () => {
      const admin = await makeUser("admin");
      await expect(
        runSetMachinePinballmap(
          { machine: "NOPE", pinballmapMachineId: 1 },
          ctx("admin", admin)
        )
      ).rejects.toMatchObject({ reason: "not_found" });
    });

    it("reports the state it actually replaced, read under the write's own lock", async () => {
      const admin = await makeUser("admin");
      await seedElviraCatalog();
      const machine = await seedMachine({
        name: "Elvira",
        pbm: {
          pinballmapMachineId: ELVIRA_PREMIUM_ID,
          manufacturer: "Stern",
          year: 2019,
        },
      });

      const outcome = await runSetMachinePinballmap(
        { machine: machine.initials, pinballmapMachineId: 70_013 },
        ctx("admin", admin)
      );

      // `previousPinballmap` comes from the FOR UPDATE read inside the write,
      // not from the resolve that ran before the permission check — so it names
      // the state this call displaced even if something moved in between.
      expect(outcome.result).toMatchObject({
        previousPinballmap: {
          status: "linked",
          pinballmapMachineId: ELVIRA_PREMIUM_ID,
        },
        pinballmap: { status: "linked", pinballmapMachineId: 70_013 },
      });
    });

    it("reports not_found, not a success payload, when the row is gone", async () => {
      // Straight at the service: the tool's own `resolveMachine` would reject an
      // unknown ref long before this guard, so the only way to exercise it is to
      // hand the write a machineId that resolves to nothing. Without the guard
      // this returned `ok` with the columns it MEANT to write — a confident
      // wrong answer about a row that does not exist (CORE-ARCH-012).
      const admin = await makeUser("admin");
      await seedElviraCatalog();

      const result = await updateMachinePbmLink({
        machineId: randomUUID(),
        actorUserId: admin,
        selection: { pinballmapMachineId: ELVIRA_PREMIUM_ID },
      });

      expect(result).toMatchObject({ ok: false, reason: "not_found" });
    });

    it("keeps a stored exclusion reason when the exclusion is re-confirmed without one", async () => {
      // The fleet pass (PP-h059) re-confirms exclusions it did not author, and
      // the natural call carries no reason. Writing `reason ?? null` there would
      // erase someone else's note on every machine it walked past — the same
      // "a forgotten argument must not destroy stored state" rule that stops a
      // missing id from wiping a link (CORE-ARCH-012).
      const admin = await makeUser("admin");
      const machine = await seedMachine({
        name: "Unicorn Magic",
        pbm: {
          pinballmapExcluded: true,
          pinballmapExcludedReason: "homebrew — one-off cabinet",
        },
      });

      await runSetMachinePinballmap(
        { machine: machine.initials, pinballmapExcluded: true },
        ctx("admin", admin)
      );

      expect(await pbmRow(machine.id)).toMatchObject({
        pinballmapExcluded: true,
        pinballmapExcludedReason: "homebrew — one-off cabinet",
      });
    });

    it("keeps a hand-entered model when the exclusion is re-confirmed", async () => {
      // PP-3bbr put `modelName`/`manufacturer`/`year` in the same column set as
      // the exclusion reason, and the resolver writes each as `value ?? null`.
      // That is right for the edit form, which always posts all three — but
      // `set_machine_pinballmap` has no field for ANY of them, so it cannot
      // send them even in principle. Before the carry-over covered them, the
      // fleet pass (PP-h059) re-confirming this machine's exclusion would have
      // nulled the whole identity of a game whose only source is a person who
      // typed it, flipping the Info tab's Model row to "Not specified".
      const admin = await makeUser("admin");
      const machine = await seedMachine({
        name: "Fireball",
        pbm: {
          pinballmapExcluded: true,
          pinballmapExcludedReason: "home-brew conversion",
          modelName: "Fireball (home-brew conversion)",
          manufacturer: "Bally",
          year: 1972,
        },
      });

      await runSetMachinePinballmap(
        { machine: machine.initials, pinballmapExcluded: true },
        ctx("admin", admin)
      );

      expect(await pbmRow(machine.id)).toMatchObject({
        pinballmapExcluded: true,
        pinballmapExcludedReason: "home-brew conversion",
        modelName: "Fireball (home-brew conversion)",
        manufacturer: "Bally",
        year: 1972,
      });
    });

    it("replaces a stored exclusion reason when the caller sends a new one", async () => {
      // The carry-over is a floor, not a lock: a caller that states a reason
      // still overwrites whatever was there.
      const admin = await makeUser("admin");
      const machine = await seedMachine({
        name: "Border Town",
        pbm: {
          pinballmapExcluded: true,
          pinballmapExcludedReason: "homebrew — one-off cabinet",
        },
      });

      await runSetMachinePinballmap(
        {
          machine: machine.initials,
          pinballmapExcluded: true,
          pinballmapExcludedReason: "1940 pre-flipper, not a catalog title",
        },
        ctx("admin", admin)
      );

      expect(await pbmRow(machine.id)).toMatchObject({
        pinballmapExcluded: true,
        pinballmapExcludedReason: "1940 pre-flipper, not a catalog title",
      });
    });

    it("does not carry a reason onto a machine that was not already excluded", async () => {
      // The carry-over reads the STORED exclusion, so a machine being excluded
      // for the first time gets no reason invented for it — and a machine
      // moving from excluded to LINKED keeps none either (the resolver clears
      // the whole column set on that branch).
      const admin = await makeUser("admin");
      await seedElviraCatalog();
      const machine = await seedMachine({
        name: "Hyperball",
        pbm: {
          pinballmapExcluded: true,
          pinballmapExcludedReason: "rapid-fire hybrid, not a pinball title",
        },
      });

      await runSetMachinePinballmap(
        { machine: machine.initials, pinballmapMachineId: ELVIRA_PREMIUM_ID },
        ctx("admin", admin)
      );

      expect(await pbmRow(machine.id)).toMatchObject({
        pinballmapExcluded: false,
        pinballmapExcludedReason: null,
        pinballmapMachineId: ELVIRA_PREMIUM_ID,
      });
    });

    it("rejects an empty exclusion reason, which the edit form must accept", () => {
      // Deliberate divergence, not drift: an emptied input is how a human
      // clears a reason, but from a tool call "" is a field filled with
      // nothing — and accepting it would make the carry-over hinge on whether
      // the caller sent "" or nothing at all.
      expect(
        setMachinePinballmapSchema
          .pick({ pinballmapExcludedReason: true })
          .safeParse({ pinballmapExcludedReason: "   " }).success
      ).toBe(false);
      expect(
        updateMachineSchema
          .pick({ pinballmapExcludedReason: true })
          .safeParse({ pinballmapExcludedReason: "" }).success
      ).toBe(true);
    });

    it("caps an exclusion reason exactly where the edit form caps it", () => {
      // Both schemas write `pinballmap_excluded_reason`, and the edit form
      // PREFILLS it. A reason accepted here but rejected there would render into
      // an input that fails validation on every later save from that page,
      // wedging the picker behind text the user never typed. Asserted against
      // the form's own schema so the two cannot drift apart silently.
      const tooLong = { pinballmapExcludedReason: "x".repeat(201) };
      const atLimit = { pinballmapExcludedReason: "x".repeat(200) };

      expect(
        setMachinePinballmapSchema
          .pick({ pinballmapExcludedReason: true })
          .safeParse(tooLong).success
      ).toBe(false);
      expect(
        updateMachineSchema
          .pick({ pinballmapExcludedReason: true })
          .safeParse(tooLong).success
      ).toBe(false);

      expect(
        setMachinePinballmapSchema
          .pick({ pinballmapExcludedReason: true })
          .safeParse(atLimit).success
      ).toBe(true);
      expect(
        updateMachineSchema
          .pick({ pinballmapExcludedReason: true })
          .safeParse(atLimit).success
      ).toBe(true);
    });
  });

  describe("resolveIssue / resolveAssignee (PP-u4ab.14)", () => {
    it("resolves an issue by machine initials and number", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ name: "Attack from Mars" });
      await runCreateIssue(
        { machine: machine.initials, title: "left flipper weak" },
        ctx("admin", admin)
      );

      // Lower-cased on purpose: initials resolution is case-insensitive.
      const resolved = await resolveIssue(machine.initials.toLowerCase(), 1);
      expect(resolved.issueNumber).toBe(1);
      expect(resolved.machineInitials).toBe(machine.initials);
      expect(resolved.title).toBe("left flipper weak");
      expect(resolved.status).toBe("new");
    });

    it("resolves by machine UUID as well as initials", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ name: "Medieval Madness" });
      await runCreateIssue(
        { machine: machine.initials, title: "ball stuck" },
        ctx("admin", admin)
      );

      const resolved = await resolveIssue(machine.id, 1);
      expect(resolved.machineInitials).toBe(machine.initials);
    });

    it("throws not_found for an unknown issue number, naming list_issues", async () => {
      const machine = await seedMachine({ name: "Twilight Zone" });
      await expect(resolveIssue(machine.initials, 99)).rejects.toMatchObject({
        reason: "not_found",
      });
      await expect(resolveIssue(machine.initials, 99)).rejects.toThrow(
        /list_issues/
      );
    });

    it("resolves an assignee by full name and by UUID, and empty clears", async () => {
      const tech = await makeUser("technician", "Ada", "Lovelace");
      expect(await resolveAssignee("Ada Lovelace")).toBe(tech);
      expect(await resolveAssignee(tech)).toBe(tech);
      expect(await resolveAssignee(null)).toBeNull();
      expect(await resolveAssignee("   ")).toBeNull();
    });

    it("rejects an ambiguous assignee name with the candidate UUIDs", async () => {
      const a = await makeUser("member", "Sam", "Jones");
      const b = await makeUser("member", "Sam", "Jones");
      await expect(resolveAssignee("Sam Jones")).rejects.toThrow(
        /Pass the specific UUID/
      );
      await expect(resolveAssignee("Sam Jones")).rejects.toThrow(
        new RegExp(`${a}|${b}`)
      );
    });

    it("rejects a guest as an assignee", async () => {
      await makeUser("guest", "Guest", "Person");
      await expect(resolveAssignee("Guest Person")).rejects.toThrow(/guest/i);
    });

    /**
     * The filter resolver answers a different question than `resolveAssignee`:
     * who does this name refer to, not who may be given work. A guest resolves
     * (they may still hold issues from before the demotion), and two people
     * sharing a name are ambiguous even when only one of them is assignable —
     * silently picking the assignable one would filter on a person the caller
     * never named.
     */
    it("resolves a guest for the read filter, and still rejects ambiguity", async () => {
      const guest = await makeUser("guest", "Guest", "Person");
      expect(await resolveAssigneeFilter("Guest Person")).toBe(guest);
      expect(await resolveAssigneeFilter(guest)).toBe(guest);

      await makeUser("guest", "Pat", "Kim");
      await makeUser("member", "Pat", "Kim");
      await expect(resolveAssigneeFilter("Pat Kim")).rejects.toMatchObject({
        reason: "invalid",
      });

      await expect(resolveAssigneeFilter(randomUUID())).rejects.toMatchObject({
        reason: "not_found",
      });
    });

    it("rejects an invited user id — issues have no invited-assignee column", async () => {
      const db = await getTestDb();
      const invitedId = randomUUID();
      await db.insert(invitedUsers).values({
        id: invitedId,
        email: `${invitedId}@example.com`,
        firstName: "Invited",
        lastName: "Person",
        role: "member",
      });

      // resolveOwner accepts this shape (machines carry invitedOwnerId).
      // assigned_to references user_profiles only, so it must be rejected
      // rather than silently dropped.
      await expect(resolveAssignee(invitedId)).rejects.toMatchObject({
        reason: "not_found",
      });
    });
  });

  describe("add_issue_comment (PP-u4ab.14)", () => {
    it("posts a comment and reports created: true", async () => {
      const admin = await makeUser("admin", "Tim", "Froehlich");
      const machine = await seedMachine({ name: "Attack from Mars" });
      await runCreateIssue(
        { machine: machine.initials, title: "left flipper weak" },
        ctx("admin", admin)
      );

      const outcome = await runAddIssueComment(
        {
          machine: machine.initials,
          number: 1,
          comment: "Checked the coil sleeve.",
        },
        ctx("admin", admin)
      );
      const result = outcome.result as { created: boolean; commentId: string };

      expect(result.created).toBe(true);
      expect(result.commentId).toBeDefined();

      const db = await getTestDb();
      const rows = await db.query.issueComments.findMany({
        where: eq(issueComments.issueId, outcome.issueId ?? ""),
      });
      expect(rows).toHaveLength(1);
    });

    /**
     * The regression this pins: `created` must come from the service's explicit
     * `deduped` flag, never from an empty delivery plan. Here the commenter is
     * the ONLY watcher and `getChannels` is mocked to `[]`, so a genuinely new
     * comment produces zero deliveries — the exact case where the empty-plan
     * proxy would report `created: false` for a real write.
     */
    it("reports created: true even when the comment notifies nobody", async () => {
      const admin = await makeUser("admin", "Solo", "Reporter");
      const machine = await seedMachine({ name: "Fish Tales" });
      await runCreateIssue(
        { machine: machine.initials, title: "right ramp rejects" },
        ctx("admin", admin)
      );

      const outcome = await runAddIssueComment(
        { machine: machine.initials, number: 1, comment: "Bent the flap." },
        ctx("admin", admin)
      );

      expect((outcome.result as { created: boolean }).created).toBe(true);
    });

    it("dedupes an identical retry and reports created: false", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ name: "Medieval Madness" });
      await runCreateIssue(
        { machine: machine.initials, title: "ball stuck" },
        ctx("admin", admin)
      );

      const args = {
        machine: machine.initials,
        number: 1,
        comment: "Same text.",
      };
      const first = await runAddIssueComment(args, ctx("admin", admin));
      const second = await runAddIssueComment(args, ctx("admin", admin));

      expect((first.result as { created: boolean }).created).toBe(true);
      expect((second.result as { created: boolean }).created).toBe(false);
      expect((second.result as { commentId: string }).commentId).toBe(
        (first.result as { commentId: string }).commentId
      );

      const db = await getTestDb();
      const rows = await db.query.issueComments.findMany({
        where: eq(issueComments.issueId, second.issueId ?? ""),
      });
      expect(rows).toHaveLength(1);
    });

    it("treats a different comment on the same issue as a new post", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ name: "Cirqus Voltaire" });
      await runCreateIssue(
        { machine: machine.initials, title: "ringmaster stuck" },
        ctx("admin", admin)
      );

      await runAddIssueComment(
        { machine: machine.initials, number: 1, comment: "First note." },
        ctx("admin", admin)
      );
      const second = await runAddIssueComment(
        { machine: machine.initials, number: 1, comment: "Second note." },
        ctx("admin", admin)
      );

      expect((second.result as { created: boolean }).created).toBe(true);

      const db = await getTestDb();
      const rows = await db.query.issueComments.findMany({
        where: eq(issueComments.issueId, second.issueId ?? ""),
      });
      expect(rows).toHaveLength(2);
    });

    it("throws not_found for an issue number that does not exist", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ name: "Twilight Zone" });

      await expect(
        runAddIssueComment(
          { machine: machine.initials, number: 7, comment: "hi" },
          ctx("admin", admin)
        )
      ).rejects.toMatchObject({ reason: "not_found" });
    });
  });

  /**
   * Every other test here calls a `run*` handler directly, which passes whether
   * or not the tool is registered. `registerPinpointTools` is therefore the one
   * place a finished tool can be silently absent from the surface, so the
   * catalog gets asserted by name.
   *
   * `whoami` is deliberately not in this list — it is registered on the route
   * itself, not through this function.
   */
  it("registers every tool in the catalog", () => {
    const registered: string[] = [];
    const fakeServer = {
      registerTool: (name: string) => {
        registered.push(name);
      },
    } as unknown as Parameters<typeof registerPinpointTools>[0];

    registerPinpointTools(fakeServer);

    expect(registered.sort()).toEqual([
      "add_issue_comment",
      "add_machine",
      "create_issue",
      "get_issue",
      "get_machine",
      "list_issues",
      "list_machines",
      "search_pinballmap_catalog",
      "set_machine_availability",
      "set_machine_name",
      "set_machine_owner",
      "set_machine_pinballmap",
      "update_issue",
    ]);
  });

  describe("list_issues (PP-u4ab.14)", () => {
    it("defaults to open issues only", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ name: "Attack from Mars" });
      await runCreateIssue(
        { machine: machine.initials, title: "open one" },
        ctx("admin", admin)
      );
      await runCreateIssue(
        { machine: machine.initials, title: "closed one" },
        ctx("admin", admin)
      );
      await runUpdateIssue(
        { machine: machine.initials, number: 2, status: "fixed" },
        ctx("admin", admin)
      );

      const outcome = await runListIssues(
        { machine: machine.initials },
        ctx("admin", admin)
      );
      const result = outcome.result as {
        total: number;
        issues: { title: string }[];
      };
      expect(result.total).toBe(1);
      expect(result.issues[0]?.title).toBe("open one");
    });

    it("accepts the 'closed' shorthand and an explicit status set", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ name: "Medieval Madness" });
      await runCreateIssue(
        { machine: machine.initials, title: "a" },
        ctx("admin", admin)
      );
      await runCreateIssue(
        { machine: machine.initials, title: "b" },
        ctx("admin", admin)
      );
      await runUpdateIssue(
        { machine: machine.initials, number: 2, status: "wont_fix" },
        ctx("admin", admin)
      );

      const closed = await runListIssues(
        { machine: machine.initials, status: "closed" },
        ctx("admin", admin)
      );
      expect((closed.result as { total: number }).total).toBe(1);

      const both = await runListIssues(
        { machine: machine.initials, status: ["new", "wont_fix"] },
        ctx("admin", admin)
      );
      expect((both.result as { total: number }).total).toBe(2);

      const single = await runListIssues(
        { machine: machine.initials, status: "wont_fix" },
        ctx("admin", admin)
      );
      expect((single.result as { total: number }).total).toBe(1);
    });

    it("keeps the page and the total in agreement while paging", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ name: "Twilight Zone" });
      for (let i = 0; i < 5; i++) {
        await runCreateIssue(
          { machine: machine.initials, title: `issue ${i}` },
          ctx("admin", admin)
        );
      }

      const page = await runListIssues(
        { machine: machine.initials, limit: 2, offset: 0 },
        ctx("admin", admin)
      );
      expect(page.result).toMatchObject({
        count: 2,
        total: 5,
        offset: 0,
        hasMore: true,
      });

      const last = await runListIssues(
        { machine: machine.initials, limit: 2, offset: 4 },
        ctx("admin", admin)
      );
      expect(last.result).toMatchObject({ count: 1, total: 5, hasMore: false });
    });

    it("returns a total order, so paging never skips or repeats a row", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ name: "Fish Tales" });
      // Created in one loop, so several rows share a createdAt to the second —
      // exactly the case a createdAt-only sort would leave underdetermined.
      for (let i = 0; i < 6; i++) {
        await runCreateIssue(
          { machine: machine.initials, title: `tie ${i}` },
          ctx("admin", admin)
        );
      }

      const seen: number[] = [];
      for (let offset = 0; offset < 6; offset += 2) {
        const page = await runListIssues(
          { machine: machine.initials, limit: 2, offset },
          ctx("admin", admin)
        );
        seen.push(
          ...(page.result as { issues: { number: number }[] }).issues.map(
            (i) => i.number
          )
        );
      }

      expect(seen).toHaveLength(6);
      expect(new Set(seen).size).toBe(6);
    });

    it("searches across machines when none is named", async () => {
      const admin = await makeUser("admin");
      const first = await seedMachine({ name: "Cirqus Voltaire" });
      const second = await seedMachine({ name: "Monster Bash" });
      await runCreateIssue(
        { machine: first.initials, title: "first one" },
        ctx("admin", admin)
      );
      await runCreateIssue(
        { machine: second.initials, title: "second one" },
        ctx("admin", admin)
      );

      const scoped = await runListIssues(
        { machine: first.initials },
        ctx("admin", admin)
      );
      expect((scoped.result as { total: number }).total).toBe(1);

      const all = await runListIssues({}, ctx("admin", admin));
      const machinesSeen = new Set(
        (all.result as { issues: { machine: string }[] }).issues.map(
          (i) => i.machine
        )
      );
      expect(machinesSeen.has(first.initials)).toBe(true);
      expect(machinesSeen.has(second.initials)).toBe(true);
    });

    it("filters by severity and by assignee", async () => {
      const admin = await makeUser("admin");
      const tech = await makeUser("technician", "Ada", "Lovelace");
      const machine = await seedMachine({ name: "Ghostbusters" });
      await runCreateIssue(
        { machine: machine.initials, title: "major one", severity: "major" },
        ctx("admin", admin)
      );
      await runCreateIssue(
        {
          machine: machine.initials,
          title: "cosmetic one",
          severity: "cosmetic",
        },
        ctx("admin", admin)
      );
      await runUpdateIssue(
        { machine: machine.initials, number: 1, assignee: tech },
        ctx("admin", admin)
      );

      const bySeverity = await runListIssues(
        { machine: machine.initials, severity: "major" },
        ctx("admin", admin)
      );
      const severityResult = bySeverity.result as {
        total: number;
        issues: { title: string; assignee: string | null }[];
      };
      expect(severityResult.total).toBe(1);
      expect(severityResult.issues[0]?.title).toBe("major one");
      expect(severityResult.issues[0]?.assignee).toBe("Ada Lovelace");

      const byAssignee = await runListIssues(
        { machine: machine.initials, assignee: "Ada Lovelace" },
        ctx("admin", admin)
      );
      expect((byAssignee.result as { total: number }).total).toBe(1);
    });

    /**
     * A filter name that narrows nothing is worse than an error: it returns the
     * whole collection under a `total` that reads as authoritative
     * (CORE-ARCH-012). An unresolvable assignee must throw, not fall through.
     */
    it("throws rather than ignoring an unresolvable assignee filter", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ name: "Monster Bash" });
      await runCreateIssue(
        { machine: machine.initials, title: "mummy stuck" },
        ctx("admin", admin)
      );

      await expect(
        runListIssues({ assignee: "Nobody Here" }, ctx("admin", admin))
      ).rejects.toMatchObject({ reason: "not_found" });
    });

    /**
     * The assignee filter asks who a name REFERS TO, not who may be assigned
     * work. Routing it through `resolveAssignee` — the write-eligibility
     * resolver — gets the wrong answer for rows that already exist: demoting a
     * member to guest does not unassign their issues, so the filter would throw
     * "no assignable member" for a name whose issues are sitting right there
     * (CORE-ARCH-012).
     *
     * The last assertion is the other half: the read widened, the write did not.
     */
    it("finds issues assigned to a member who was later demoted to guest", async () => {
      const admin = await makeUser("admin");
      const demoted = await makeUser("technician", "Grace", "Hopper");
      const machine = await seedMachine({ name: "Medieval Madness" });
      await runCreateIssue(
        { machine: machine.initials, title: "trolls stuck down" },
        ctx("admin", admin)
      );
      await runUpdateIssue(
        { machine: machine.initials, number: 1, assignee: demoted },
        ctx("admin", admin)
      );

      const db = await getTestDb();
      await db
        .update(userProfiles)
        .set({ role: "guest" })
        .where(eq(userProfiles.id, demoted));

      const byName = await runListIssues(
        { machine: machine.initials, assignee: "Grace Hopper" },
        ctx("admin", admin)
      );
      expect((byName.result as { total: number }).total).toBe(1);

      const byId = await runListIssues(
        { machine: machine.initials, assignee: demoted },
        ctx("admin", admin)
      );
      expect((byId.result as { total: number }).total).toBe(1);

      await expect(
        runUpdateIssue(
          { machine: machine.initials, number: 1, assignee: "Grace Hopper" },
          ctx("admin", admin)
        )
      ).rejects.toMatchObject({ reason: "not_found" });
    });
  });

  describe("get_issue (PP-u4ab.14)", () => {
    it("returns full detail with the comment thread and no emails", async () => {
      const admin = await makeUser("admin", "Tim", "Froehlich");
      const machine = await seedMachine({ name: "Attack from Mars" });
      await runCreateIssue(
        {
          machine: machine.initials,
          title: "left flipper weak",
          description: "Barely reaches the ramp.",
          severity: "major",
        },
        ctx("admin", admin)
      );
      await runAddIssueComment(
        {
          machine: machine.initials,
          number: 1,
          comment: "Checked the coil sleeve.",
        },
        ctx("admin", admin)
      );

      const outcome = await runGetIssue(
        { machine: machine.initials, number: 1 },
        ctx("admin", admin)
      );
      const result = outcome.result as {
        title: string;
        description: string;
        severity: string;
        status: string;
        reporter: string;
        assignee: string | null;
        url: string;
        comments: { author: string; text: string; createdAt: string }[];
      };

      expect(result.title).toBe("left flipper weak");
      expect(result.description).toBe("Barely reaches the ramp.");
      expect(result.severity).toBe("major");
      expect(result.status).toBe("new");
      expect(result.reporter).toBe("Tim Froehlich");
      expect(result.assignee).toBeNull();
      expect(result.url).toContain(`/m/${machine.initials}/i/1`);
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0]).toMatchObject({
        author: "Tim Froehlich",
        text: "Checked the coil sleeve.",
      });

      // CORE-SEC-007: no email may reach an MCP caller. The seeded users all
      // carry `<uuid>@example.com`, so an "@" anywhere in the payload is a leak.
      expect(JSON.stringify(result)).not.toContain("@");
    });

    it("reports the assignee's name once one is set", async () => {
      const admin = await makeUser("admin");
      const tech = await makeUser("technician", "Ada", "Lovelace");
      const machine = await seedMachine({ name: "Medieval Madness" });
      await runCreateIssue(
        { machine: machine.initials, title: "ball stuck" },
        ctx("admin", admin)
      );
      await runUpdateIssue(
        { machine: machine.initials, number: 1, assignee: tech },
        ctx("admin", admin)
      );

      const outcome = await runGetIssue(
        { machine: machine.initials, number: 1 },
        ctx("admin", admin)
      );
      expect((outcome.result as { assignee: string | null }).assignee).toBe(
        "Ada Lovelace"
      );
    });

    it("excludes system rows from the thread", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ name: "Twilight Zone" });
      await runCreateIssue(
        { machine: machine.initials, title: "scoop weak" },
        ctx("admin", admin)
      );
      // A status change writes a system row against the issue.
      await runUpdateIssue(
        { machine: machine.initials, number: 1, status: "confirmed" },
        ctx("admin", admin)
      );

      const outcome = await runGetIssue(
        { machine: machine.initials, number: 1 },
        ctx("admin", admin)
      );
      const result = outcome.result as {
        comments: unknown[];
        commentCount: number;
      };
      expect(result.comments).toHaveLength(0);
      // The count query carries the same isSystem filter as the page query — a
      // count that included the status row would report a thread that the
      // caller can never see any of.
      expect(result.commentCount).toBe(0);
    });

    /**
     * A truncated thread must keep its TAIL, not its head.
     *
     * `asc(createdAt)` + `limit` returns the OLDEST N and silently drops the
     * newest — on a long thread that hides exactly the comments saying what has
     * already been done, from the tool whose stated job is to be read before
     * commenting or updating. `commentCount` and `commentsTruncated` are what
     * make the omission visible rather than passing for the whole thread
     * (CORE-ARCH-012).
     *
     * The timestamps are written explicitly: three comments posted in a row can
     * land inside one clock tick, and this test is meaningless if the order it
     * asserts is the order the rows happened to come back in.
     */
    it("returns the newest comments and reports the truncation", async () => {
      const admin = await makeUser("admin", "Tim", "Froehlich");
      const machine = await seedMachine({ name: "The Addams Family" });
      await runCreateIssue(
        { machine: machine.initials, title: "vault not registering" },
        ctx("admin", admin)
      );
      for (const text of ["oldest", "middle", "newest"]) {
        await runAddIssueComment(
          { machine: machine.initials, number: 1, comment: text },
          ctx("admin", admin)
        );
      }

      const db = await getTestDb();
      const rows = await db.query.issueComments.findMany({
        where: eq(issueComments.isSystem, false),
        columns: { id: true, content: true },
      });
      for (const row of rows) {
        const text = docToPlainText(row.content);
        const offset = ["oldest", "middle", "newest"].indexOf(text);
        await db
          .update(issueComments)
          .set({ createdAt: new Date(Date.UTC(2026, 0, 1, 0, offset)) })
          .where(eq(issueComments.id, row.id));
      }

      const outcome = await runGetIssue(
        { machine: machine.initials, number: 1, commentLimit: 2 },
        ctx("admin", admin)
      );
      const result = outcome.result as {
        commentCount: number;
        commentsTruncated: boolean;
        comments: { text: string }[];
      };

      expect(result.comments.map((c) => c.text)).toEqual(["middle", "newest"]);
      expect(result.commentCount).toBe(3);
      expect(result.commentsTruncated).toBe(true);
    });

    it("reports commentsTruncated: false when the whole thread fits", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ name: "Funhouse" });
      await runCreateIssue(
        { machine: machine.initials, title: "rudy not talking" },
        ctx("admin", admin)
      );
      await runAddIssueComment(
        { machine: machine.initials, number: 1, comment: "speaker unplugged" },
        ctx("admin", admin)
      );

      const outcome = await runGetIssue(
        { machine: machine.initials, number: 1 },
        ctx("admin", admin)
      );
      expect(outcome.result).toMatchObject({
        commentCount: 1,
        commentsTruncated: false,
      });
    });

    it("throws not_found for an unknown issue number", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ name: "Cirqus Voltaire" });

      await expect(
        runGetIssue(
          { machine: machine.initials, number: 4 },
          ctx("admin", admin)
        )
      ).rejects.toMatchObject({ reason: "not_found" });
    });
  });

  describe("update_issue (PP-u4ab.14)", () => {
    it("applies several fields and reports each change", async () => {
      const admin = await makeUser("admin");
      const tech = await makeUser("technician", "Ada", "Lovelace");
      const machine = await seedMachine({ name: "Attack from Mars" });
      await runCreateIssue(
        { machine: machine.initials, title: "left flipper weak" },
        ctx("admin", admin)
      );

      const outcome = await runUpdateIssue(
        {
          machine: machine.initials,
          number: 1,
          status: "confirmed",
          severity: "major",
          assignee: "Ada Lovelace",
        },
        ctx("admin", admin)
      );
      const result = outcome.result as {
        partial: boolean;
        applied: {
          field: string;
          from: string | null;
          to: string | null;
          changed: boolean;
        }[];
      };

      expect(result.partial).toBe(false);
      expect(result.applied).toHaveLength(3);
      expect(result.applied.find((a) => a.field === "status")).toMatchObject({
        from: "new",
        to: "confirmed",
        changed: true,
      });
      expect(result.applied.find((a) => a.field === "severity")).toMatchObject({
        from: "minor",
        to: "major",
        changed: true,
      });
      expect(result.applied.find((a) => a.field === "assignee")?.to).toBe(tech);

      const db = await getTestDb();
      const row = await db.query.issues.findFirst({
        where: eq(issues.id, outcome.issueId ?? ""),
        columns: { status: true, severity: true, assignedTo: true },
      });
      expect(row).toMatchObject({
        status: "confirmed",
        severity: "major",
        assignedTo: tech,
      });
    });

    it("reports changed: false for a field already at that value", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ name: "Medieval Madness" });
      await runCreateIssue(
        { machine: machine.initials, title: "ball stuck" },
        ctx("admin", admin)
      );

      const outcome = await runUpdateIssue(
        { machine: machine.initials, number: 1, status: "new" },
        ctx("admin", admin)
      );
      const result = outcome.result as {
        applied: { field: string; changed: boolean }[];
      };
      expect(result.applied[0]).toMatchObject({
        field: "status",
        changed: false,
      });
    });

    it("unassigns when the assignee is an empty string", async () => {
      const admin = await makeUser("admin");
      const tech = await makeUser("technician", "Grace", "Hopper");
      const machine = await seedMachine({ name: "Fish Tales" });
      await runCreateIssue(
        { machine: machine.initials, title: "shaker rattles" },
        ctx("admin", admin)
      );
      await runUpdateIssue(
        { machine: machine.initials, number: 1, assignee: tech },
        ctx("admin", admin)
      );

      const outcome = await runUpdateIssue(
        { machine: machine.initials, number: 1, assignee: "" },
        ctx("admin", admin)
      );
      const result = outcome.result as {
        applied: { field: string; from: string | null; to: string | null }[];
      };
      expect(result.applied[0]).toMatchObject({
        field: "assignee",
        from: tech,
        to: null,
      });

      const db = await getTestDb();
      const row = await db.query.issues.findFirst({
        where: eq(issues.id, outcome.issueId ?? ""),
        columns: { assignedTo: true },
      });
      expect(row?.assignedTo).toBeNull();
    });

    it("rejects an update that supplies no fields", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ name: "Twilight Zone" });
      await runCreateIssue(
        { machine: machine.initials, title: "scoop weak" },
        ctx("admin", admin)
      );

      await expect(
        runUpdateIssue(
          { machine: machine.initials, number: 1 },
          ctx("admin", admin)
        )
      ).rejects.toMatchObject({ reason: "invalid" });
    });

    it("denies a guest on a triage field", async () => {
      const guest = await makeUser("guest");
      const admin = await makeUser("admin");
      const machine = await seedMachine({ name: "Cirqus Voltaire" });
      await runCreateIssue(
        { machine: machine.initials, title: "ringmaster stuck" },
        ctx("admin", admin)
      );

      await expect(
        runUpdateIssue(
          { machine: machine.initials, number: 1, priority: "high" },
          ctx("guest", guest)
        )
      ).rejects.toThrow(/cannot change an issue's priority/);
    });

    /**
     * A guest holds NEITHER permission through the bare access-level check this
     * tool performs: `issues.update.triage` is flatly false for guests, and
     * their `issues.update.reporting` grant is the conditional `"own"`, which
     * `checkPermission` resolves to false without an OwnershipContext. So a
     * mixed call must be denied as a whole — and denied BEFORE anything is
     * written, since the gate runs ahead of the apply loop.
     */
    it("denies a mixed update before writing any field", async () => {
      const admin = await makeUser("admin");
      const guest = await makeUser("guest");
      const machine = await seedMachine({ name: "Ghostbusters" });
      await runCreateIssue(
        { machine: machine.initials, title: "left ramp" },
        ctx("admin", admin)
      );

      await expect(
        runUpdateIssue(
          {
            machine: machine.initials,
            number: 1,
            severity: "major",
            priority: "high",
          },
          ctx("guest", guest)
        )
      ).rejects.toMatchObject({ reason: "denied" });

      const db = await getTestDb();
      const row = await db.query.issues.findFirst({
        where: eq(issues.machineInitials, machine.initials),
        columns: { severity: true, priority: true },
      });
      expect(row).toMatchObject({ severity: "minor", priority: "medium" });
    });

    it("fails the whole call when the assignee cannot be resolved", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ name: "Monster Bash" });
      await runCreateIssue(
        { machine: machine.initials, title: "mummy stuck" },
        ctx("admin", admin)
      );

      await expect(
        runUpdateIssue(
          {
            machine: machine.initials,
            number: 1,
            severity: "major",
            assignee: "Nobody Here",
          },
          ctx("admin", admin)
        )
      ).rejects.toMatchObject({ reason: "not_found" });

      // Resolution runs before the apply loop, so severity must be untouched.
      const db = await getTestDb();
      const row = await db.query.issues.findFirst({
        where: eq(issues.machineInitials, machine.initials),
        columns: { severity: true },
      });
      expect(row?.severity).toBe("minor");
    });

    /**
     * `changed` for the assignee comes from the service, not from the snapshot
     * `runUpdateIssue` read before the loop.
     *
     * `assignIssue` no-ops when the row already holds the requested assignee,
     * and it checks that both before and inside its transaction. So if another
     * writer assigns the same person between our snapshot read and that check,
     * the service writes nothing while a snapshot comparison would say this
     * call made the change (CORE-ARCH-012). Simulated here by writing the row
     * directly, which is exactly what the losing side of that race sees.
     */
    it("reports changed: false when the assignee was already set by someone else", async () => {
      const admin = await makeUser("admin");
      const tech = await makeUser("technician", "Ada", "Lovelace");
      const machine = await seedMachine({ name: "Theatre of Magic" });
      const created = await runCreateIssue(
        { machine: machine.initials, title: "trunk not opening" },
        ctx("admin", admin)
      );

      // The concurrent writer: the row now holds what we are about to request,
      // while runUpdateIssue's own snapshot will still say unassigned.
      const db = await getTestDb();
      await db
        .update(issues)
        .set({ assignedTo: tech })
        .where(eq(issues.id, created.issueId ?? ""));

      const outcome = await runUpdateIssue(
        { machine: machine.initials, number: 1, assignee: tech },
        ctx("admin", admin)
      );
      const result = outcome.result as {
        applied: { field: string; from: string | null; changed: boolean }[];
      };

      expect(result.applied).toEqual([
        { field: "assignee", from: tech, to: tech, changed: false },
      ]);
    });

    /**
     * The partial-application contract, and the reason update_issue returns a
     * success payload instead of an error when a field fails.
     *
     * Each field commits in its own transaction, so a mid-loop failure leaves
     * the earlier fields WRITTEN. `severity` lands, `priority` throws, and the
     * response has to say both things at once — otherwise the caller is told
     * nothing happened while the database says otherwise (CORE-ARCH-012).
     */
    it("keeps earlier fields written when a later one fails, and says so", async () => {
      const admin = await makeUser("admin");
      const machine = await seedMachine({ name: "Ghostbusters" });
      await runCreateIssue(
        { machine: machine.initials, title: "left ramp" },
        ctx("admin", admin)
      );

      const services = await import("~/services/issues");
      const spy = vi
        .spyOn(services, "updateIssuePriority")
        .mockRejectedValueOnce(new Error("priority write failed"));

      try {
        const outcome = await runUpdateIssue(
          {
            machine: machine.initials,
            number: 1,
            severity: "major",
            priority: "high",
          },
          ctx("admin", admin)
        );
        const result = outcome.result as {
          partial: boolean;
          failed: { field: string; reason: string };
          applied: { field: string }[];
        };

        expect(result.partial).toBe(true);
        expect(result.failed.field).toBe("priority");
        // The thrown text does NOT pass through. Anything a service throws here
        // is driver or Postgres text, and this response goes to an MCP client;
        // `runTool` reduces the errors IT catches the same way, and this path
        // never reaches runTool.
        expect(result.failed.reason).not.toContain("priority write failed");
        expect(result.failed.reason).toContain("priority");
        // severity is applied before priority and must be reported as landed.
        expect(result.applied.map((a) => a.field)).toEqual(["severity"]);
        // The payload is a success payload, but the AUDIT line is not — a
        // half-applied write must not be recorded as outcome "ok", since that
        // log line is the only server-side record of MCP mutations.
        expect(outcome.auditOutcome).toBe("error");
        expect(outcome.auditReason).toBe("partial:priority");

        const db = await getTestDb();
        const row = await db.query.issues.findFirst({
          where: eq(issues.id, outcome.issueId ?? ""),
          columns: { severity: true, priority: true },
        });
        expect(row).toMatchObject({ severity: "major", priority: "medium" });
      } finally {
        spy.mockRestore();
      }
    });
  });
});

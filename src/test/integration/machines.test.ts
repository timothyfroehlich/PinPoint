/**
 * Integration Test: Machine CRUD Operations
 *
 * Tests machine queries, mutations, and status derivation with PGlite.
 * Verifies that machine status is correctly derived from associated issues.
 */

import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { machines, issues } from "~/server/db/schema";
import { createTestMachine, createTestIssue } from "~/test/helpers/factories";
import { deriveMachineStatus } from "~/lib/machines/status";
import { createMachineSchema } from "~/app/(app)/m/schemas";
import {
  applyMachineFilters,
  type MachineWithDerivedStatus,
} from "~/lib/machines/filters-queries";

describe("Machine CRUD Operations (PGlite)", () => {
  // Set up worker-scoped PGlite and auto-cleanup after each test
  setupTestDb();

  describe("Machine Creation", () => {
    it("should create a machine with valid name", async () => {
      const db = await getTestDb();
      const testMachine = createTestMachine({
        name: "Medieval Madness",
        initials: "MM",
      });

      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      expect(machine).toBeDefined();
      expect(machine.name).toBe("Medieval Madness");
      expect(machine.initials).toBe("MM");
      expect(machine.id).toBeDefined();
      expect(machine.createdAt).toBeDefined();
    });

    it("should validate machine name with schema", () => {
      // Valid name
      const validResult = createMachineSchema.safeParse({
        name: "Attack from Mars",
        initials: "AFM",
      });
      expect(validResult.success).toBe(true);

      // Empty name should fail
      const emptyResult = createMachineSchema.safeParse({
        name: "",
        initials: "AFM",
      });
      expect(emptyResult.success).toBe(false);

      // Missing name should fail
      const missingResult = createMachineSchema.safeParse({});
      expect(missingResult.success).toBe(false);
    });

    it("should trim whitespace from machine name", () => {
      const result = createMachineSchema.safeParse({
        name: "  Twilight Zone  ",
        initials: "TZ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Twilight Zone");
      }
    });
  });

  describe("Machine Queries", () => {
    it("should query machine with its issues", async () => {
      const db = await getTestDb();

      // Create machine
      const testMachine = createTestMachine({
        name: "The Addams Family",
        initials: "TAF",
      });
      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      // Create issues for the machine
      const issue1 = createTestIssue(machine.initials, {
        title: "Broken flipper",
        issueNumber: 1,
        severity: "unplayable",
        status: "new",
      });
      const issue2 = createTestIssue(machine.initials, {
        title: "Missing decal",
        issueNumber: 2,
        severity: "minor",
        status: "new",
      });

      await db.insert(issues).values([issue1, issue2]);

      // Query machine with issues
      const result = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
        with: {
          issues: true,
        },
      });

      expect(result).toBeDefined();
      expect(result?.name).toBe("The Addams Family");
      expect(result?.issues).toHaveLength(2);
    });

    it("should list all machines ordered by name", async () => {
      const db = await getTestDb();

      // Create multiple machines
      await db
        .insert(machines)
        .values([
          createTestMachine({ name: "Twilight Zone", initials: "TZ" }),
          createTestMachine({ name: "Attack from Mars", initials: "AFM" }),
          createTestMachine({ name: "Medieval Madness", initials: "MM" }),
        ]);

      const result = await db.query.machines.findMany({
        orderBy: (machines, { desc }) => [desc(machines.name)],
      });

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe("Twilight Zone");
      expect(result[1].name).toBe("Medieval Madness");
      expect(result[2].name).toBe("Attack from Mars");
    });
  });

  describe("Machine Status Derivation", () => {
    it("should derive 'operational' status when machine has no open issues", async () => {
      const db = await getTestDb();

      // Create machine
      const testMachine = createTestMachine({
        name: "Operational Machine",
        initials: "OP",
      });
      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      // Create only fixed issues
      await db.insert(issues).values([
        createTestIssue(machine.initials, {
          title: "Fixed issue",
          issueNumber: 1,
          severity: "unplayable",
          status: "fixed",
          closedAt: new Date(),
        }),
      ]);

      // Query machine with issues
      const result = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
        with: {
          issues: {
            columns: {
              status: true,
              severity: true,
            },
          },
        },
      });

      // Derive status
      const status = deriveMachineStatus(result?.issues ?? []);
      expect(status).toBe("operational");
    });

    it("should derive 'needs_service' status when machine has major issues", async () => {
      const db = await getTestDb();

      // Create machine
      const testMachine = createTestMachine({
        name: "Needs Service Machine",
        initials: "NS",
      });
      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      // Create major and minor issues
      await db.insert(issues).values([
        createTestIssue(machine.initials, {
          title: "Major issue",
          issueNumber: 1,
          severity: "major",
          status: "new",
        }),
        createTestIssue(machine.initials, {
          title: "Minor issue",
          issueNumber: 2,
          severity: "minor",
          status: "in_progress",
        }),
      ]);

      // Query machine with issues
      const result = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
        with: {
          issues: {
            columns: {
              status: true,
              severity: true,
            },
          },
        },
      });

      // Derive status
      const status = deriveMachineStatus(result?.issues ?? []);
      expect(status).toBe("needs_service");
    });

    it("should derive 'operational' status when machine has only minor/cosmetic issues", async () => {
      const db = await getTestDb();

      // Create machine
      const testMachine = createTestMachine({
        name: "Operational with issues",
        initials: "OWI",
      });
      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      // Create minor and cosmetic issues
      await db.insert(issues).values([
        createTestIssue(machine.initials, {
          title: "Minor issue",
          issueNumber: 1,
          severity: "minor",
          status: "new",
        }),
        createTestIssue(machine.initials, {
          title: "Cosmetic issue",
          issueNumber: 2,
          severity: "cosmetic",
          status: "new",
        }),
      ]);

      // Query machine with issues
      const result = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
        with: {
          issues: {
            columns: {
              status: true,
              severity: true,
            },
          },
        },
      });

      // Derive status
      const status = deriveMachineStatus(result?.issues ?? []);
      expect(status).toBe("operational");
    });

    it("should derive 'unplayable' status when machine has at least one unplayable issue", async () => {
      const db = await getTestDb();

      // Create machine
      const testMachine = createTestMachine({
        name: "Unplayable Machine",
        initials: "UP",
      });
      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      // Create unplayable issue and other issues
      await db.insert(issues).values([
        createTestIssue(machine.initials, {
          title: "Broken flipper",
          issueNumber: 1,
          severity: "unplayable",
          status: "in_progress",
        }),
        createTestIssue(machine.initials, {
          title: "Minor cosmetic issue",
          issueNumber: 2,
          severity: "minor",
          status: "new",
        }),
      ]);

      // Query machine with issues
      const result = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
        with: {
          issues: {
            columns: {
              status: true,
              severity: true,
            },
          },
        },
      });

      // Derive status
      const status = deriveMachineStatus(result?.issues ?? []);
      expect(status).toBe("unplayable");
    });

    it("should ignore fixed issues when deriving status", async () => {
      const db = await getTestDb();

      // Create machine
      const testMachine = createTestMachine({
        name: "Machine with fixed unplayable",
        initials: "MR",
      });
      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      // Create fixed unplayable issue and open major issue
      await db.insert(issues).values([
        createTestIssue(machine.initials, {
          title: "Fixed unplayable issue",
          issueNumber: 1,
          severity: "unplayable",
          status: "fixed",
          closedAt: new Date(),
        }),
        createTestIssue(machine.initials, {
          title: "Current major issue",
          issueNumber: 2,
          severity: "major",
          status: "new",
        }),
      ]);

      // Query machine with issues
      const result = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
        with: {
          issues: {
            columns: {
              status: true,
              severity: true,
            },
          },
        },
      });

      // Derive status - should be needs_service, not unplayable
      const status = deriveMachineStatus(result?.issues ?? []);
      expect(status).toBe("needs_service");
    });
  });

  describe("Machine Deletion", () => {
    it("should cascade delete issues when machine is deleted", async () => {
      const db = await getTestDb();

      // Create machine with issues
      const testMachine = createTestMachine({ initials: "DEL" });
      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      await db.insert(issues).values([
        createTestIssue(machine.initials, {
          title: "Issue 1",
          issueNumber: 1,
        }),
        createTestIssue(machine.initials, {
          title: "Issue 2",
          issueNumber: 2,
        }),
      ]);

      // Verify issues exist
      const beforeDelete = await db
        .select()
        .from(issues)
        .where(eq(issues.machineInitials, machine.initials));
      expect(beforeDelete).toHaveLength(2);

      // Delete machine
      await db.delete(machines).where(eq(machines.id, machine.id));

      // Verify issues were cascade deleted
      const afterDelete = await db
        .select()
        .from(issues)
        .where(eq(issues.machineInitials, machine.initials));
      expect(afterDelete).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Machine Presence Status (downgrades from e2e/full/machine-presence-status.spec.ts)
//
// Replaced E2E tests (all B/D/I class):
//   - "create test machine and issue for presence tests" (class-B setup)
//   - "issue is visible in issues list while machine is on the floor" (class-I — covered by issue-filtering.test.ts)
//   - "edit modal shows presence dropdown and updates status" (class-B action, class-H UI)
//   - "detail page shows presence badge and inactive banner" (class-D rendering)
//   - "machine list hides non-floor machines by default" (class-I filter)
//   - "presence filter reveals non-floor machines" (class-I filter)
//   - "issues list excludes issues from inactive machines" (class-I — covered by issue-filtering.test.ts)
//
// Note: Issue-list exclusion logic is already covered in
//   src/test/integration/supabase/issue-filtering.test.ts ("excludes issues from
//   inactive machines by default" and "includes inactive machine issues when
//   includeInactiveMachines is true").
// ---------------------------------------------------------------------------

describe("Machine Presence Status (PGlite)", () => {
  setupTestDb();

  it("should default presenceStatus to 'on_the_floor' on creation", async () => {
    const db = await getTestDb();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "PS1" }))
      .returning();

    const result = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(result?.presenceStatus).toBe("on_the_floor");
  });

  it("should persist presenceStatus update to 'on_loan'", async () => {
    const db = await getTestDb();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "PS2" }))
      .returning();

    await db
      .update(machines)
      .set({ presenceStatus: "on_loan" })
      .where(eq(machines.id, machine.id));

    const result = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(result?.presenceStatus).toBe("on_loan");
  });

  it("should support all valid presence statuses", async () => {
    const db = await getTestDb();
    const statusToInitials: Record<string, string> = {
      on_the_floor: "OTF",
      off_the_floor: "OFF",
      on_loan: "OLN",
      pending_arrival: "PND",
      removed: "REM",
    } as const;

    for (const [status, initials] of Object.entries(statusToInitials)) {
      const [machine] = await db
        .insert(machines)
        .values(
          createTestMachine({
            initials,
            presenceStatus: status as
              | "on_the_floor"
              | "off_the_floor"
              | "on_loan"
              | "pending_arrival"
              | "removed",
          })
        )
        .returning();

      const result = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(result?.presenceStatus).toBe(status);
    }
  });
});

// ---------------------------------------------------------------------------
// Machine Presence Filtering via applyMachineFilters
// (covers the list-page "machine list hides non-floor / filter reveals" E2E tests)
// ---------------------------------------------------------------------------

describe("Machine Presence Filtering (applyMachineFilters)", () => {
  const makeEntry = (
    overrides: Partial<MachineWithDerivedStatus>
  ): MachineWithDerivedStatus => ({
    id: "test-id",
    name: "Test Machine",
    initials: "TM",
    status: "operational",
    presenceStatus: "on_the_floor",
    openIssuesCount: 0,
    createdAt: new Date(),
    ...overrides,
  });

  const onFloor = makeEntry({ initials: "OF", presenceStatus: "on_the_floor" });
  const onLoan = makeEntry({ initials: "OL", presenceStatus: "on_loan" });
  const offFloor = makeEntry({
    initials: "FF",
    presenceStatus: "off_the_floor",
  });

  it("returns all machines when no presence filter is set", () => {
    const result = applyMachineFilters([onFloor, onLoan, offFloor], {});
    expect(result).toHaveLength(3);
  });

  it("filters to only on-the-floor machines when presence=['on_the_floor']", () => {
    const result = applyMachineFilters([onFloor, onLoan, offFloor], {
      presence: ["on_the_floor"],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.initials).toBe("OF");
  });

  it("reveals on-loan machines when presence=['on_loan']", () => {
    const result = applyMachineFilters([onFloor, onLoan, offFloor], {
      presence: ["on_loan"],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.initials).toBe("OL");
  });

  it("returns multiple presence statuses when presence has multiple values", () => {
    const result = applyMachineFilters([onFloor, onLoan, offFloor], {
      presence: ["on_loan", "off_the_floor"],
    });
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.initials)).toContain("OL");
    expect(result.map((m) => m.initials)).toContain("FF");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  authUsers,
  invitedUsers,
  issues,
  machines,
  userProfiles,
} from "~/server/db/schema";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import { exportIssuesAction } from "~/app/(app)/issues/export-action";

// External boundary mocks
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("~/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Forward ~/server/db to worker-scoped PGlite
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

async function mockAuth(userId: string | null) {
  const { createClient } = await import("~/lib/supabase/server");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
      }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

describe("exportIssuesAction — PGlite integration (CORE-TEST-004)", () => {
  setupTestDb();

  const USER_ID = "c0000000-0000-0000-0000-000000000001";
  const GUEST_REPORTER_ID = "c0000000-0000-0000-0000-000000000002";

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = await getTestDb();

    await db
      .insert(authUsers)
      .values([{ id: USER_ID, email: "alice@test.com" }]);

    await db.insert(userProfiles).values([
      createTestUser({
        id: USER_ID,
        firstName: "Alice",
        lastName: "Smith",
        role: "member",
        email: "alice@test.com",
      }),
    ]);

    await db.insert(invitedUsers).values([
      {
        id: GUEST_REPORTER_ID,
        firstName: "Guest",
        lastName: "Bob",
        email: "guest-bob@test.com",
        role: "guest",
      },
    ]);

    await db.insert(machines).values([
      createTestMachine({
        id: "d0000000-0000-0000-0000-000000000001",
        initials: "AFM",
        name: "Attack from Mars",
      }),
      createTestMachine({
        id: "d0000000-0000-0000-0000-000000000002",
        initials: "TZ",
        name: "Twilight Zone",
      }),
    ]);
  });

  describe("authentication", () => {
    it("returns UNAUTHORIZED when user is not signed in", async () => {
      await mockAuth(null);

      const result = await exportIssuesAction({});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("input validation", () => {
    it("returns VALIDATION for invalid machineInitials", async () => {
      await mockAuth(USER_ID);

      const result = await exportIssuesAction({ machineInitials: "AB@CD" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }
    });

    it("returns VALIDATION for malformed filtersJson", async () => {
      await mockAuth(USER_ID);

      const result = await exportIssuesAction({ filtersJson: "not-json" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }
    });
  });

  describe("empty results", () => {
    it("returns EMPTY when no issues match filters", async () => {
      await mockAuth(USER_ID);

      const result = await exportIssuesAction({});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("EMPTY");
      }
    });
  });

  describe("CSV output and formatting", () => {
    beforeEach(async () => {
      const db = await getTestDb();
      await db.insert(issues).values([
        {
          machineInitials: "AFM",
          issueNumber: 1,
          title: "Left flipper weak",
          status: "new",
          severity: "major",
          priority: "high",
          frequency: "constant",
          reportedBy: USER_ID,
          createdAt: new Date("2026-01-15T12:00:00Z"),
          updatedAt: new Date("2026-01-20T12:00:00Z"),
        },
        {
          machineInitials: "AFM",
          issueNumber: 2,
          title: "Drop target sticky",
          status: "confirmed",
          severity: "minor",
          priority: "low",
          frequency: "intermittent",
          invitedReportedBy: GUEST_REPORTER_ID,
          createdAt: new Date("2026-01-16T12:00:00Z"),
          updatedAt: new Date("2026-01-21T12:00:00Z"),
        },
        {
          machineInitials: "TZ",
          issueNumber: 1,
          title: "Clock broken",
          status: "in_progress",
          severity: "unplayable",
          priority: "high",
          frequency: "constant",
          createdAt: new Date("2026-01-17T12:00:00Z"),
          updatedAt: new Date("2026-01-22T12:00:00Z"),
        },
      ]);
    });

    it("produces correct headers in order", async () => {
      await mockAuth(USER_ID);

      const result = await exportIssuesAction({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const firstLine = result.value.csv.split("\r\n")[0];
      expect(firstLine).toBe(
        "\uFEFFIssue ID,Machine,Title,Description,Status,Severity,Priority,Frequency,Reporter,Assigned To,Created,Updated,Closed"
      );
    });

    it("maps row values to correct columns with real DB queries", async () => {
      await mockAuth(USER_ID);

      const result = await exportIssuesAction({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const csv = result.value.csv;
      expect(csv).toContain("AFM-01");
      expect(csv).toContain("Attack from Mars");
      expect(csv).toContain("Left flipper weak");
      expect(csv).toContain("New");
      expect(csv).toContain("Major");
      expect(csv).toContain("High");
      expect(csv).toContain("Constant");
      expect(csv).toContain("Alice Smith");
      expect(csv).toContain("2026-01-15");
      expect(csv).toContain("2026-01-20");
    });

    it("formats general export filename as pinpoint-issues-YYYY-MM-DD.csv", async () => {
      await mockAuth(USER_ID);

      const result = await exportIssuesAction({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.fileName).toMatch(
        /^pinpoint-issues-\d{4}-\d{2}-\d{2}\.csv$/
      );
    });

    it("formats machine export filename with uppercased initials", async () => {
      await mockAuth(USER_ID);

      const result = await exportIssuesAction({ machineInitials: "afm" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.fileName).toMatch(
        /^pinpoint-AFM-issues-\d{4}-\d{2}-\d{2}\.csv$/
      );
      // Only AFM issues are exported
      expect(result.value.csv).toContain("AFM-01");
      expect(result.value.csv).not.toContain("TZ-01");
    });

    it("uses Anonymous for issues with no reporter", async () => {
      await mockAuth(USER_ID);

      const result = await exportIssuesAction({ machineInitials: "TZ" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.csv).toContain("Anonymous");
    });

    it("uses invitedReporter name when reportedByUser is absent", async () => {
      await mockAuth(USER_ID);

      const result = await exportIssuesAction({ machineInitials: "AFM" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.csv).toContain("Guest Bob");
    });
  });

  describe("filter parsing and query scoping", () => {
    beforeEach(async () => {
      const db = await getTestDb();
      await db.insert(issues).values([
        {
          machineInitials: "AFM",
          issueNumber: 10,
          title: "Early issue on AFM",
          status: "new",
          severity: "major",
          priority: "high",
          frequency: "constant",
          reportedBy: USER_ID,
          createdAt: new Date("2026-01-10T00:00:00Z"),
          updatedAt: new Date("2026-01-10T00:00:00Z"),
        },
        {
          machineInitials: "AFM",
          issueNumber: 11,
          title: "Later issue on AFM",
          status: "confirmed",
          severity: "minor",
          priority: "low",
          frequency: "intermittent",
          reportedBy: USER_ID,
          createdAt: new Date("2026-01-15T00:00:00Z"),
          updatedAt: new Date("2026-01-15T00:00:00Z"),
        },
      ]);
    });

    it("filters issues by status in real queries", async () => {
      await mockAuth(USER_ID);

      const result = await exportIssuesAction({
        filtersJson: JSON.stringify({ status: ["new"] }),
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.csv).toContain("Early issue on AFM");
      expect(result.value.csv).not.toContain("Later issue on AFM");
    });

    it("coerces ISO date strings in filtersJson into Date objects", async () => {
      await mockAuth(USER_ID);

      const result = await exportIssuesAction({
        filtersJson: JSON.stringify({
          createdFrom: "2026-01-12T00:00:00.000Z",
        }),
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.csv).toContain("Later issue on AFM");
      expect(result.value.csv).not.toContain("Early issue on AFM");
    });

    it("falls back to default open filters when filtersJson has invalid enum", async () => {
      await mockAuth(USER_ID);

      const result = await exportIssuesAction({
        filtersJson: JSON.stringify({ status: ["invalid-status"] }),
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Both open issues match because invalid filter was dropped safely
      expect(result.value.csv).toContain("Early issue on AFM");
      expect(result.value.csv).toContain("Later issue on AFM");
    });
  });
});

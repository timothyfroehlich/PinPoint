import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks must be declared before the tested module is imported ---

const mockGetUser = vi.fn();
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
    })
  ),
}));

const mockFindManyIssues = vi.fn();
const mockFindFirstProfile = vi.fn();
vi.mock("~/server/db", () => ({
  db: {
    query: {
      issues: {
        findMany: (...args: unknown[]) => mockFindManyIssues(...args),
      },
      userProfiles: {
        findFirst: (...args: unknown[]) => mockFindFirstProfile(...args),
      },
    },
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn((...conditions: unknown[]) => ({ type: "and", conditions })),
}));

const mockBuildWhereConditions = vi.fn(() => []);
const mockBuildOrderBy = vi.fn(() => []);
vi.mock("~/lib/issues/filters-queries", () => ({
  buildWhereConditions: (...args: unknown[]) =>
    mockBuildWhereConditions(...args),
  buildOrderBy: (...args: unknown[]) => mockBuildOrderBy(...args),
}));

vi.mock("~/server/db/schema", () => ({
  userProfiles: { id: "id" },
  issues: {},
}));

vi.mock("~/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { exportIssuesAction } from "./export-action";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const MOCK_USER = { id: "user-uuid-1" };

const MOCK_ISSUE = {
  id: "issue-uuid-1",
  machineInitials: "AFM",
  issueNumber: 1,
  title: "Left flipper weak",
  description: null,
  status: "new" as const,
  severity: "major" as const,
  priority: "high" as const,
  frequency: "constant" as const,
  reportedBy: "user-uuid-1",
  reporterName: null,
  assignedTo: null,
  createdAt: new Date("2026-01-15T12:00:00Z"),
  updatedAt: new Date("2026-01-20T12:00:00Z"),
  closedAt: null,
  machine: { name: "Attack from Mars" },
  reportedByUser: { name: "Alice" },
  invitedReporter: null,
  assignedToUser: null,
};

describe("exportIssuesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockFindFirstProfile.mockResolvedValue({ role: "member" });
    mockFindManyIssues.mockResolvedValue([MOCK_ISSUE]);
  });

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------
  describe("authentication", () => {
    it("returns UNAUTHORIZED when user is not signed in", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const result = await exportIssuesAction({});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
      }
      expect(mockFindManyIssues).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Input validation
  // ---------------------------------------------------------------------------
  describe("input validation", () => {
    it("returns VALIDATION for invalid machineInitials", async () => {
      const result = await exportIssuesAction({ machineInitials: "AB@CD" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }
      expect(mockFindManyIssues).not.toHaveBeenCalled();
    });

    it("returns VALIDATION for malformed filtersJson", async () => {
      const result = await exportIssuesAction({ filtersJson: "not-json" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Empty results
  // ---------------------------------------------------------------------------
  describe("empty results", () => {
    it("returns EMPTY when no issues match filters", async () => {
      mockFindManyIssues.mockResolvedValue([]);

      const result = await exportIssuesAction({});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("EMPTY");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // CSV structure
  // ---------------------------------------------------------------------------
  describe("CSV output", () => {
    it("produces correct headers in order", async () => {
      const result = await exportIssuesAction({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const firstLine = result.value.csv.split("\r\n")[0];
      expect(firstLine).toBe(
        "\uFEFFIssue ID,Machine,Title,Description,Status,Severity,Priority,Frequency,Reporter,Assigned To,Created,Updated,Closed"
      );
    });

    it("maps row values to correct columns", async () => {
      const result = await exportIssuesAction({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const dataLine = result.value.csv.split("\r\n")[1];
      expect(dataLine).toContain("AFM-01"); // Issue ID
      expect(dataLine).toContain("Attack from Mars"); // Machine
      expect(dataLine).toContain("Left flipper weak"); // Title
      expect(dataLine).toContain("New"); // Status label
      expect(dataLine).toContain("Major"); // Severity label
      expect(dataLine).toContain("High"); // Priority label
      expect(dataLine).toContain("Constant"); // Frequency label
      expect(dataLine).toContain("Alice"); // Reporter
      expect(dataLine).toContain("2026-01-15"); // Created date
      expect(dataLine).toContain("2026-01-20"); // Updated date
    });

    it("formats general export filename as pinpoint-issues-YYYY-MM-DD.csv", async () => {
      const result = await exportIssuesAction({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.fileName).toMatch(
        /^pinpoint-issues-\d{4}-\d{2}-\d{2}\.csv$/
      );
    });

    it("formats machine export filename with uppercased initials", async () => {
      const result = await exportIssuesAction({ machineInitials: "afm" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.fileName).toMatch(
        /^pinpoint-AFM-issues-\d{4}-\d{2}-\d{2}\.csv$/
      );
    });

    it("uses Anonymous for issues with no reporter", async () => {
      mockFindManyIssues.mockResolvedValue([
        {
          ...MOCK_ISSUE,
          reportedByUser: null,
          invitedReporter: null,
          reporterName: null,
        },
      ]);

      const result = await exportIssuesAction({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.csv).toContain("Anonymous");
    });

    it("uses invitedReporter name when reportedByUser is absent", async () => {
      mockFindManyIssues.mockResolvedValue([
        {
          ...MOCK_ISSUE,
          reportedByUser: null,
          invitedReporter: { name: "Guest Bob" },
        },
      ]);

      const result = await exportIssuesAction({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.csv).toContain("Guest Bob");
    });
  });

  // ---------------------------------------------------------------------------
  // Filter parsing
  // ---------------------------------------------------------------------------
  describe("filter parsing", () => {
    it("passes parsed filters to buildWhereConditions", async () => {
      const filters = { status: ["new", "confirmed"], machine: ["AFM"] };

      await exportIssuesAction({ filtersJson: JSON.stringify(filters) });

      expect(mockBuildWhereConditions).toHaveBeenCalledOnce();
      const [passedFilters] = mockBuildWhereConditions.mock.calls[0] as [
        Record<string, unknown>,
        unknown,
        unknown,
      ];
      expect(passedFilters.status).toEqual(["new", "confirmed"]);
      expect(passedFilters.machine).toEqual(["AFM"]);
    });

    it("coerces ISO date strings in filtersJson into Date objects", async () => {
      const createdFrom = new Date("2026-01-01T00:00:00.000Z");
      const updatedTo = new Date("2026-03-31T23:59:59.000Z");
      // JSON.stringify converts Date → ISO string; the schema must coerce it back
      const filters = { createdFrom, updatedTo };

      await exportIssuesAction({ filtersJson: JSON.stringify(filters) });

      expect(mockBuildWhereConditions).toHaveBeenCalledOnce();
      const [passedFilters] = mockBuildWhereConditions.mock.calls[0] as [
        Record<string, unknown>,
        unknown,
        unknown,
      ];
      expect(passedFilters.createdFrom).toBeInstanceOf(Date);
      expect(passedFilters.updatedTo).toBeInstanceOf(Date);
      expect((passedFilters.createdFrom as Date).toISOString()).toBe(
        createdFrom.toISOString()
      );
    });

    it("uses empty filters when filtersJson contains an invalid enum value", async () => {
      // z.array(z.enum(...)) rejects the whole input on an invalid value,
      // so safeParse fails and the action falls back to empty filters rather
      // than crashing — the export proceeds with no filter constraints.
      const filters = { status: ["invalid-status"], q: "search term" };

      await exportIssuesAction({ filtersJson: JSON.stringify(filters) });

      expect(mockBuildWhereConditions).toHaveBeenCalledOnce();
      const [passedFilters] = mockBuildWhereConditions.mock.calls[0] as [
        Record<string, unknown>,
        unknown,
        unknown,
      ];
      // Both fields dropped because the whole parse fails on invalid enum
      expect(passedFilters.status).toBeUndefined();
      expect(passedFilters.q).toBeUndefined();
    });

    it("injects currentUserId from the authenticated user", async () => {
      await exportIssuesAction({});

      const [passedFilters] = mockBuildWhereConditions.mock.calls[0] as [
        Record<string, unknown>,
        unknown,
        unknown,
      ];
      expect(passedFilters.currentUserId).toBe(MOCK_USER.id);
    });
  });

  // ---------------------------------------------------------------------------
  // machineInitials path
  // ---------------------------------------------------------------------------
  describe("machineInitials override", () => {
    it("sets machine filter, clears status, and enables inactive machines", async () => {
      await exportIssuesAction({ machineInitials: "TZ" });

      expect(mockBuildWhereConditions).toHaveBeenCalledOnce();
      const [passedFilters] = mockBuildWhereConditions.mock.calls[0] as [
        Record<string, unknown>,
        unknown,
        unknown,
      ];
      expect(passedFilters.machine).toEqual(["TZ"]);
      expect(passedFilters.status).toEqual([]);
      expect(passedFilters.includeInactiveMachines).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Database error handling
  // ---------------------------------------------------------------------------
  describe("database errors", () => {
    it("returns SERVER error when db.query.issues.findMany throws", async () => {
      mockFindManyIssues.mockRejectedValue(new Error("Connection timeout"));

      const result = await exportIssuesAction({});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVER");
      }
    });
  });
});

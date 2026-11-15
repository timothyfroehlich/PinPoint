import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as QuickSearchQueriesModule from "~/app/api/quick-search/queries";
import type * as RateLimitModule from "~/lib/rate-limit";

const {
  checkQuickSearchLimitMock,
  searchQuickIssuesMock,
  listQuickSearchMachinesMock,
  getUserMock,
  getUserContextMock,
  checkPermissionMock,
} = vi.hoisted(() => ({
  checkQuickSearchLimitMock: vi.fn(),
  searchQuickIssuesMock: vi.fn(),
  listQuickSearchMachinesMock: vi.fn(),
  getUserMock: vi.fn(),
  getUserContextMock: vi.fn(),
  checkPermissionMock: vi.fn(),
}));

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: getUserMock,
    },
  }),
}));

vi.mock("~/lib/auth/context", () => ({
  getUserContext: getUserContextMock,
}));

vi.mock("~/lib/permissions/helpers", () => ({
  checkPermission: checkPermissionMock,
  getAccessLevel: vi.fn((role) => role ?? "anonymous"),
}));

vi.mock("~/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof RateLimitModule>();
  return {
    ...actual,
    checkQuickSearchLimit: checkQuickSearchLimitMock,
  };
});

vi.mock("~/app/api/quick-search/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof QuickSearchQueriesModule>();
  return {
    ...actual,
    searchQuickIssues: searchQuickIssuesMock,
    listQuickSearchMachines: listQuickSearchMachinesMock,
  };
});

vi.mock("~/lib/logger", () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { GET } from "./route";
import { GET as GET_MACHINES } from "./machines/route";

describe("GET /api/quick-search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: null } });
    getUserContextMock.mockResolvedValue(null);
    checkPermissionMock.mockReturnValue(true);
    checkQuickSearchLimitMock.mockResolvedValue({
      success: true,
      limit: 120,
      remaining: 119,
      reset: 0,
    });
    searchQuickIssuesMock.mockResolvedValue({
      issues: [{ machineInitials: "AFM", title: "Weak flipper" }],
    });
    listQuickSearchMachinesMock.mockResolvedValue({
      machines: [{ initials: "AFM", name: "Attack from Mars" }],
    });
  });

  it("executes search and returns 200 when within rate limit (anonymous request)", async () => {
    const request = new Request(
      "https://pinpoint.test/api/quick-search?q=AFM",
      {
        headers: { "x-forwarded-for": "198.51.100.25" },
      }
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(checkQuickSearchLimitMock).toHaveBeenCalledWith(
      "198.51.100.25",
      undefined
    );
    expect(searchQuickIssuesMock).toHaveBeenCalledWith("AFM");
    expect(await response.json()).toEqual({
      issues: [{ machineInitials: "AFM", title: "Weak flipper" }],
    });
  });

  it("passes authenticated user ID to rate limiter for per-user budgeting", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-apc-member-123" } },
    });

    const request = new Request(
      "https://pinpoint.test/api/quick-search?q=AFM",
      {
        headers: { "x-forwarded-for": "198.51.100.25" },
      }
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(checkQuickSearchLimitMock).toHaveBeenCalledWith(
      "198.51.100.25",
      "user-apc-member-123"
    );
    expect(searchQuickIssuesMock).toHaveBeenCalledWith("AFM");
  });

  it("returns 429 with Retry-After header and skips search query when rate limit is exceeded", async () => {
    const now = Date.now();
    checkQuickSearchLimitMock.mockResolvedValue({
      success: false,
      limit: 120,
      remaining: 0,
      reset: now + 30_000,
    });

    const request = new Request(
      "https://pinpoint.test/api/quick-search?q=AFM",
      {
        headers: { "x-forwarded-for": "198.51.100.25" },
      }
    );

    const response = await GET(request);

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThanOrEqual(
      29
    );
    expect(await response.json()).toEqual({
      error: "Quick search rate limit reached",
    });
    expect(searchQuickIssuesMock).not.toHaveBeenCalled();
  });

  it("does not check rate limit when machine or issue view permission is denied", async () => {
    checkPermissionMock.mockReturnValue(false);

    const request = new Request("https://pinpoint.test/api/quick-search?q=AFM");
    const response = await GET(request);

    expect(response.status).toBe(403);
    expect(checkQuickSearchLimitMock).not.toHaveBeenCalled();
    expect(searchQuickIssuesMock).not.toHaveBeenCalled();
  });

  it("does not check rate limit when query string validation fails", async () => {
    const oversizedQuery = "a".repeat(321);
    const request = new Request(
      `https://pinpoint.test/api/quick-search?q=${oversizedQuery}`
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(checkQuickSearchLimitMock).not.toHaveBeenCalled();
    expect(searchQuickIssuesMock).not.toHaveBeenCalled();
  });

  describe("GET /api/quick-search/machines", () => {
    it("returns the machine list within the shared rate limit", async () => {
      const response = await GET_MACHINES(
        new Request("https://pinpoint.test/api/quick-search/machines", {
          headers: { "x-forwarded-for": "198.51.100.25" },
        })
      );

      expect(response.status).toBe(200);
      expect(checkQuickSearchLimitMock).toHaveBeenCalledWith(
        "198.51.100.25",
        undefined
      );
      expect(await response.json()).toEqual({
        machines: [{ initials: "AFM", name: "Attack from Mars" }],
      });
    });

    it("returns 403 without listing machines when view permission is denied", async () => {
      checkPermissionMock.mockReturnValue(false);

      const response = await GET_MACHINES(
        new Request("https://pinpoint.test/api/quick-search/machines")
      );

      expect(response.status).toBe(403);
      expect(checkQuickSearchLimitMock).not.toHaveBeenCalled();
      expect(listQuickSearchMachinesMock).not.toHaveBeenCalled();
    });

    it("returns 429 without listing machines when rate limited", async () => {
      checkQuickSearchLimitMock.mockResolvedValue({
        success: false,
        limit: 120,
        remaining: 0,
        reset: Date.now() + 30_000,
      });

      const response = await GET_MACHINES(
        new Request("https://pinpoint.test/api/quick-search/machines")
      );

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).not.toBeNull();
      expect(listQuickSearchMachinesMock).not.toHaveBeenCalled();
    });
  });
});

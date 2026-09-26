import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as QuickSearchQueriesModule from "~/app/api/quick-search/queries";
import type * as RateLimitModule from "~/lib/rate-limit";

const {
  checkQuickSearchLimitMock,
  searchQuickNavigationMock,
  getUserMock,
  getUserContextMock,
  checkPermissionMock,
} = vi.hoisted(() => ({
  checkQuickSearchLimitMock: vi.fn(),
  searchQuickNavigationMock: vi.fn(),
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
    searchQuickNavigation: searchQuickNavigationMock,
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
    searchQuickNavigationMock.mockResolvedValue({
      machines: [{ initials: "AFM", name: "Attack from Mars" }],
      issues: [],
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
    expect(searchQuickNavigationMock).toHaveBeenCalledWith("AFM");
    expect(await response.json()).toEqual({
      machines: [{ initials: "AFM", name: "Attack from Mars" }],
      issues: [],
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
    expect(searchQuickNavigationMock).toHaveBeenCalledWith("AFM");
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
    expect(searchQuickNavigationMock).not.toHaveBeenCalled();
  });

  it("does not check rate limit when machine or issue view permission is denied", async () => {
    checkPermissionMock.mockReturnValue(false);

    const request = new Request("https://pinpoint.test/api/quick-search?q=AFM");
    const response = await GET(request);

    expect(response.status).toBe(403);
    expect(checkQuickSearchLimitMock).not.toHaveBeenCalled();
    expect(searchQuickNavigationMock).not.toHaveBeenCalled();
  });

  it("does not check rate limit when query string validation fails", async () => {
    const oversizedQuery = "a".repeat(321);
    const request = new Request(
      `https://pinpoint.test/api/quick-search?q=${oversizedQuery}`
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(checkQuickSearchLimitMock).not.toHaveBeenCalled();
    expect(searchQuickNavigationMock).not.toHaveBeenCalled();
  });
});

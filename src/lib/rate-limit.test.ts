import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatResetTime,
  checkAuthenticatedIssueLimit,
  checkPublicIssueLimit,
} from "./rate-limit";

// Mock logger
vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("formatResetTime", () => {
  it("returns 'now' for timestamps in the past or present", () => {
    expect(formatResetTime(Date.now() - 5000)).toBe("now");
    expect(formatResetTime(Date.now())).toBe("now");
  });

  it("formats seconds correctly for diff < 60s", () => {
    const now = Date.now();
    expect(formatResetTime(now + 1000)).toBe("1 second");
    expect(formatResetTime(now + 15_000)).toBe("15 seconds");
  });

  it("formats minutes correctly for diff < 60m", () => {
    const now = Date.now();
    expect(formatResetTime(now + 65_000)).toBe("2 minutes");
    expect(formatResetTime(now + 5 * 60_000)).toBe("5 minutes");
  });

  it("formats hours correctly for diff >= 60m", () => {
    const now = Date.now();
    expect(formatResetTime(now + 60 * 60_000)).toBe("1 hour");
    expect(formatResetTime(now + 2 * 60 * 60_000)).toBe("2 hours");
  });
});

describe("checkAuthenticatedIssueLimit in development (no Redis)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows requests when Redis is not configured in development", async () => {
    const result = await checkAuthenticatedIssueLimit("user-uuid-123");
    expect(result).toEqual({
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
    });
  });
});

describe("checkPublicIssueLimit in development (no Redis)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows requests when Redis is not configured in development", async () => {
    const result = await checkPublicIssueLimit("192.168.1.1");
    expect(result).toEqual({
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
    });
  });

  it("handles unknown IP gracefully in development", async () => {
    const result = await checkPublicIssueLimit("unknown");
    expect(result).toEqual({
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
    });
  });
});

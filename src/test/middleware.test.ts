/**
 * Middleware - Production Safety Check Tests
 *
 * Critical tests for production test data detection.
 * Ensures middleware blocks requests if test orgs exist in production.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Mock dependencies
vi.mock("~/lib/dal/shared", () => ({
  getDb: vi.fn(),
}));

vi.mock("~/server/db/schema", () => ({
  organizations: {
    id: "id",
  },
}));

vi.mock("~/utils/supabase/middleware", () => ({
  updateSession: vi.fn(async (req) => new Response(null, { status: 200 })),
}));

describe("Middleware - Production Safety Check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("production environment", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("should allow requests when no test orgs exist", async () => {
      const { getDb } = await import("~/lib/dal/shared");
      const mockDb = {
        query: {
          organizations: {
            findMany: vi.fn().mockResolvedValue([]), // No test orgs found
          },
        },
      };
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      const { middleware } = await import("../../middleware");
      const request = new NextRequest("http://localhost/test");

      const response = await middleware(request);
      expect(response.status).toBe(200);
    });

    it("should block requests when test org detected", async () => {
      const { getDb } = await import("~/lib/dal/shared");
      const mockDb = {
        query: {
          organizations: {
            findMany: vi
              .fn()
              .mockResolvedValue([{ id: SEED_TEST_IDS.ORGANIZATIONS.primary }]),
          },
        },
      };
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      const { middleware } = await import("../../middleware");
      const request = new NextRequest("http://localhost/test");

      await expect(middleware(request)).rejects.toThrow(
        "Production database contains test data",
      );
    });

    it("should use cache for subsequent requests", async () => {
      const { getDb } = await import("~/lib/dal/shared");
      const mockFindMany = vi.fn().mockResolvedValue([]);
      const mockDb = {
        query: {
          organizations: {
            findMany: mockFindMany,
          },
        },
      };
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      const { middleware } = await import("../../middleware");
      const request1 = new NextRequest("http://localhost/test1");
      const request2 = new NextRequest("http://localhost/test2");

      await middleware(request1);
      await middleware(request2);

      // Should only query once due to caching
      expect(mockFindMany).toHaveBeenCalledTimes(1);
    });

    it("should fail closed on database errors", async () => {
      const { getDb } = await import("~/lib/dal/shared");
      const mockDb = {
        query: {
          organizations: {
            findMany: vi
              .fn()
              .mockRejectedValue(new Error("Database connection failed")),
          },
        },
      };
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      const { middleware } = await import("../../middleware");
      const request = new NextRequest("http://localhost/test");

      await expect(middleware(request)).rejects.toThrow(
        "Production database contains test data",
      );
    });
  });

  describe("non-production environment", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("should skip check entirely in development", async () => {
      const { getDb } = await import("~/lib/dal/shared");
      const mockFindMany = vi.fn();
      const mockDb = {
        query: {
          organizations: {
            findMany: mockFindMany,
          },
        },
      };
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      const { middleware } = await import("../../middleware");
      const request = new NextRequest("http://localhost/test");

      await middleware(request);

      // Should not query at all
      expect(mockFindMany).not.toHaveBeenCalled();
    });

    it("should skip check in test environment", async () => {
      const { getDb } = await import("~/lib/dal/shared");
      const mockFindMany = vi.fn();
      const mockDb = {
        query: {
          organizations: {
            findMany: mockFindMany,
          },
        },
      };
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      process.env.NODE_ENV = "test";

      const { middleware } = await import("../../middleware");
      const request = new NextRequest("http://localhost/test");

      await middleware(request);

      expect(mockFindMany).not.toHaveBeenCalled();
    });
  });

  describe("cache behavior", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("should recheck after 100 requests", async () => {
      const { getDb } = await import("~/lib/dal/shared");
      const mockFindMany = vi.fn().mockResolvedValue([]);
      const mockDb = {
        query: {
          organizations: {
            findMany: mockFindMany,
          },
        },
      };
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      const { middleware } = await import("../../middleware");

      // First check
      await middleware(new NextRequest("http://localhost/test"));
      expect(mockFindMany).toHaveBeenCalledTimes(1);

      // Next 99 should use cache
      for (let i = 0; i < 99; i++) {
        await middleware(new NextRequest(`http://localhost/test${i}`));
      }
      expect(mockFindMany).toHaveBeenCalledTimes(1);

      // 101st should trigger recheck
      await middleware(new NextRequest("http://localhost/test100"));
      expect(mockFindMany).toHaveBeenCalledTimes(2);
    });
  });
});

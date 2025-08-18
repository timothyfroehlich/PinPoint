import { describe, it, expect, vi, beforeEach } from "vitest";

import { appRouter } from "~/server/api/root";
import {
  pinballMapConfigs,
  locations,
  machines,
} from "~/server/db/schema";
import { createVitestMockContext } from "~/test/vitestMockContext";

// Mock the entire db module using vi.hoisted
const mockDb = vi.hoisted(() => ({
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockResolvedValue([]),
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([{}]),
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  query: {
    pinballMapConfigs: {
      findFirst: vi.fn(),
    },
    locations: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    machines: {
      findMany: vi.fn(),
    },
    models: {
      findFirst: vi.fn(),
    },
    issues: {
      count: vi.fn(),
    },
  },
}));

vi.mock("~/server/db", () => ({ db: mockDb }));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("pinballMapRouter", () => {
  const ctx = createVitestMockContext({
    userPermissions: ["organization:manage"],
  });
  const caller = appRouter.createCaller(ctx);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enableIntegration", () => {
    it("should upsert the pinballMapConfig for the organization", async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      await caller.pinballMap.enableIntegration();

      expect(mockDb.insert).toHaveBeenCalledWith(pinballMapConfigs);
      expect(mockDb.insert(pinballMapConfigs).values).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organization.id,
          apiEnabled: true,
        }),
      );
      expect(
        mockDb.insert(pinballMapConfigs).values({}).onConflictDoUpdate,
      ).toHaveBeenCalledWith({
        target: pinballMapConfigs.organizationId,
        set: { apiEnabled: true },
      });
    });
  });

  describe("configureLocation", () => {
    it("should throw an error if integration is not enabled", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      } as any);

      await expect(
        caller.pinballMap.configureLocation({
          locationId: "loc-1",
          pinballMapId: 123,
        }),
      ).rejects.toThrow("PinballMap integration not enabled for organization");
    });

    it("should update the location with pinballMapId", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ apiEnabled: true }]),
        }),
      } as any);
      const whereMock = vi.fn().mockResolvedValue([{}]);
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      mockDb.update.mockReturnValue({ set: setMock } as any);

      await caller.pinballMap.configureLocation({
        locationId: "loc-1",
        pinballMapId: 123,
      });

      expect(mockDb.update).toHaveBeenCalledWith(locations);
      expect(setMock).toHaveBeenCalledWith({
        pinballMapId: 123,
        syncEnabled: true,
      });
      expect(whereMock).toHaveBeenCalledWith(expect.any(Object));
    });
  });

  describe("syncLocation", () => {
    beforeEach(() => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                id: "loc-1",
                pinballMapId: 123,
                organizationId: "org-1",
                config: {
                  apiEnabled: true,
                  createMissingModels: true,
                  updateExistingData: true,
                },
              },
            ]),
          }),
        }),
      } as any);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            machines: [{ opdb_id: "opdb-1", name: "Test Machine" }],
          }),
      });
    });

    it("should add a new machine", async () => {
      mockDb.query.machines.findMany.mockResolvedValue([]);
      mockDb.query.models.findFirst.mockResolvedValue({
        id: "model-1",
        name: "Test Machine",
      });
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      } as any);

      const result = await caller.pinballMap.syncLocation({
        locationId: "loc-1",
      });

      expect(result.added).toBe(1);
      expect(mockDb.insert).toHaveBeenCalledWith(machines);
    });

    it("should remove a machine that no longer exists", async () => {
      mockDb.query.machines.findMany.mockResolvedValue([
        { id: "machine-to-remove", modelId: "model-1" },
      ] as any);
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      } as any);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ machines: [] }), // No machines from API
      });

      const result = await caller.pinballMap.syncLocation({
        locationId: "loc-1",
      });

      expect(result.removed).toBe(1);
      expect(mockDb.delete).toHaveBeenCalledWith(machines);
    });

    it("should not remove a machine with issues", async () => {
      mockDb.query.machines.findMany.mockResolvedValue([
        { id: "machine-with-issues", modelId: "model-1" },
      ] as any);
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      } as any);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ machines: [] }), // No machines from API
      });

      const result = await caller.pinballMap.syncLocation({
        locationId: "loc-1",
      });

      expect(result.removed).toBe(0);
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  describe("getSyncStatus", () => {
    it("should return sync status for the organization", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ apiEnabled: true }]),
        }),
      } as any);
      mockDb.query.locations.findMany.mockResolvedValue([]);

      const result = await caller.pinballMap.getSyncStatus();

      expect(result.configEnabled).toBe(true);
      expect(result.locations).toEqual([]);
      expect(mockDb.query.locations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.any(Object) }),
      );
    });
  });
});

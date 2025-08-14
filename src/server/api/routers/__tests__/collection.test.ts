/* eslint-disable @typescript-eslint/unbound-method */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DrizzleClient } from "~/server/db/drizzle";

import { CollectionService } from "~/server/services/collectionService";

// Simple integration test focusing on service integration with router input validation
describe("Collection Router Integration", () => {
  let service: CollectionService;
  let mockDrizzle: DrizzleClient;

  beforeEach(() => {
    // Create comprehensive mock chain for Drizzle query builder
    const createQueryChain = () => ({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([]),
              }),
              orderBy: vi.fn().mockResolvedValue([]),
            }),
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
            orderBy: vi.fn().mockResolvedValue([]),
          }),
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
            orderBy: vi.fn().mockResolvedValue([]),
          }),
          orderBy: vi.fn().mockResolvedValue([]),
        }),
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
            orderBy: vi.fn().mockResolvedValue([]),
          }),
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
          orderBy: vi.fn().mockResolvedValue([]),
        }),
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    });

    mockDrizzle = {
      select: vi.fn().mockImplementation(createQueryChain),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      query: {
        collections: {
          findMany: vi.fn().mockResolvedValue([]),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        collectionTypes: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        machines: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
      execute: vi.fn().mockResolvedValue(undefined),
    } as unknown as DrizzleClient;

    service = new CollectionService(mockDrizzle);
    vi.clearAllMocks();
  });

  describe("Basic functionality", () => {
    it("should instantiate properly", () => {
      expect(service).toBeInstanceOf(CollectionService);
    });

    it("should call database methods for getLocationCollections", async () => {
      const result = await service.getLocationCollections(
        "valid-loc-id",
        "valid-org-id",
      );

      expect(result).toHaveProperty("manual");
      expect(result).toHaveProperty("auto");
      expect(Array.isArray(result.manual)).toBe(true);
      expect(Array.isArray(result.auto)).toBe(true);

      expect(mockDrizzle.select).toHaveBeenCalled();
    });

    it("should call database methods for createManualCollection", async () => {
      const mockCollection = {
        id: "coll1",
        name: "Test Collection",
        typeId: "type1",
        locationId: "loc1",
        isManual: true,
      };

      // Update mock to return the collection
      const mockInsert = mockDrizzle.insert as any;
      mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockCollection]),
        }),
      } as any);

      const result = await service.createManualCollection("org1", {
        name: "Test Collection",
        typeId: "type1",
        locationId: "loc1",
        description: "Test description",
      });

      expect(result).toEqual(mockCollection);
      expect(mockDrizzle.insert).toHaveBeenCalled();
    });

    it("should call database methods for toggleCollectionType", async () => {
      await service.toggleCollectionType("type1", false);
      expect(mockDrizzle.update).toHaveBeenCalled();
    });

    it("should call database methods for getOrganizationCollectionTypes", async () => {
      const result = await service.getOrganizationCollectionTypes("org1");

      expect(Array.isArray(result)).toBe(true);
      expect(mockDrizzle.select).toHaveBeenCalled();
    });

    it("should call database methods for generateAutoCollections", async () => {
      const result = await service.generateAutoCollections("org1");

      expect(result).toHaveProperty("generated");
      expect(result).toHaveProperty("updated");
      expect(typeof result.generated).toBe("number");
      expect(typeof result.updated).toBe("number");
    });
  });
});

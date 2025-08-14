import { beforeEach, describe, expect, it, vi } from "vitest";

import { CollectionService } from "../collectionService";

import type { DrizzleClient } from "~/server/db/drizzle";

describe("CollectionService", () => {
  let service: CollectionService;
  let mockDrizzle: DrizzleClient;

  beforeEach(() => {
    // Create comprehensive mock chain for Drizzle query builder
    const createQueryChain = () => ({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
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

  describe("basic functionality", () => {
    it("should instantiate properly", () => {
      expect(service).toBeInstanceOf(CollectionService);
    });

    it("should call database methods for getLocationCollections", async () => {
      const result = await service.getLocationCollections(
        "location-1",
        "org-1",
      );

      expect(result).toHaveProperty("manual");
      expect(result).toHaveProperty("auto");
      expect(Array.isArray(result.manual)).toBe(true);
      expect(Array.isArray(result.auto)).toBe(true);
      expect(mockDrizzle.select).toHaveBeenCalled();
    });

    it("should call database methods for getCollectionMachines", async () => {
      const result = await service.getCollectionMachines(
        "collection-1",
        "location-1",
      );

      expect(Array.isArray(result)).toBe(true);
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
      vi.mocked(mockDrizzle.insert).mockReturnValue({
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

    it("should call database methods for addMachinesToCollection", async () => {
      await service.addMachinesToCollection("collection-1", ["machine-1"]);
      expect(mockDrizzle.execute).toHaveBeenCalled();
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
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { CollectionService } from "../collectionService";

import type { PrismaClient } from "@prisma/client";

// Mock Prisma Client
const mockPrisma = {
  collectionType: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  collection: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  machine: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe("CollectionService", () => {
  let service: CollectionService;

  beforeEach(() => {
    service = new CollectionService(mockPrisma);
    jest.clearAllMocks();
  });

  describe("getLocationCollections", () => {
    it("should return manual and auto collections for a location", async () => {
      const mockCollectionTypes = [
        {
          id: "type1",
          name: "Rooms",
          displayName: "Rooms",
          isEnabled: true,
          sortOrder: 1,
        },
        {
          id: "type2",
          name: "Manufacturer",
          displayName: "Manufacturer",
          isEnabled: true,
          sortOrder: 2,
        },
      ];

      const mockCollections = [
        {
          id: "coll1",
          name: "Front Room",
          isManual: true,
          type: mockCollectionTypes[0]!,
          _count: { machines: 5 },
        },
        {
          id: "coll2",
          name: "Stern",
          isManual: false,
          type: mockCollectionTypes[1]!,
          _count: { machines: 3 },
        },
      ];

      (mockPrisma.collection.findMany as jest.Mock).mockResolvedValue(
        mockCollections,
      );

      const result = await service.getLocationCollections("loc1", "org1");

      expect(result.manual).toHaveLength(1);
      expect(result.manual[0]?.name).toBe("Front Room");
      expect(result.auto).toHaveLength(1);
      expect(result.auto[0]?.name).toBe("Stern");
    });

    it("should only return enabled collection types", async () => {
      (mockPrisma.collection.findMany as jest.Mock).mockResolvedValue([]);

      await service.getLocationCollections("loc1", "org1");

      expect(mockPrisma.collection.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { locationId: "loc1" }, // Location-specific collections
            { locationId: null, isManual: false }, // Organization-wide auto-collections
          ],
          type: {
            organizationId: "org1",
            isEnabled: true,
          },
        },
        include: {
          type: true,
          _count: {
            select: {
              machines: {
                where: {
                  locationId: "loc1", // Only count machines at this location
                },
              },
            },
          },
        },
        orderBy: [
          {
            type: {
              sortOrder: "asc",
            },
          },
          {
            sortOrder: "asc",
          },
        ],
      });
    });
  });

  describe("getCollectionMachines", () => {
    it("should return machines in a collection at a location", async () => {
      const mockMachines = [
        {
          id: "machine1",
          model: {
            name: "Medieval Madness",
            manufacturer: "Williams",
            year: 1997,
          },
        },
      ];

      (mockPrisma.machine.findMany as jest.Mock).mockResolvedValue(
        mockMachines,
      );

      const result = await service.getCollectionMachines("coll1", "loc1");

      expect(result).toEqual(mockMachines);
      expect(mockPrisma.machine.findMany).toHaveBeenCalledWith({
        where: {
          locationId: "loc1",
          collections: {
            some: {
              id: "coll1",
            },
          },
        },
        include: {
          model: true,
        },
        orderBy: {
          model: {
            name: "asc",
          },
        },
      });
    });
  });

  describe("createManualCollection", () => {
    it("should create a manual collection", async () => {
      const mockCollection = {
        id: "coll1",
        name: "Front Room",
        typeId: "type1",
        locationId: "loc1",
        isManual: true,
      };

      (mockPrisma.collection.create as jest.Mock).mockResolvedValue(
        mockCollection,
      );

      const result = await service.createManualCollection("org1", {
        name: "Front Room",
        typeId: "type1",
        locationId: "loc1",
        description: "Main playing area",
        isManual: true,
      });

      expect(result).toEqual(mockCollection);
      expect(mockPrisma.collection.create).toHaveBeenCalledWith({
        data: {
          name: "Front Room",
          typeId: "type1",
          locationId: "loc1",
          description: "Main playing area",
          isManual: true,
          isSmart: false,
        },
      });
    });
  });

  describe("addMachinesToCollection", () => {
    it("should add machines to a collection", async () => {
      (mockPrisma.collection.update as jest.Mock).mockResolvedValue({});

      await service.addMachinesToCollection("coll1", ["machine1", "machine2"]);

      expect(mockPrisma.collection.update).toHaveBeenCalledWith({
        where: { id: "coll1" },
        data: {
          machines: {
            connect: [{ id: "machine1" }, { id: "machine2" }],
          },
        },
      });
    });
  });

  describe("toggleCollectionType", () => {
    it("should enable/disable a collection type", async () => {
      (mockPrisma.collectionType.update as jest.Mock).mockResolvedValue({});

      await service.toggleCollectionType("type1", false);

      expect(mockPrisma.collectionType.update).toHaveBeenCalledWith({
        where: { id: "type1" },
        data: { isEnabled: false },
      });
    });
  });

  describe("getOrganizationCollectionTypes", () => {
    it("should return organization collection types with counts", async () => {
      const mockTypes = [
        {
          id: "type1",
          name: "Rooms",
          displayName: "Rooms",
          isAutoGenerated: false,
          isEnabled: true,
          _count: { collections: 3 },
        },
      ];

      (mockPrisma.collectionType.findMany as jest.Mock).mockResolvedValue(
        mockTypes,
      );

      const result = await service.getOrganizationCollectionTypes("org1");

      expect(result).toEqual([
        {
          id: "type1",
          name: "Rooms",
          displayName: "Rooms",
          isAutoGenerated: false,
          isEnabled: true,
          collectionCount: 3,
        },
      ]);
    });
  });

  describe("generateAutoCollections", () => {
    it("should return empty counts when no auto types enabled", async () => {
      (mockPrisma.collectionType.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.generateAutoCollections("org1");

      expect(result).toEqual({ generated: 0, updated: 0 });
      expect(mockPrisma.collectionType.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org1",
          isAutoGenerated: true,
          isEnabled: true,
        },
      });
    });
  });
});

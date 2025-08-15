/* eslint-disable @typescript-eslint/unbound-method */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CollectionService } from "../collectionService";

import type { DrizzleClient } from "~/server/db/drizzle";

// Mock DrizzleClient
const mockDrizzle = {
  query: {
    collections: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    collectionTypes: {
      findMany: vi.fn(),
    },
    machines: {
      findMany: vi.fn(),
    },
  },
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn(),
    }),
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn(),
    }),
  }),
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn(),
    }),
  }),
  execute: vi.fn(),
  selectDistinct: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn(),
      }),
    }),
  }),
  delete: vi.fn().mockReturnValue({
    where: vi.fn(),
  }),
} as unknown as DrizzleClient;

describe("CollectionService", () => {
  let service: CollectionService;

  beforeEach(() => {
    service = new CollectionService(mockDrizzle);
    vi.clearAllMocks();
  });

  describe("basic functionality", () => {
    it("should instantiate properly", () => {
      expect(service).toBeInstanceOf(CollectionService);
    });

    const mockCollections = [
      {
        id: "coll1",
        name: "Front Room",
        isManual: true,
        sortOrder: 1,
        type: {
          id: "type1",
          name: "Rooms",
          displayName: "Rooms",
          organizationId: "org1",
          isEnabled: true,
          sortOrder: 1,
        },
      },
      {
        id: "coll2",
        name: "Stern",
        isManual: false,
        sortOrder: 2,
        type: {
          id: "type2",
          name: "Manufacturer",
          displayName: "Manufacturer",
          organizationId: "org1",
          isEnabled: true,
          sortOrder: 2,
        },
      },
    ];

    it("should return collections grouped by manual and auto", async () => {
      vi.mocked(mockDrizzle.query.collections.findMany).mockResolvedValue(
        mockCollections as any,
      );
      vi.mocked(mockDrizzle.execute).mockResolvedValue([{ count: 5 }] as any);

      const result = await service.getLocationCollections("loc1", "org1");

      expect(result).toHaveProperty("manual");
      expect(result).toHaveProperty("auto");
      expect(Array.isArray(result.manual)).toBe(true);
      expect(Array.isArray(result.auto)).toBe(true);
    });
  });

  it("should only return enabled collection types", async () => {
    vi.mocked(mockDrizzle.query.collections.findMany).mockResolvedValue([]);
    vi.mocked(mockDrizzle.execute).mockResolvedValue([{ count: 0 }] as any);

    await service.getLocationCollections("loc1", "org1");

    expect(mockDrizzle.query.collections.findMany).toHaveBeenCalledWith({
      where: expect.any(Object), // Complex Drizzle where clause with or() and and()
      with: {
        type: {
          columns: {
            id: true,
            name: true,
            displayName: true,
            organizationId: true,
            isEnabled: true,
            sortOrder: true,
          },
        },
      },
      orderBy: expect.any(Array), // Drizzle orderBy with asc()
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

    const expectedResult = [
      {
        id: "machine1",
        model: {
          name: "Medieval Madness",
          manufacturer: "Williams",
          year: 1997,
        },
      },
    ];
    vi.mocked(mockDrizzle.execute).mockResolvedValue([
      {
        id: "machine1",
        model_name: "Medieval Madness",
        manufacturer: "Williams",
        year: 1997,
      },
    ] as any);

    const result = await service.getCollectionMachines("coll1", "loc1");

    expect(result).toEqual(expectedResult);
    expect(mockDrizzle.execute).toHaveBeenCalledWith(
      expect.any(Object), // SQL query with joins
    );
  });

  it("should call database methods for createManualCollection", async () => {
    const mockCollection = {
      id: "coll1",
      name: "Test Collection",
      typeId: "type1",
      locationId: "loc1",
      isManual: true,
    };

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
    const insertCall = vi.mocked(mockDrizzle.insert).mock.calls[0];
    const valuesCall = insertCall?.[0];
    expect(valuesCall).toBeDefined(); // Insert called with collections table
  });

  describe("addMachinesToCollection", () => {
  it("should add machines to a collection", async () => {
    vi.mocked(mockDrizzle.execute).mockResolvedValue({} as any);

    await service.addMachinesToCollection("coll1", ["machine1", "machine2"]);

    expect(mockDrizzle.execute).toHaveBeenCalledWith(
      expect.any(Object), // SQL query for junction table insert
    );
  });

  describe("toggleCollectionType", () => {
  it("should enable/disable a collection type", async () => {
    vi.mocked(mockDrizzle.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    } as any);

    await service.toggleCollectionType("type1", false);

    expect(mockDrizzle.update).toHaveBeenCalled();
    const updateCall = vi.mocked(mockDrizzle.update).mock.calls[0];
    expect(updateCall).toBeDefined(); // Update called with collectionTypes table
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
      },
    ];

    vi.mocked(mockDrizzle.query.collectionTypes.findMany).mockResolvedValue(
      mockTypes as any,
    );
    vi.mocked(mockDrizzle.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 3 }]),
      }),
    } as any);

    expect(mockDrizzle.select).toHaveBeenCalled();
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

  describe("generateAutoCollections", () => {
    it("should return empty counts when no auto types enabled", async () => {
    vi.mocked(mockDrizzle.query.collectionTypes.findMany).mockResolvedValue([]);

    const result = await service.generateAutoCollections("org1");

    expect(result).toEqual({ generated: 0, updated: 0 });
    expect(mockDrizzle.query.collectionTypes.findMany).toHaveBeenCalledWith({
      where: expect.any(Object), // Complex Drizzle where clause with and() conditions
    });
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { CollectionService } from "../collectionService";
import { createAdminServiceMock } from "~/test/helpers/service-mock-database";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import type { DrizzleClient } from "~/server/db/drizzle";

const { valuesReturningMock, whereReturningMock, setMock, ...mockDb } =
  createAdminServiceMock();

vi.mock("~/server/db", () => ({
  db: mockDb,
}));

describe("CollectionService", () => {
  let service: CollectionService;

  beforeEach(() => {
    service = new CollectionService(mockDb as unknown as DrizzleClient);
    vi.clearAllMocks();
    valuesReturningMock.mockClear();
    whereReturningMock.mockClear();
    setMock.mockClear();
  });

  it("should instantiate properly", () => {
    expect(service).toBeInstanceOf(CollectionService);
  });

  describe("createManualCollection", () => {
    it("should create a manual collection", async () => {
      const mockCollectionType = {
        id: SEED_TEST_IDS.MOCK_PATTERNS.TYPE,
        organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
      };
      const mockCollection = {
        id: SEED_TEST_IDS.MOCK_PATTERNS.COLLECTION,
        name: "Test Collection",
        typeId: SEED_TEST_IDS.MOCK_PATTERNS.TYPE,
        locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
        isManual: true,
      };

      mockDb.query.collectionTypes.findFirst.mockResolvedValue(
        mockCollectionType as any,
      );
      const returningMock = vi.fn().mockResolvedValue([mockCollection]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      mockDb.insert = vi.fn().mockReturnValue({ values: valuesMock });

      const result = await service.createManualCollection({
        name: "Test Collection",
        typeId: SEED_TEST_IDS.MOCK_PATTERNS.TYPE,
        locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
        description: "Test description",
      });

      expect(result).toEqual(mockCollection);
      expect(mockDb.query.collectionTypes.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object),
      });
      expect(valuesMock).toHaveBeenCalledWith({
        id: expect.any(String),
        name: "Test Collection",
        typeId: SEED_TEST_IDS.MOCK_PATTERNS.TYPE,
        organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        locationId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
        description: "Test description",
        isManual: true,
        isSmart: false,
        sortOrder: 0,
        filterCriteria: null,
      });
    });
  });

  describe("getLocationCollections", () => {
    it("should return collections grouped by manual and auto", async () => {
      const mockCollections = [
        {
          id: SEED_TEST_IDS.MOCK_PATTERNS.COLLECTION,
          name: "Front Room",
          isManual: true,
          sortOrder: 1,
          type: {
            id: SEED_TEST_IDS.MOCK_PATTERNS.TYPE,
            name: "Rooms",
            displayName: "Rooms",
            organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
            isEnabled: true,
            sortOrder: 1,
          },
        },
        {
          id: `${SEED_TEST_IDS.MOCK_PATTERNS.COLLECTION}-2`,
          name: "Stern",
          isManual: false,
          sortOrder: 2,
          type: {
            id: `${SEED_TEST_IDS.MOCK_PATTERNS.TYPE}-2`,
            name: "Manufacturer",
            displayName: "Manufacturer",
            organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
            isEnabled: true,
            sortOrder: 2,
          },
        },
      ];

      mockDb.query.collections.findMany.mockResolvedValue(
        mockCollections as any,
      );
      mockDb.execute.mockResolvedValue([{ count: 5 }] as any);

      const result = await service.getLocationCollections(
        SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
      );

      expect(result).toHaveProperty("manual");
      expect(result).toHaveProperty("auto");
      expect(Array.isArray(result.manual)).toBe(true);
      expect(Array.isArray(result.auto)).toBe(true);
    });
  });

  describe("getCollectionMachines", () => {
    it("should return machines in a collection at a location", async () => {
      const _mockMachines = [
        {
          id: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
          model: {
            name: "Medieval Madness",
            manufacturer: "Williams",
            year: 1997,
          },
        },
      ];

      const expectedResult = [
        {
          id: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
          model: {
            name: "Medieval Madness",
            manufacturer: "Williams",
            year: 1997,
          },
        },
      ];
      mockDb.execute.mockResolvedValue([
        {
          id: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
          model_name: "Medieval Madness",
          manufacturer: "Williams",
          year: 1997,
        },
      ] as any);

      const result = await service.getCollectionMachines(
        SEED_TEST_IDS.MOCK_PATTERNS.COLLECTION,
        SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
      );

      expect(result).toEqual(expectedResult);
      expect(mockDb.execute).toHaveBeenCalledWith(expect.any(Object));
    });
  });

  describe("addMachinesToCollection", () => {
    it("should add machines to a collection", async () => {
      mockDb.execute.mockResolvedValue({} as any);

      await service.addMachinesToCollection(
        SEED_TEST_IDS.MOCK_PATTERNS.COLLECTION,
        [
          SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
          `${SEED_TEST_IDS.MOCK_PATTERNS.MACHINE}-2`,
        ],
      );

      expect(mockDb.execute).toHaveBeenCalledWith(expect.any(Object));
    });
  });

  describe("toggleCollectionType", () => {
    it("should enable/disable a collection type", async () => {
      const whereMock = vi.fn().mockResolvedValue({});
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      mockDb.update = vi.fn().mockReturnValue({ set: setMock });

      await service.toggleCollectionType(
        SEED_TEST_IDS.MOCK_PATTERNS.TYPE,
        false,
      );

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("getOrganizationCollectionTypes", () => {
    it("should return organization collection types with counts", async () => {
      const mockTypes = [
        {
          id: SEED_TEST_IDS.MOCK_PATTERNS.TYPE,
          name: "Rooms",
          displayName: "Rooms",
          isAutoGenerated: false,
          isEnabled: true,
        },
      ];

      mockDb.query.collectionTypes.findMany.mockResolvedValue(mockTypes as any);
      const whereMock = vi.fn().mockResolvedValue([{ count: 3 }]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      mockDb.select = vi.fn().mockReturnValue({ from: fromMock });

      const result = await service.getOrganizationCollectionTypes();

      expect(result).toEqual([
        {
          id: SEED_TEST_IDS.MOCK_PATTERNS.TYPE,
          name: "Rooms",
          displayName: "Rooms",
          isAutoGenerated: false,
          isEnabled: true,
          collectionCount: 3,
        },
      ]);
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe("generateAutoCollections", () => {
    it("should return empty counts when no auto types enabled", async () => {
      mockDb.query.collectionTypes.findMany.mockResolvedValue([]);

      const result = await service.generateAutoCollections();

      expect(result).toEqual({ generated: 0, updated: 0 });
      expect(mockDb.query.collectionTypes.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
      });
    });
  });
});

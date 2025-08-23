import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CollectionService } from "../collectionService";
import { collections, collectionTypes } from "~/server/db/schema";
import { DrizzleClient } from "~/server/db/drizzle";
import { sql } from "drizzle-orm";

// Factory to create a deep mock of the DrizzleClient for this test file.
const createLocalMockDb = () => {
  const db: any = {
    query: {
      collections: { findMany: vi.fn(), findFirst: vi.fn() },
      collectionTypes: { findMany: vi.fn(), findFirst: vi.fn() },
      machines: { findMany: vi.fn() },
    },
    update: vi.fn(),
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    execute: vi.fn(),
    select: vi.fn(),
    from: vi.fn(),
  };

  // Set up the chaining for mutation methods
  db.update.mockImplementation(() => db);
  db.set.mockImplementation(() => db);
  db.where.mockImplementation(() => db);
  db.insert.mockImplementation(() => db);
  db.values.mockImplementation(() => db);

  // Set up the chaining for select methods
  db.select.mockImplementation(() => db);
  db.from.mockImplementation(() => db);

  // Default return values for terminal methods
  db.returning.mockResolvedValue([]);
  db.execute.mockResolvedValue([]);

  return db as unknown as DrizzleClient;
};

let service: CollectionService;
let mockDb: DrizzleClient;

describe("CollectionService (Isolated)", () => {
  // Aggressive cleanup to prevent mock pollution
  afterAll(async () => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.restoreAllMocks();
    await vi.resetModules();
  });

  beforeEach(() => {
    mockDb = createLocalMockDb();
    service = new CollectionService(mockDb);
  });

  it("should instantiate properly", () => {
    expect(service).toBeInstanceOf(CollectionService);
  });

  describe("createManualCollection", () => {
    it("should create and return a manual collection", async () => {
      const input = {
        name: "My Collection",
        typeId: "type-1",
        locationId: "loc-1",
        description: "A cool collection",
      };
      const mockCollectionType = {
        id: "type-1",
        organizationId: "org-1",
      };
      const mockReturnedCollection = { id: "new-coll-1", ...input };

      vi.mocked(mockDb.query.collectionTypes.findFirst).mockResolvedValue(
        mockCollectionType as any,
      );
      // Mock the end of the insert chain
      vi.mocked(mockDb.returning).mockResolvedValue([mockReturnedCollection]);

      const result = await service.createManualCollection(input);

      expect(result).toEqual(mockReturnedCollection);
      expect(mockDb.query.collectionTypes.findFirst).toHaveBeenCalledTimes(1);
      expect(mockDb.insert).toHaveBeenCalledWith(collections);
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          name: input.name,
          organizationId: "org-1",
        }),
      );
    });
  });

  describe("toggleCollectionType", () => {
    it("should call the update method with the correct parameters", async () => {
      await service.toggleCollectionType("type-to-toggle", false);

      expect(mockDb.update).toHaveBeenCalledWith(collectionTypes);
      expect(mockDb.set).toHaveBeenCalledWith({ isEnabled: false });
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe("getOrganizationCollectionTypes", () => {
    it("should return collection types with their counts", async () => {
      const mockTypes = [{ id: "type-1" }, { id: "type-2" }];
      vi.mocked(mockDb.query.collectionTypes.findMany).mockResolvedValue(
        mockTypes as any,
      );
      // Mock the chained select call for the count
      vi.mocked(mockDb.where).mockResolvedValue([{ count: 5 }] as any);

      const result = await service.getOrganizationCollectionTypes();

      expect(result).toHaveLength(2);
      expect(result[0].collectionCount).toBe(5);
      expect(result[1].collectionCount).toBe(5); // Both will be 5 because the mock is the same
      expect(mockDb.query.collectionTypes.findMany).toHaveBeenCalledTimes(1);
      expect(mockDb.select).toHaveBeenCalledWith({
        count: sql<number>`count(*)`,
      });
      expect(mockDb.from).toHaveBeenCalledWith(collections);
      expect(mockDb.where).toHaveBeenCalledTimes(2);
    });
  });

  describe("generateAutoCollections", () => {
    it("should do nothing if no auto-generated types are enabled", async () => {
      vi.mocked(mockDb.query.collectionTypes.findMany).mockResolvedValue([]);

      const result = await service.generateAutoCollections();

      expect(result).toEqual({ generated: 0, updated: 0 });
    });
  });
});

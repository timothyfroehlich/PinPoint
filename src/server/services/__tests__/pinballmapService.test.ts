/**
 * Tests for PinballMap service layer
 * Following TDD approach - tests first, implementation second
 */

import { PinballMapAPIMocker } from "../../../lib/pinballmap/__tests__/apiMocker";
import { createMockContext, type MockContext } from "../../../test/mockContext";
import { syncLocationGames, processFixtureData } from "../pinballmapService";

import type { Location, Machine, Model } from "@prisma/client";

// Mock Prisma
jest.mock("@prisma/client");

describe("PinballMapService", () => {
  let ctx: MockContext;
  let apiMocker: PinballMapAPIMocker;

  let findUniqueLocationMock: jest.Mock;
  let findUniqueModelMock: jest.Mock;
  let createModelMock: jest.Mock;
  let updateModelMock: jest.Mock;
  let upsertModelMock: jest.Mock;
  let findManyMachineMock: jest.Mock;
  let deleteManyMachineMock: jest.Mock;
  let deleteMachineMock: jest.Mock;
  let createMachineMock: jest.Mock;
  let countIssueMock: jest.Mock;

  beforeEach(() => {
    // Use the centralized mock context helper
    ctx = createMockContext();

    findUniqueLocationMock = jest.fn();
    findUniqueModelMock = jest.fn();
    createModelMock = jest.fn();
    updateModelMock = jest.fn();
    upsertModelMock = jest.fn();
    findManyMachineMock = jest.fn();
    deleteManyMachineMock = jest.fn();
    deleteMachineMock = jest.fn();
    createMachineMock = jest.fn();
    countIssueMock = jest.fn();

    // Assign the jest.fn() mocks to the actual ctx.db methods
    (ctx.db.location.findUnique as any) = findUniqueLocationMock;
    (ctx.db.model.findUnique as any) = findUniqueModelMock;
    (ctx.db.model.create as any) = createModelMock;
    (ctx.db.model.update as any) = updateModelMock;
    (ctx.db.model.upsert as any) = upsertModelMock;
    (ctx.db.machine.findMany as any) = findManyMachineMock;
    (ctx.db.machine.deleteMany as any) = deleteManyMachineMock;
    (ctx.db.machine.delete as any) = deleteMachineMock;
    (ctx.db.machine.create as any) = createMachineMock;
    (ctx.db.issue.count as any) = countIssueMock;
    apiMocker = new PinballMapAPIMocker();
    apiMocker.start();
  });

  afterEach(() => {
    apiMocker.stop();
    jest.clearAllMocks();
  });

  describe("syncLocationGames", () => {
    const mockLocation: Location = {
      id: "location-1",
      name: "Austin Pinball Collective",
      pinballMapId: 26454,
      organizationId: "org-1",
      street: "123 Main St",
      city: "Austin",
      state: "TX",
      zip: "78701",
      phone: "512-555-1234",
      website: "https://austinpinball.com",
      latitude: 30.2672,
      longitude: -97.7431,
      description: "A great place to play pinball",
      lastSyncAt: null,
      syncEnabled: true,
      regionId: null,
    };

    beforeEach(() => {
      findUniqueLocationMock.mockResolvedValue({
        ...mockLocation,
        organization: {
          id: "org-1",
          name: "Test Organization",
          subdomain: "test-org",
          logoUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          pinballMapConfig: {
            id: "config-1",
            organizationId: "org-1",
            apiEnabled: true,
            apiKey: "test-api-key",
            autoSync: false,
            syncInterval: 24,
            createMissingModels: true,
            updateExistingData: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      });
    });
    it("should return error result if location not found", async () => {
      findUniqueLocationMock.mockResolvedValue(null);
      const result = await syncLocationGames(ctx.db, "invalid-location");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Location not found");
      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);
    });
    it("should return error result if location has no PinballMap ID", async () => {
      findUniqueLocationMock.mockResolvedValue({
        ...mockLocation,
        pinballMapId: null,
      } as Location);
      const result = await syncLocationGames(ctx.db, "location-1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Location not configured for PinballMap sync");
      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);
    });
    it("should return error result if location is not found", async () => {
      findUniqueLocationMock.mockResolvedValue(null);
      const result = await syncLocationGames(ctx.db, "location-1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Location not found");
      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);
    });
    it("should successfully sync games from PinballMap", async () => {
      findManyMachineMock.mockResolvedValue([]);
      findUniqueModelMock.mockResolvedValue(null);
      createModelMock.mockImplementation(
        ({ data }: { data: { opdbId: string; name: string } }) =>
          Promise.resolve({
            id: `title-${data.opdbId}`,
            ...data,
          } as Model),
      );
      createMachineMock.mockImplementation(({ data }) =>
        Promise.resolve({ id: "game-instance-1", ...data } as Machine),
      );
      const result = await syncLocationGames(ctx.db, "location-1");
      expect(result.success).toBe(true);
      expect(result.added).toBeGreaterThan(0);
      expect(result.removed).toBe(0);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/locations/26454/machine_details.json"),
      );
    });
    it("should remove games not in PinballMap anymore", async () => {
      const existingGame: Partial<Machine> = {
        id: "game-instance-old",
        modelId: "game-title-old",
      };
      findManyMachineMock.mockResolvedValue([existingGame]);
      countIssueMock.mockResolvedValue(0); // No issues on the machine
      deleteMachineMock.mockResolvedValue({});
      findUniqueModelMock.mockResolvedValue(null);
      createModelMock.mockImplementation(
        ({ data }: { data: { opdbId: string; name: string } }) =>
          Promise.resolve({
            id: `title-${data.opdbId}`,
            ...data,
          } as Model),
      );
      createMachineMock.mockImplementation(({ data }) =>
        Promise.resolve({ id: "new-instance", ...data } as Machine),
      );
      const result = await syncLocationGames(ctx.db, "location-1");
      expect(countIssueMock).toHaveBeenCalledWith({
        where: { machineId: "game-instance-old" },
      });
      expect(deleteMachineMock).toHaveBeenCalledWith({
        where: { id: "game-instance-old" },
      });
      expect(result.removed).toBeGreaterThan(0);
    });
    it("should preserve existing games that are still in PinballMap", async () => {
      const fixtureData = PinballMapAPIMocker.getFixtureData();
      const firstMachine = fixtureData.machines[0];
      if (!firstMachine) throw new Error("Fixture data is empty");

      // Mock one existing game that matches the first machine in fixture data
      const existingModel = {
        id: "existing-model-id",
        name: firstMachine.name,
        opdbId: firstMachine.opdb_id,
      };

      const existingGame: Partial<Machine> = {
        id: "game-instance-existing",
        modelId: existingModel.id,
        locationId: "location-1",
        ownerId: null,
      };

      findManyMachineMock.mockResolvedValue([existingGame]);

      // When searching for the first machine, return the existing model
      findUniqueModelMock.mockImplementation(({ where }) => {
        if (where?.opdbId === firstMachine.opdb_id) {
          return Promise.resolve(existingModel as Model);
        }
        return Promise.resolve(null);
      });

      createModelMock.mockImplementation(
        ({ data }: { data: { opdbId: string; name: string } }) =>
          Promise.resolve({
            id: `title-${data.opdbId}`,
            ...data,
          } as Model),
      );
      createMachineMock.mockImplementation(({ data }) =>
        Promise.resolve({ id: "new-instance", ...data } as Machine),
      );

      const result = await syncLocationGames(ctx.db, "location-1");

      // Should not delete any machines since the existing one is still in PinballMap
      expect(deleteMachineMock).not.toHaveBeenCalled();
      expect(result.added).toBe(fixtureData.machines.length - 1); // All except the existing one
      expect(result.removed).toBe(0);
    });
  });

  describe("processFixtureData", () => {
    it("should process fixture data correctly for seeding", async () => {
      // SETUP: This test uses fixture data to seed the database with sample games
      // This is useful for development and testing environments
      const fixtureData = PinballMapAPIMocker.getFixtureData();
      const mockLocationId = "location-1";

      // Mock that both OPDB games and custom games can be created
      // For OPDB games (findUnique returns null, then create)
      findUniqueModelMock.mockResolvedValue(null);
      createModelMock.mockImplementation(
        ({ data }: { data: { name: string } }) =>
          Promise.resolve({ id: `title-${data.name}`, ...data } as Model),
      );

      // For custom games (upsert)
      upsertModelMock.mockImplementation(
        ({ create }: { create: { name: string } }) =>
          Promise.resolve({
            id: `title-${create.name}`,
            ...create,
          } as Model),
      );

      // Mock that game instance creation succeeds for each machine
      createMachineMock.mockImplementation(
        ({ data }: { data: { modelId: string } }) =>
          Promise.resolve({
            id: `instance-${data.modelId}`,
            ...data,
          } as Machine),
      );

      // TEST: Process the fixture data to create games
      const result = await processFixtureData(
        ctx.db,
        fixtureData,
        mockLocationId,
        "org-1",
      );

      // ASSERTIONS: Verify all games were created
      expect(result.created).toBe(fixtureData.machines.length); // Should create all machines
      expect(createMachineMock).toHaveBeenCalledTimes(
        fixtureData.machines.length,
      );
    });
  });

  describe("Multi-tenancy and Organization Isolation", () => {
    it("should only sync games within the same organization", async () => {
      // SETUP: Create locations from different organizations
      const org1Location = {
        id: "location-org1",
        name: "Org 1 Location",
        pinballMapId: 26454,
        organizationId: "org-1",
      };

      // Mock existing games from a different organization
      // (not needed for this test - we only care about the current org)

      findUniqueLocationMock.mockResolvedValue({
        ...org1Location,
        street: "123 Main St",
        city: "Austin",
        state: "TX",
        zip: "78701",
        phone: "512-555-1234",
        website: "https://austinpinball.com",
        latitude: 30.2672,
        longitude: -97.7431,
        description: "A great place to play pinball",
        lastSyncAt: null,
        syncEnabled: true,
        regionId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        organization: {
          id: "org-1",
          name: "Test Organization",
          subdomain: "test-org",
          logoUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          pinballMapConfig: {
            id: "config-1",
            organizationId: "org-1",
            apiEnabled: true,
            apiKey: "test-api-key",
            autoSync: false,
            syncInterval: 24,
            createMissingModels: true,
            updateExistingData: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      });

      // Mock that we only find games from the current organization's room
      findManyMachineMock.mockResolvedValue([] as Machine[]); // No games in org-1's room

      // Mock game title and instance creation
      findUniqueModelMock.mockResolvedValue(null);
      createModelMock.mockImplementation(({ data }) =>
        Promise.resolve({ id: "new-title", ...data } as Model),
      );
      createMachineMock.mockImplementation(({ data }) =>
        Promise.resolve({ id: "new-instance", ...data } as Machine),
      );

      // TEST: Sync games for org-1 location
      const result = await syncLocationGames(ctx.db, "location-org1");

      // ASSERTIONS: Verify org isolation
      expect(result.success).toBe(true);

      // Should only query games from the specific room (which is org-specific)
      expect(findManyMachineMock).toHaveBeenCalledWith({
        where: { locationId: "location-org1" },
        include: { model: true },
      });

      // Should not affect games from other organizations - no deletions expected
      expect(deleteMachineMock).not.toHaveBeenCalled();
    });

    it("should prevent cross-organization data leakage", async () => {
      // SETUP: Verify that the query structure prevents cross-org access
      const mockLocation = {
        id: "location-1",
        organizationId: "org-1",
        pinballMapId: 26454,
      } as Location;

      findUniqueLocationMock.mockResolvedValue({
        ...mockLocation,
        organization: {
          id: "org-1",
          name: "Test Organization",
          subdomain: "test-org",
          logoUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          pinballMapConfig: {
            id: "config-1",
            organizationId: "org-1",
            apiEnabled: true,
            apiKey: "test-api-key",
            autoSync: false,
            syncInterval: 24,
            createMissingModels: true,
            updateExistingData: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      });
      findManyMachineMock.mockResolvedValue([] as Machine[]);

      // TEST: Run sync
      await syncLocationGames(ctx.db, "location-1");

      // ASSERTIONS: Verify queries are scoped correctly
      expect(findUniqueLocationMock).toHaveBeenCalledWith({
        where: {
          id: mockLocation.id,
        },
        include: {
          organization: {
            include: {
              pinballMapConfig: true,
            },
          },
        },
      });

      expect(findManyMachineMock).toHaveBeenCalledWith({
        where: { locationId: mockLocation.id }, // Room inherently scopes to organization
        include: { model: true },
      });
    });
  });

  describe("Error Handling and Edge Cases", () => {
    const mockLocation = {
      id: "location-1",
      pinballMapId: 26454,
      organizationId: "org-1",
    } as Location;

    beforeEach(() => {
      findUniqueLocationMock.mockResolvedValue({
        ...mockLocation,
        organization: {
          id: "org-1",
          name: "Test Organization",
          subdomain: "test-org",
          logoUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          pinballMapConfig: {
            id: "config-1",
            organizationId: "org-1",
            apiEnabled: true,
            apiKey: "test-api-key",
            autoSync: false,
            syncInterval: 24,
            createMissingModels: true,
            updateExistingData: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      });
    });

    it("should handle PinballMap API being down", async () => {
      // SETUP: Mock fetch to simulate network failure
      global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

      // TEST: Try to sync when API is down
      const result = await syncLocationGames(ctx.db, "location-1");

      // ASSERTIONS: When fetch fails, fetchLocationMachines returns null,
      // which causes syncLocation to return this error message
      expect(result.success).toBe(false);
      expect(result.error).toBe("No machine data returned from PinballMap");
      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);
    });

    it("should handle malformed PinballMap data", async () => {
      // SETUP: Mock fetch to return malformed JSON
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ invalid: "data", missing_machines: true }),
      } as Response);

      // TEST: Try to sync with malformed data
      const result = await syncLocationGames(ctx.db, "location-1");

      // ASSERTIONS: Should handle gracefully
      expect(result.success).toBe(false);
      expect(result.error).toBe("No machine data returned from PinballMap");
    });

    it("should handle duplicate machine names correctly", async () => {
      // SETUP: Test how we handle machines with the same name but different IDs
      // This tests the assumption that duplicate names = same machine type
      const duplicateMachines = [
        { id: 1, name: "Medieval Madness", opdb_id: "MM-OPDB-1" },
        { id: 2, name: "Medieval Madness", opdb_id: "MM-OPDB-2" }, // Different OPDB ID
      ];

      // Mock the API to return duplicate names
      apiMocker.stop(); // Stop default mocker
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ machines: duplicateMachines }),
      } as Response);

      findManyMachineMock.mockResolvedValue([] as Machine[]);
      findUniqueModelMock.mockResolvedValue(null);
      createModelMock.mockImplementation(
        ({ data }: { data: { opdbId: string; name: string } }) =>
          Promise.resolve({
            id: `title-${data.opdbId}`,
            ...data,
          } as Model),
      );
      createMachineMock.mockImplementation(
        ({ data }: { data: { modelId: string } }) =>
          Promise.resolve({
            id: `instance-${data.modelId}`,
            ...data,
          } as Machine),
      );

      // TEST: Sync with duplicate machine names
      const result = await syncLocationGames(ctx.db, "location-1");

      // ASSERTIONS: Should create separate Machines for each machine
      expect(result.success).toBe(true);
      expect(result.added).toBe(2); // Both machines should be added
      expect(createModelMock).toHaveBeenCalledTimes(2); // Separate titles
      expect(createMachineMock).toHaveBeenCalledTimes(2); // Separate instances
    });

    it("should handle machines without OPDB IDs", async () => {
      // SETUP: Some older machines might not have OPDB IDs
      const machinesWithoutOpdb = [
        { id: 1, name: "Custom Machine 1", opdb_id: null },
        { id: 2, name: "Custom Machine 2", opdb_id: null },
      ];

      apiMocker.stop();
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ machines: machinesWithoutOpdb }),
      } as Response);

      // All required fields for Machine
      const emptyMachines: Machine[] = [];
      findManyMachineMock.mockResolvedValue(emptyMachines);

      // For machines without OPDB IDs, the service will look for existing models by IPDB ID first
      findUniqueModelMock.mockResolvedValue(null);

      // Then it will create new models
      createModelMock.mockImplementation(
        ({ data }: { data: { name: string } }) =>
          Promise.resolve({
            id: `custom-title-${data.name}`,
            ...data,
          } as Model),
      );
      createMachineMock.mockImplementation(
        ({ data }: { data: { modelId: string } }) =>
          Promise.resolve({ id: "custom-instance", ...data } as Machine),
      );

      // TEST: Sync machines without OPDB IDs
      const result = await syncLocationGames(ctx.db, "location-1");

      // ASSERTIONS: Should handle custom machines correctly
      expect(result.success).toBe(true);
      expect(result.added).toBe(2);
      expect(createModelMock).toHaveBeenCalledTimes(2);
    });
  });
});

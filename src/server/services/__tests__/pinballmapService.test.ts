/**
 * Tests for PinballMap service layer
 * Following TDD approach - tests first, implementation second
 */

import { PrismaClient } from "@prisma/client";

import { PinballMapAPIMocker } from "../../../lib/pinballmap/__tests__/apiMocker";
import {
  syncLocationGames,
  processFixtureData,
  reconcileMachines,
  createOrUpdateModel,
} from "../pinballmapService";

import type { Location, Room, Machine, Model } from "@prisma/client";

// Mock Prisma
jest.mock("@prisma/client");
const MockedPrismaClient = PrismaClient as jest.MockedClass<
  typeof PrismaClient
>;

describe("PinballMapService", () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let apiMocker: PinballMapAPIMocker;

  let findUniqueLocationMock: jest.Mock;
  let findFirstRoomMock: jest.Mock;
  let findUniqueModelMock: jest.Mock;
  let createModelMock: jest.Mock;
  let updateModelMock: jest.Mock;
  let upsertModelMock: jest.Mock;
  let findManyMachineMock: jest.Mock;
  let deleteManyMachineMock: jest.Mock;
  let createMachineMock: jest.Mock;

  beforeEach(() => {
    mockPrisma = new MockedPrismaClient() as jest.Mocked<PrismaClient>;
    findUniqueLocationMock = jest.fn();
    findFirstRoomMock = jest.fn();
    findUniqueModelMock = jest.fn();
    createModelMock = jest.fn();
    updateModelMock = jest.fn();
    upsertModelMock = jest.fn();
    findManyMachineMock = jest.fn();
    deleteManyMachineMock = jest.fn();
    createMachineMock = jest.fn();

    // Assign the jest.fn() mocks to the actual mockPrisma methods
    mockPrisma.location.findUnique = findUniqueLocationMock;
    mockPrisma.room.findFirst = findFirstRoomMock;
    mockPrisma.model.findUnique = findUniqueModelMock;
    mockPrisma.model.create = createModelMock;
    mockPrisma.model.update = updateModelMock;
    mockPrisma.model.upsert = upsertModelMock;
    mockPrisma.machine.findMany = findManyMachineMock;
    mockPrisma.machine.deleteMany = deleteManyMachineMock;
    mockPrisma.machine.create = createMachineMock;
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
      notes: null,
    };
    const mockRoom: Room = {
      id: "room-1",
      name: "Main Floor",
      locationId: "location-1",
      organizationId: "org-1",
      description: null,
    };
    beforeEach(() => {
      findUniqueLocationMock.mockResolvedValue(mockLocation);
      findFirstRoomMock.mockResolvedValue(mockRoom);
    });
    it("should return error result if location not found", async () => {
      findUniqueLocationMock.mockResolvedValue(null);
      const result = await syncLocationGames(mockPrisma, "invalid-location");
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
      const result = await syncLocationGames(mockPrisma, "location-1");
      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Location does not have a PinballMap ID configured",
      );
      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);
    });
    it("should return error result if location has no Main Floor room", async () => {
      findFirstRoomMock.mockResolvedValue(null);
      const result = await syncLocationGames(mockPrisma, "location-1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Main Floor room not found for location");
      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);
    });
    it("should successfully sync games from PinballMap", async () => {
      findManyMachineMock.mockResolvedValue([]);
      findUniqueModelMock.mockResolvedValue(null);
      createModelMock.mockImplementation(
        ({ data }: { data: { opdbId: string } }) =>
          Promise.resolve({ id: `title-${data.opdbId}`, ...data } as Model),
      );
      createMachineMock.mockImplementation(({ data }) =>
        Promise.resolve({ id: "game-instance-1", ...data } as Machine),
      );
      const result = await syncLocationGames(mockPrisma, "location-1");
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
        name: "Old Game",
        modelId: "game-title-old",
      };
      findManyMachineMock.mockResolvedValue([existingGame as Machine]);
      deleteManyMachineMock.mockResolvedValue({ count: 1 });
      findUniqueModelMock.mockResolvedValue(null);
      createModelMock.mockImplementation(
        ({ data }: { data: { opdbId: string } }) =>
          Promise.resolve({ id: `title-${data.opdbId}`, ...data } as Model),
      );
      createMachineMock.mockImplementation(({ data }) =>
        Promise.resolve({ id: "new-instance", ...data } as Machine),
      );
      const result = await syncLocationGames(mockPrisma, "location-1");
      expect(deleteManyMachineMock).toHaveBeenCalledWith({
        where: { id: { in: ["game-instance-old"] } },
      });
      expect(result.removed).toBeGreaterThan(0);
    });
    it("should preserve existing games that are still in PinballMap", async () => {
      const fixtureData = PinballMapAPIMocker.getFixtureData();
      const firstMachine = fixtureData.machines[0];
      if (!firstMachine) throw new Error("Fixture data is empty");
      const existingGame: Partial<Machine> = {
        id: "game-instance-existing",
        name: firstMachine.name,
        modelId: "game-title-existing",
        locationId: mockRoom.id,
        ownerId: null,
      };
      findManyMachineMock.mockResolvedValue([existingGame as Machine]);
      findUniqueModelMock.mockResolvedValue(null);
      createModelMock.mockImplementation(
        ({ data }: { data: { opdbId: string } }) =>
          Promise.resolve({ id: `title-${data.opdbId}`, ...data } as Model),
      );
      createMachineMock.mockImplementation(({ data }) =>
        Promise.resolve({ id: "new-instance", ...data } as Machine),
      );
      const result = await syncLocationGames(mockPrisma, "location-1");
      expect(deleteManyMachineMock).toHaveBeenCalledWith({
        where: { id: { in: [] } },
      });
      expect(result.added).toBe(fixtureData.machines.length - 1);
      expect(result.removed).toBe(0);
    });
  });

  describe("createOrUpdateModel", () => {
    // Mock machine data that represents what comes from PinballMap API
    const mockMachine = {
      id: 123,
      name: "Test Game",
      opdb_id: "TEST-OPDB-ID",
      manufacturer: "Test Manufacturer",
      year: 2023,
    };

    it("should create global game title for OPDB games", async () => {
      // SETUP: Mock that the game title doesn't exist yet (global OPDB game)
      findUniqueModelMock.mockResolvedValue(null);
      createModelMock.mockResolvedValue({
        id: "new-game-title",
        name: mockMachine.name,
        opdbId: mockMachine.opdb_id,
        organizationId: null, // Global games have no organization
      } as Model);

      // TEST: Try to create or update a game title for OPDB game
      const result = await createOrUpdateModel(
        mockPrisma,
        mockMachine,
        "org-1",
      );

      // ASSERTIONS: Verify global game title creation
      expect(findUniqueModelMock).toHaveBeenCalledWith({
        where: { opdbId: mockMachine.opdb_id },
      });

      expect(createModelMock).toHaveBeenCalledWith({
        data: {
          name: mockMachine.name,
          opdbId: mockMachine.opdb_id,
          // No organizationId - this is global
        },
      });

      // Verify the function returned the created game title
      expect(result.id).toBe("new-game-title");
    });

    it("should update existing global game title for OPDB games", async () => {
      // SETUP: Mock that the game title already exists (global OPDB game)
      const existingModel = {
        id: "existing-game-title",
        name: "Old Name",
        opdbId: mockMachine.opdb_id,
        organizationId: null,
      };

      findUniqueModelMock.mockResolvedValue(existingModel as Model);
      updateModelMock.mockResolvedValue({
        ...existingModel,
        name: mockMachine.name, // Updated name
      } as Model);

      // TEST: Try to update existing game title
      await createOrUpdateModel(mockPrisma, mockMachine, "org-1");

      // ASSERTIONS: Verify global game title update
      expect(updateModelMock).toHaveBeenCalledWith({
        where: { opdbId: mockMachine.opdb_id },
        data: {
          name: mockMachine.name,
        },
      });
    });

    it("should create organization-specific game title for custom games", async () => {
      // SETUP: Some machines on PinballMap don't have OPDB IDs (older or custom machines)
      // Our system needs to handle this as organization-specific games
      const machineWithoutOpdb = {
        ...mockMachine,
        opdb_id: null, // This machine has no OPDB ID
      };

      // Mock that the upsert operation succeeds
      upsertModelMock.mockResolvedValue({
        id: "custom-game-title",
        name: machineWithoutOpdb.name,
        opdbId: null,
        organizationId: "org-1",
      } as Model);

      // TEST: Try to create a game title for a machine without OPDB ID
      await createOrUpdateModel(mockPrisma, machineWithoutOpdb, "org-1");

      // ASSERTIONS: Verify organization-specific game title creation
      expect(upsertModelMock).toHaveBeenCalledWith({
        where: {
          unique_custom_game_per_org: {
            name: machineWithoutOpdb.name,
            organizationId: "org-1",
          },
        },
        update: {
          name: machineWithoutOpdb.name,
        },
        create: {
          name: machineWithoutOpdb.name,
          opdbId: null,
          organizationId: "org-1",
        },
      });
    });
  });

  describe("processFixtureData", () => {
    it("should process fixture data correctly for seeding", async () => {
      // SETUP: This test uses fixture data to seed the database with sample games
      // This is useful for development and testing environments
      const fixtureData = PinballMapAPIMocker.getFixtureData();
      const mockRoomId = "room-1";

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
        ({ data }: { data: { name: string } }) =>
          Promise.resolve({
            id: `instance-${data.name}`,
            ...data,
          } as Machine),
      );

      // TEST: Process the fixture data to create games
      const result = await processFixtureData(
        mockPrisma,
        fixtureData,
        mockRoomId,
        "org-1",
      );

      // ASSERTIONS: Verify all games were created
      expect(result.created).toBe(fixtureData.machines.length); // Should create all machines
      expect(createMachineMock).toHaveBeenCalledTimes(
        fixtureData.machines.length,
      );
    });
  });

  describe("reconcileMachines", () => {
    it("should identify games to add and remove correctly", async () => {
      const fixtureData = PinballMapAPIMocker.getFixtureData();
      const remoteMachines = fixtureData.machines.slice(0, 3);
      // Mock existing games in our database - mix of games to keep and remove
      const existingGames = [
        {
          id: "keep-this",
          name: "Keep Game",
          modelId: "game-title-keep",
          locationId: "room-1",
          ownerId: null,
        },
        {
          id: "remove-this",
          name: "Remove Game",
          modelId: "game-title-remove",
          locationId: "room-1",
          ownerId: null,
        },
      ] as unknown as Machine[];
      findManyMachineMock.mockResolvedValue(existingGames);
      deleteManyMachineMock.mockResolvedValue({ count: 1 });
      findUniqueModelMock.mockResolvedValue(null);
      createModelMock.mockImplementation(
        ({ data }: { data: { opdbId: string } }) =>
          Promise.resolve({ id: `title-${data.opdbId}`, ...data } as Model),
      );
      createMachineMock.mockImplementation(
        ({ data }: { data: { name: string } }) =>
          Promise.resolve({
            id: `instance-${data.name}`,
            ...data,
          } as Machine),
      );
      const result = await reconcileMachines(
        mockPrisma,
        "room-1",
        "org-1",
        remoteMachines,
      );
      expect(result.removed).toBe(1);
      expect(result.added).toBe(2);
      expect(deleteManyMachineMock).toHaveBeenCalledWith({
        where: { id: { in: ["remove-this"] } },
      });
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

      const org1Room = {
        id: "room-org1",
        name: "Main Floor",
        locationId: "location-org1",
        organizationId: "org-1",
      };

      // Mock existing games from a different organization
      // (not needed for this test - we only care about the current org)

      findUniqueLocationMock.mockResolvedValue(org1Location as Location);
      findFirstRoomMock.mockResolvedValue(org1Room as Room);

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
      const result = await syncLocationGames(mockPrisma, "location-org1");

      // ASSERTIONS: Verify org isolation
      expect(result.success).toBe(true);

      // Should only query games from the specific room (which is org-specific)
      expect(findManyMachineMock).toHaveBeenCalledWith({
        where: { locationId: "room-org1" },
        include: { model: true },
      });

      // Should not affect games from other organizations
      expect(deleteManyMachineMock).toHaveBeenCalledWith({
        where: { id: { in: [] } }, // No cross-org games to delete
      });
    });

    it("should prevent cross-organization data leakage", async () => {
      // SETUP: Verify that the query structure prevents cross-org access
      const mockLocation = {
        id: "location-1",
        organizationId: "org-1",
        pinballMapId: 26454,
      } as Location;

      const mockRoom = {
        id: "room-1",
        locationId: "location-1",
        organizationId: "org-1",
      } as Room;

      findUniqueLocationMock.mockResolvedValue(mockLocation);
      findFirstRoomMock.mockResolvedValue(mockRoom);
      findManyMachineMock.mockResolvedValue([] as Machine[]);

      // TEST: Run sync
      await syncLocationGames(mockPrisma, "location-1");

      // ASSERTIONS: Verify queries are scoped correctly
      expect(findFirstRoomMock).toHaveBeenCalledWith({
        where: {
          locationId: mockLocation.id,
          name: "Main Floor",
        },
      });

      expect(findManyMachineMock).toHaveBeenCalledWith({
        where: { locationId: mockRoom.id }, // Room inherently scopes to organization
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

    const mockRoom = {
      id: "room-1",
      name: "Main Floor",
      locationId: "location-1",
      organizationId: "org-1",
    } as Room;

    beforeEach(() => {
      findUniqueLocationMock.mockResolvedValue(mockLocation);
      findFirstRoomMock.mockResolvedValue(mockRoom);
    });

    it("should handle PinballMap API being down", async () => {
      // SETUP: Mock fetch to simulate network failure
      global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

      // TEST: Try to sync when API is down
      const result = await syncLocationGames(mockPrisma, "location-1");

      // ASSERTIONS: Should return friendly error message about API being down
      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "PinballMap API is currently unavailable. Please try again later.",
      );
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
      const result = await syncLocationGames(mockPrisma, "location-1");

      // ASSERTIONS: Should handle gracefully
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
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
        ({ data }: { data: { opdbId: string } }) =>
          Promise.resolve({ id: `title-${data.opdbId}`, ...data } as Model),
      );
      createMachineMock.mockImplementation(
        ({ data }: { data: { name: string } }) =>
          Promise.resolve({
            id: `instance-${data.name}`,
            ...data,
          } as Machine),
      );

      // TEST: Sync with duplicate machine names
      const result = await syncLocationGames(mockPrisma, "location-1");

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
      (mockPrisma.machine.findMany as jest.Mock).mockResolvedValue(
        emptyMachines,
      );
      (mockPrisma.model.upsert as jest.Mock).mockImplementation(
        ({ create }: { create: { name: string } }) =>
          Promise.resolve({ id: "custom-title", ...create } as Model),
      );
      (mockPrisma.machine.create as jest.Mock).mockImplementation(
        ({ data }: { data: { name: string } }) =>
          Promise.resolve({ id: "custom-instance", ...data } as Machine),
      );

      // TEST: Sync machines without OPDB IDs
      const result = await syncLocationGames(mockPrisma, "location-1");

      // ASSERTIONS: Should handle custom machines correctly
      expect(result.success).toBe(true);
      expect(result.added).toBe(2);
      expect(upsertModelMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("Global vs Organization-Specific Game Titles", () => {
    it("should create global game titles for OPDB games", async () => {
      const opdbMachine = {
        id: 123,
        name: "Medieval Madness",
        opdb_id: "MM-OPDB-123",
      };

      // Mock that the game title doesn't exist yet
      findUniqueModelMock.mockResolvedValue(null);
      createModelMock.mockResolvedValue({
        id: "global-title",
        name: opdbMachine.name,
        opdbId: opdbMachine.opdb_id,
        organizationId: null, // Global
      } as Model);

      // TEST: Create game title for OPDB game
      await createOrUpdateModel(mockPrisma, opdbMachine, "org-1");

      // ASSERTIONS: Should create global game title
      expect(createModelMock).toHaveBeenCalledWith({
        data: {
          name: opdbMachine.name,
          opdbId: opdbMachine.opdb_id,
          // No organizationId - this is global
        },
      });
    });

    it("should create organization-specific game titles for custom games", async () => {
      const customMachine = {
        id: 456,
        name: "Custom House Game",
        opdb_id: null,
      };

      upsertModelMock.mockResolvedValue({
        id: "org-specific-title",
        name: customMachine.name,
        opdbId: null,
        organizationId: "org-1",
      } as Model);

      // TEST: Create game title for custom game
      await createOrUpdateModel(mockPrisma, customMachine, "org-1");

      // ASSERTIONS: Should create org-specific game title
      expect(upsertModelMock).toHaveBeenCalledWith({
        where: {
          unique_custom_game_per_org: {
            name: customMachine.name,
            organizationId: "org-1",
          },
        },
        update: {
          name: customMachine.name,
        },
        create: {
          name: customMachine.name,
          opdbId: null,
          organizationId: "org-1",
        },
      });
    });
  });
});

/**
 * Tests for PinballMap service layer
 * Following TDD approach - tests first, implementation second
 */

import { PrismaClient } from '@prisma/client';
import { PinballMapAPIMocker } from '../../../lib/pinballmap/__tests__/apiMocker';
import {
  syncLocationGames,
  processFixtureData,
  reconcileGameInstances,
  createOrUpdateGameTitle,
} from '../pinballmapService';

// Mock Prisma
jest.mock('@prisma/client');
const MockedPrismaClient = PrismaClient as jest.MockedClass<typeof PrismaClient>;

describe('PinballMapService', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let apiMocker: PinballMapAPIMocker;

  beforeEach(() => {
    // Create mock Prisma instance
    mockPrisma = new MockedPrismaClient() as jest.Mocked<PrismaClient>;

    // Mock Prisma methods
    mockPrisma.location = {
      findUnique: jest.fn(),
    } as any;

    mockPrisma.room = {
      findFirst: jest.fn(),
      create: jest.fn(),
    } as any;

    mockPrisma.gameTitle = {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    } as any;

    mockPrisma.gameInstance = {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
    } as any;

    // Set up API mocker
    apiMocker = new PinballMapAPIMocker();
    apiMocker.start();
  });

  afterEach(() => {
    apiMocker.stop();
    jest.clearAllMocks();
  });

  describe('syncLocationGames', () => {
    const mockLocation = {
      id: 'location-1',
      name: 'Austin Pinball Collective',
      pinballMapId: 26454,
      organizationId: 'org-1',
    };

    const mockRoom = {
      id: 'room-1',
      name: 'Main Floor',
      locationId: 'location-1',
      organizationId: 'org-1',
    };

    beforeEach(() => {
      mockPrisma.location.findUnique.mockResolvedValue(mockLocation as any);
      mockPrisma.room.findFirst.mockResolvedValue(mockRoom as any);
    });

    it('should return error result if location not found', async () => {
      // SETUP: Make the database return null when looking for a location
      // This simulates a location that doesn't exist in the database
      mockPrisma.location.findUnique.mockResolvedValue(null);

      // TEST: Try to sync games for a non-existent location
      const result = await syncLocationGames(mockPrisma, 'invalid-location');

      // EXPECT: Should return error result, not throw
      expect(result.success).toBe(false);
      expect(result.error).toBe('Location not found');
      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);
    });

    it('should return error result if location has no PinballMap ID', async () => {
      // SETUP: Make the database return a location that exists, but has no PinballMap ID
      // This simulates a location that hasn't been connected to the PinballMap API yet
      mockPrisma.location.findUnique.mockResolvedValue({
        ...mockLocation,
        pinballMapId: null, // The key difference - no PinballMap ID
      } as any);

      // TEST: Try to sync games for a location without PinballMap integration
      const result = await syncLocationGames(mockPrisma, 'location-1');

      // EXPECT: Should return error result about missing PinballMap ID
      expect(result.success).toBe(false);
      expect(result.error).toBe('Location does not have a PinballMap ID configured');
      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);
    });

    it('should return error result if location has no Main Floor room', async () => {
      // SETUP: Make the database return null when looking for a "Main Floor" room
      // This simulates a location that exists but doesn't have the required room setup
      mockPrisma.room.findFirst.mockResolvedValue(null);

      // TEST: Try to sync games for a location without a Main Floor room
      const result = await syncLocationGames(mockPrisma, 'location-1');

      // EXPECT: Should return error result about missing Main Floor room
      expect(result.success).toBe(false);
      expect(result.error).toBe('Main Floor room not found for location');
      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);
    });

    it('should successfully sync games from PinballMap', async () => {
      // SETUP: Simulate a successful first-time sync scenario
      // 1. No existing games in the database (empty array)
      mockPrisma.gameInstance.findMany.mockResolvedValue([]);

      // 2. Mock successful game title creation for OPDB games
      mockPrisma.gameTitle.findUnique.mockResolvedValue(null); // Game doesn't exist yet
      mockPrisma.gameTitle.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: `title-${data.opdbId}`, ...data } as any)
      );

      // 3. Mock successful game instance creation - when we create a game instance, return it with an ID
      mockPrisma.gameInstance.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'game-instance-1', ...data } as any)
      );

      // TEST: Run the sync function
      const result = await syncLocationGames(mockPrisma, 'location-1');

      // ASSERTIONS: Verify the sync was successful
      expect(result.success).toBe(true);           // Should report success
      expect(result.added).toBeGreaterThan(0);     // Should have added some games
      expect(result.removed).toBe(0);              // Should not have removed any games (first sync)

      // ASSERTION: Verify the function called the PinballMap API
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/locations/26454/machine_details.json')
      );
    });

    it('should remove games not in PinballMap anymore', async () => {
      // SETUP: Simulate a scenario where we have a game in our database that's no longer on PinballMap
      // This happens when an arcade removes a machine but we haven't synced yet
      const existingGame = {
        id: 'game-instance-old',
        name: 'Old Game',
        gameTitle: {
          id: 'game-title-old',
          opdbId: 'OLD-OPDB-ID',        // This OPDB ID won't be in the PinballMap response
          name: 'Old Game'
        },
      };

      // 1. Mock that we have this old game in our database
      mockPrisma.gameInstance.findMany.mockResolvedValue([existingGame] as any);
      // 2. Mock that the deletion operation works and removes 1 game
      mockPrisma.gameInstance.deleteMany.mockResolvedValue({ count: 1 } as any);

      // 3. Mock game title creation for any new games (there should be some from fixture)
      mockPrisma.gameTitle.findUnique.mockResolvedValue(null);
      mockPrisma.gameTitle.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: `title-${data.opdbId}`, ...data } as any)
      );
      mockPrisma.gameInstance.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'new-instance', ...data } as any)
      );

      // TEST: Run the sync function
      const result = await syncLocationGames(mockPrisma, 'location-1');

      // ASSERTIONS: Verify the old game was removed
      expect(mockPrisma.gameInstance.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['game-instance-old'] } },  // Should delete the specific old game
      });

      expect(result.removed).toBeGreaterThan(0);        // Should report that games were removed
    });

    it('should preserve existing games that are still in PinballMap', async () => {
      // SETUP: Simulate a scenario where we have a game that exists both in our database AND on PinballMap
      // This should NOT be deleted - it should be preserved

      // 1. Get real fixture data from our test API mocker
      const fixtureData = PinballMapAPIMocker.getFixtureData();
      const firstMachine = fixtureData.machines[0];

      // 2. Create a mock existing game that matches a game in the PinballMap response
      const existingGame = {
        id: 'game-instance-existing',
        name: firstMachine.name,
        gameTitle: {
          id: 'game-title-existing',
          opdbId: firstMachine.opdb_id,    // Same OPDB ID as in the fixture data
          name: firstMachine.name
        },
      };

      // 3. Mock that this existing game is in our database
      mockPrisma.gameInstance.findMany.mockResolvedValue([existingGame] as any);

      // 4. Mock game title creation for new games
      mockPrisma.gameTitle.findUnique.mockResolvedValue(null);
      mockPrisma.gameTitle.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: `title-${data.opdbId}`, ...data } as any)
      );
      mockPrisma.gameInstance.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'new-instance', ...data } as any)
      );

      // TEST: Run the sync function
      const result = await syncLocationGames(mockPrisma, 'location-1');

      // ASSERTIONS: Verify the existing game was preserved
      expect(mockPrisma.gameInstance.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [] } }, // Empty array means no games to delete
      });

      // Should add new games from PinballMap, but subtract the 1 existing game we already have
      expect(result.added).toBe(fixtureData.machines.length - 1);
      expect(result.removed).toBe(0);              // No games should be removed
    });
  });

  describe('createOrUpdateGameTitle', () => {
    // Mock machine data that represents what comes from PinballMap API
    const mockMachine = {
      id: 123,
      name: 'Test Game',
      opdb_id: 'TEST-OPDB-ID',
      manufacturer: 'Test Manufacturer',
      year: 2023,
    };

    it('should create global game title for OPDB games', async () => {
      // SETUP: Mock that the game title doesn't exist yet (global OPDB game)
      mockPrisma.gameTitle.findUnique.mockResolvedValue(null);
      mockPrisma.gameTitle.create.mockResolvedValue({
        id: 'new-game-title',
        name: mockMachine.name,
        opdbId: mockMachine.opdb_id,
        organizationId: null, // Global games have no organization
      } as any);

      // TEST: Try to create or update a game title for OPDB game
      const result = await createOrUpdateGameTitle(mockPrisma, mockMachine, 'org-1');

      // ASSERTIONS: Verify global game title creation
      expect(mockPrisma.gameTitle.findUnique).toHaveBeenCalledWith({
        where: { opdbId: mockMachine.opdb_id },
      });

      expect(mockPrisma.gameTitle.create).toHaveBeenCalledWith({
        data: {
          name: mockMachine.name,
          opdbId: mockMachine.opdb_id,
          // No organizationId - this is global
        },
      });

      // Verify the function returned the created game title
      expect(result.id).toBe('new-game-title');
    });

    it('should update existing global game title for OPDB games', async () => {
      // SETUP: Mock that the game title already exists (global OPDB game)
      const existingGameTitle = {
        id: 'existing-game-title',
        name: 'Old Name',
        opdbId: mockMachine.opdb_id,
        organizationId: null,
      };

      mockPrisma.gameTitle.findUnique.mockResolvedValue(existingGameTitle as any);
      mockPrisma.gameTitle.update.mockResolvedValue({
        ...existingGameTitle,
        name: mockMachine.name, // Updated name
      } as any);

      // TEST: Try to update existing game title
      const result = await createOrUpdateGameTitle(mockPrisma, mockMachine, 'org-1');

      // ASSERTIONS: Verify global game title update
      expect(mockPrisma.gameTitle.update).toHaveBeenCalledWith({
        where: { opdbId: mockMachine.opdb_id },
        data: {
          name: mockMachine.name,
        },
      });
    });

    it('should create organization-specific game title for custom games', async () => {
      // SETUP: Some machines on PinballMap don't have OPDB IDs (older or custom machines)
      // Our system needs to handle this as organization-specific games
      const machineWithoutOpdb = {
        ...mockMachine,
        opdb_id: null,      // This machine has no OPDB ID
      };

      // Mock that the upsert operation succeeds
      mockPrisma.gameTitle.upsert.mockResolvedValue({
        id: 'custom-game-title',
        name: machineWithoutOpdb.name,
        opdbId: null,
        organizationId: 'org-1',
      } as any);

      // TEST: Try to create a game title for a machine without OPDB ID
      const result = await createOrUpdateGameTitle(mockPrisma, machineWithoutOpdb, 'org-1');

      // ASSERTIONS: Verify organization-specific game title creation
      expect(mockPrisma.gameTitle.upsert).toHaveBeenCalledWith({
        where: {
          unique_custom_game_per_org: {
            name: machineWithoutOpdb.name,
            organizationId: 'org-1',
          },
        },
        update: {
          name: machineWithoutOpdb.name,
        },
        create: {
          name: machineWithoutOpdb.name,
          opdbId: null,
          organizationId: 'org-1',
        },
      });
    });
  });

  describe('processFixtureData', () => {
    it('should process fixture data correctly for seeding', async () => {
      // SETUP: This test uses fixture data to seed the database with sample games
      // This is useful for development and testing environments
      const fixtureData = PinballMapAPIMocker.getFixtureData();
      const mockRoomId = 'room-1';

      // Mock that both OPDB games and custom games can be created
      // For OPDB games (findUnique returns null, then create)
      mockPrisma.gameTitle.findUnique.mockResolvedValue(null);
      mockPrisma.gameTitle.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: `title-${data.name}`, ...data } as any)
      );

      // For custom games (upsert)
      mockPrisma.gameTitle.upsert.mockImplementation(({ create }) =>
        Promise.resolve({ id: `title-${create.name}`, ...create } as any)
      );

      // Mock that game instance creation succeeds for each machine
      mockPrisma.gameInstance.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: `instance-${data.name}`, ...data } as any)
      );

      // TEST: Process the fixture data to create games
      const result = await processFixtureData(mockPrisma, fixtureData, mockRoomId, 'org-1');

      // ASSERTIONS: Verify all games were created
      expect(result.created).toBe(fixtureData.machines.length);  // Should create all machines
      expect(mockPrisma.gameInstance.create).toHaveBeenCalledTimes(fixtureData.machines.length);
    });
  });

  describe('reconcileGameInstances', () => {
    it('should identify games to add and remove correctly', async () => {
      // SETUP: This test simulates the complex logic of figuring out which games to add/remove
      // when syncing with PinballMap
      const fixtureData = PinballMapAPIMocker.getFixtureData();
      const remoteMachines = fixtureData.machines.slice(0, 3); // Use only first 3 machines from API

      // Mock existing games in our database - mix of games to keep and remove
      const existingGames = [
        {
          id: 'keep-this',
          gameTitle: { opdbId: remoteMachines[0].opdb_id }, // This one exists in remote - should KEEP
        },
        {
          id: 'remove-this',
          gameTitle: { opdbId: 'OLD-GAME-NOT-IN-REMOTE' }, // This one doesn't exist in remote - should REMOVE
        },
      ];

      // Mock database responses
      mockPrisma.gameInstance.findMany.mockResolvedValue(existingGames as any);
      mockPrisma.gameInstance.deleteMany.mockResolvedValue({ count: 1 } as any);

      // Mock game title creation for new machines
      mockPrisma.gameTitle.findUnique.mockResolvedValue(null);
      mockPrisma.gameTitle.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: `title-${data.opdbId}`, ...data } as any)
      );

      // Mock game instance creation
      mockPrisma.gameInstance.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: `instance-${data.name}`, ...data } as any)
      );

      // TEST: Run the reconciliation logic
      const result = await reconcileGameInstances(
        mockPrisma,
        'room-1',
        'org-1',
        remoteMachines
      );

      // ASSERTIONS: Verify the reconciliation worked correctly
      expect(result.removed).toBe(1);     // Should remove 1 game (the old one)
      expect(result.added).toBe(2);       // Should add 2 new games (3 total from remote - 1 existing = 2 new)

      // Verify that the correct game was marked for deletion
      expect(mockPrisma.gameInstance.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['remove-this'] } },
      });
    });
  });

  describe('Multi-tenancy and Organization Isolation', () => {
    it('should only sync games within the same organization', async () => {
      // SETUP: Create locations from different organizations
      const org1Location = {
        id: 'location-org1',
        name: 'Org 1 Location',
        pinballMapId: 26454,
        organizationId: 'org-1',
      };

      const org1Room = {
        id: 'room-org1',
        name: 'Main Floor',
        locationId: 'location-org1',
        organizationId: 'org-1',
      };

      // Mock existing games from a different organization
      const org2Games = [
        {
          id: 'org2-game-instance',
          name: 'Org 2 Game',
          gameTitle: { 
            id: 'org2-game-title',
            opdbId: 'SOME-OPDB-ID',
            organizationId: 'org-2'
          },
        },
      ];

      mockPrisma.location.findUnique.mockResolvedValue(org1Location as any);
      mockPrisma.room.findFirst.mockResolvedValue(org1Room as any);
      
      // Mock that we only find games from the current organization's room
      mockPrisma.gameInstance.findMany.mockResolvedValue([]); // No games in org-1's room

      // Mock game title and instance creation
      mockPrisma.gameTitle.findUnique.mockResolvedValue(null);
      mockPrisma.gameTitle.create.mockImplementation(({ data }) => 
        Promise.resolve({ id: 'new-title', ...data } as any)
      );
      mockPrisma.gameInstance.create.mockImplementation(({ data }) => 
        Promise.resolve({ id: 'new-instance', ...data } as any)
      );

      // TEST: Sync games for org-1 location
      const result = await syncLocationGames(mockPrisma, 'location-org1');

      // ASSERTIONS: Verify org isolation
      expect(result.success).toBe(true);
      
      // Should only query games from the specific room (which is org-specific)
      expect(mockPrisma.gameInstance.findMany).toHaveBeenCalledWith({
        where: { roomId: 'room-org1' },
        include: { gameTitle: true },
      });

      // Should not affect games from other organizations
      expect(mockPrisma.gameInstance.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [] } }, // No cross-org games to delete
      });
    });

    it('should prevent cross-organization data leakage', async () => {
      // SETUP: Verify that the query structure prevents cross-org access
      const mockLocation = {
        id: 'location-1',
        organizationId: 'org-1',
        pinballMapId: 26454,
      };

      const mockRoom = {
        id: 'room-1',
        locationId: 'location-1',
        organizationId: 'org-1',
      };

      mockPrisma.location.findUnique.mockResolvedValue(mockLocation as any);
      mockPrisma.room.findFirst.mockResolvedValue(mockRoom as any);
      mockPrisma.gameInstance.findMany.mockResolvedValue([]);

      // TEST: Run sync
      await syncLocationGames(mockPrisma, 'location-1');

      // ASSERTIONS: Verify queries are scoped correctly
      expect(mockPrisma.room.findFirst).toHaveBeenCalledWith({
        where: {
          locationId: mockLocation.id,
          name: 'Main Floor',
        },
      });

      expect(mockPrisma.gameInstance.findMany).toHaveBeenCalledWith({
        where: { roomId: mockRoom.id }, // Room inherently scopes to organization
        include: { gameTitle: true },
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    const mockLocation = {
      id: 'location-1',
      pinballMapId: 26454,
      organizationId: 'org-1',
    };

    const mockRoom = {
      id: 'room-1',
      name: 'Main Floor',
      locationId: 'location-1',
      organizationId: 'org-1',
    };

    beforeEach(() => {
      mockPrisma.location.findUnique.mockResolvedValue(mockLocation as any);
      mockPrisma.room.findFirst.mockResolvedValue(mockRoom as any);
    });

    it('should handle PinballMap API being down', async () => {
      // SETUP: Mock fetch to simulate network failure
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      // TEST: Try to sync when API is down
      const result = await syncLocationGames(mockPrisma, 'location-1');

      // ASSERTIONS: Should return friendly error message about API being down
      expect(result.success).toBe(false);
      expect(result.error).toBe('PinballMap API is currently unavailable. Please try again later.');
      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);
    });

    it('should handle malformed PinballMap data', async () => {
      // SETUP: Mock fetch to return malformed JSON
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'data', missing_machines: true }),
      } as any);

      // TEST: Try to sync with malformed data
      const result = await syncLocationGames(mockPrisma, 'location-1');

      // ASSERTIONS: Should handle gracefully
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle duplicate machine names correctly', async () => {
      // SETUP: Test how we handle machines with the same name but different IDs
      // This tests the assumption that duplicate names = same machine type
      const duplicateMachines = [
        { id: 1, name: 'Medieval Madness', opdb_id: 'MM-OPDB-1' },
        { id: 2, name: 'Medieval Madness', opdb_id: 'MM-OPDB-2' }, // Different OPDB ID
      ];

      // Mock the API to return duplicate names
      apiMocker.stop(); // Stop default mocker
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ machines: duplicateMachines }),
      } as any);

      mockPrisma.gameInstance.findMany.mockResolvedValue([]);
      mockPrisma.gameTitle.findUnique.mockResolvedValue(null);
      mockPrisma.gameTitle.create.mockImplementation(({ data }) => 
        Promise.resolve({ id: `title-${data.opdbId}`, ...data } as any)
      );
      mockPrisma.gameInstance.create.mockImplementation(({ data }) => 
        Promise.resolve({ id: `instance-${data.name}`, ...data } as any)
      );

      // TEST: Sync with duplicate machine names
      const result = await syncLocationGames(mockPrisma, 'location-1');

      // ASSERTIONS: Should create separate GameInstances for each machine
      expect(result.success).toBe(true);
      expect(result.added).toBe(2); // Both machines should be added
      expect(mockPrisma.gameTitle.create).toHaveBeenCalledTimes(2); // Separate titles
      expect(mockPrisma.gameInstance.create).toHaveBeenCalledTimes(2); // Separate instances
    });

    it('should handle machines without OPDB IDs', async () => {
      // SETUP: Some older machines might not have OPDB IDs
      const machinesWithoutOpdb = [
        { id: 1, name: 'Custom Machine 1', opdb_id: null },
        { id: 2, name: 'Custom Machine 2', opdb_id: null },
      ];

      apiMocker.stop();
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ machines: machinesWithoutOpdb }),
      } as any);

      mockPrisma.gameInstance.findMany.mockResolvedValue([]);
      
      // Mock for custom games (no OPDB ID) - use upsert
      mockPrisma.gameTitle.upsert.mockImplementation(({ create }) => 
        Promise.resolve({ id: 'custom-title', ...create } as any)
      );
      
      mockPrisma.gameInstance.create.mockImplementation(({ data }) => 
        Promise.resolve({ id: 'custom-instance', ...data } as any)
      );

      // TEST: Sync machines without OPDB IDs
      const result = await syncLocationGames(mockPrisma, 'location-1');

      // ASSERTIONS: Should handle custom machines correctly
      expect(result.success).toBe(true);
      expect(result.added).toBe(2);
      
      // Should use organization-specific game titles for custom machines
      expect(mockPrisma.gameTitle.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('Global vs Organization-Specific Game Titles', () => {
    it('should create global game titles for OPDB games', async () => {
      const opdbMachine = {
        id: 123,
        name: 'Medieval Madness',
        opdb_id: 'MM-OPDB-123',
      };

      // Mock that the game title doesn't exist yet
      mockPrisma.gameTitle.findUnique.mockResolvedValue(null);
      mockPrisma.gameTitle.create.mockResolvedValue({
        id: 'global-title',
        name: opdbMachine.name,
        opdbId: opdbMachine.opdb_id,
        organizationId: null, // Global
      } as any);

      // TEST: Create game title for OPDB game
      const result = await createOrUpdateGameTitle(mockPrisma, opdbMachine, 'org-1');

      // ASSERTIONS: Should create global game title
      expect(mockPrisma.gameTitle.create).toHaveBeenCalledWith({
        data: {
          name: opdbMachine.name,
          opdbId: opdbMachine.opdb_id,
          // No organizationId - this is global
        },
      });
    });

    it('should create organization-specific game titles for custom games', async () => {
      const customMachine = {
        id: 456,
        name: 'Custom House Game',
        opdb_id: null,
      };

      mockPrisma.gameTitle.upsert.mockResolvedValue({
        id: 'org-specific-title',
        name: customMachine.name,
        opdbId: null,
        organizationId: 'org-1',
      } as any);

      // TEST: Create game title for custom game
      const result = await createOrUpdateGameTitle(mockPrisma, customMachine, 'org-1');

      // ASSERTIONS: Should create org-specific game title
      expect(mockPrisma.gameTitle.upsert).toHaveBeenCalledWith({
        where: {
          unique_custom_game_per_org: {
            name: customMachine.name,
            organizationId: 'org-1',
          },
        },
        update: {
          name: customMachine.name,
        },
        create: {
          name: customMachine.name,
          opdbId: null,
          organizationId: 'org-1',
        },
      });
    });
  });
});

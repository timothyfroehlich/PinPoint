// Comprehensive tests for redesigned PinballMapService (Task 10)
import { PinballMapService } from "../pinballmapService";

import type { PrismaClient } from "@prisma/client";

// Mock fetch globally for all tests
global.fetch = jest.fn();

// Create properly typed mocks
const mockPinballMapConfigUpsert = jest.fn();
const mockPinballMapConfigFindUnique = jest.fn();
const mockLocationUpdate = jest.fn();
const mockLocationFindUnique = jest.fn();
const mockLocationFindMany = jest.fn();
const mockMachineFindMany = jest.fn();
const mockMachineCreate = jest.fn();
const mockMachineDelete = jest.fn();
const mockModelFindUnique = jest.fn();
const mockModelCreate = jest.fn();
const mockIssueCount = jest.fn();

const mockPrisma = {
  pinballMapConfig: {
    upsert: mockPinballMapConfigUpsert,
    findUnique: mockPinballMapConfigFindUnique,
  },
  location: {
    update: mockLocationUpdate,
    findUnique: mockLocationFindUnique,
    findMany: mockLocationFindMany,
  },
  machine: {
    findMany: mockMachineFindMany,
    create: mockMachineCreate,
    delete: mockMachineDelete,
  },
  model: {
    findUnique: mockModelFindUnique,
    create: mockModelCreate,
  },
  issue: {
    count: mockIssueCount,
  },
} as unknown as PrismaClient;

const service = new PinballMapService(mockPrisma);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const servicePrivate = service as any;

describe("PinballMapService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mocks to prevent test pollution
    mockPinballMapConfigUpsert.mockReset();
    mockPinballMapConfigFindUnique.mockReset();
    mockLocationUpdate.mockReset();
    mockLocationFindUnique.mockReset();
    mockLocationFindMany.mockReset();
    mockMachineFindMany.mockReset();
    mockMachineCreate.mockReset();
    mockMachineDelete.mockReset();
    mockModelFindUnique.mockReset();
    mockModelCreate.mockReset();
    mockIssueCount.mockReset();
    (global.fetch as jest.Mock).mockReset();
  });

  describe("constructor", () => {
    it("should instantiate with Prisma client dependency injection", () => {
      expect(service).toBeInstanceOf(PinballMapService);
    });
  });

  describe("enableIntegration", () => {
    it("should create PinballMapConfig for new organization", async () => {
      mockPinballMapConfigUpsert.mockResolvedValue({});
      await service.enableIntegration("org-123");
      expect(mockPrisma.pinballMapConfig.upsert).toHaveBeenCalledWith({
        where: { organizationId: "org-123" },
        create: {
          organizationId: "org-123",
          apiEnabled: true,
          autoSyncEnabled: false,
        },
        update: { apiEnabled: true },
      });
    });
    it("should update existing PinballMapConfig to enabled", async () => {
      mockPinballMapConfigUpsert.mockResolvedValue({});
      await service.enableIntegration("org-123");
      expect(mockPrisma.pinballMapConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { apiEnabled: true } }),
      );
    });
  });

  describe("configureLocationSync", () => {
    it("should require PinballMap integration to be enabled", async () => {
      mockPrisma.pinballMapConfig.findUnique.mockResolvedValue(null);
      await expect(
        service.configureLocationSync("loc-123", 26454, "org-123"),
      ).rejects.toThrow("PinballMap integration not enabled for organization");
    });
    it("should update location with PinballMap ID and enable sync", async () => {
      mockPrisma.pinballMapConfig.findUnique.mockResolvedValue({
        apiEnabled: true,
      });
      await service.configureLocationSync("loc-123", 26454, "org-123");
      expect(mockPrisma.location.update).toHaveBeenCalledWith({
        where: { id: "loc-123" },
        data: {
          pinballMapId: 26454,
          syncEnabled: true,
        },
      });
    });
  });

  describe("syncLocation", () => {
    function setupMockLocation(overrides = {}) {
      mockPrisma.location.findUnique.mockResolvedValue({
        id: "loc-123",
        pinballMapId: 26454,
        organizationId: "org-123",
        organization: { pinballMapConfig: { apiEnabled: true } },
        ...overrides,
      });
    }
    function setupMockPinballMapAPI(
      machines = [{ opdb_id: "MM-001", machine_name: "Medieval Madness" }],
    ) {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ machines }),
      });
    }
    it("should return error if location not found", async () => {
      mockPrisma.location.findUnique.mockResolvedValue(null);
      const result = await service.syncLocation("invalid-location");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Location not found");
      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);
    });
    it("should return error if location lacks PinballMap ID", async () => {
      setupMockLocation({ pinballMapId: null });
      const result = await service.syncLocation("loc-123");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Location not configured for PinballMap sync");
    });
    it("should return error if organization has integration disabled", async () => {
      setupMockLocation({
        organization: { pinballMapConfig: { apiEnabled: false } },
      });
      const result = await service.syncLocation("loc-123");
      expect(result.success).toBe(false);
      expect(result.error).toBe("PinballMap integration not enabled");
    });
    it("should successfully sync machines from PinballMap", async () => {
      setupMockLocation();
      setupMockPinballMapAPI();
      mockPrisma.machine.findMany.mockResolvedValue([]);
      mockPrisma.model.findUnique.mockResolvedValue({
        id: "model-1",
        name: "Medieval Madness",
      });
      mockPrisma.machine.create.mockResolvedValue({});
      mockPrisma.location.update.mockResolvedValue({});
      const result = await service.syncLocation("loc-123");
      expect(result.success).toBe(true);
      expect(result.added).toBeGreaterThan(0);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/locations/26454/machine_details.json"),
      );
    });
    it("should update lastSyncAt timestamp on successful sync", async () => {
      setupMockLocation();
      setupMockPinballMapAPI();
      mockPrisma.machine.findMany.mockResolvedValue([]);
      mockPrisma.model.findUnique.mockResolvedValue({
        id: "model-1",
        name: "Medieval Madness",
      });
      mockPrisma.machine.create.mockResolvedValue({});
      mockPrisma.location.update.mockResolvedValue({});
      await service.syncLocation("loc-123");
      expect(mockPrisma.location.update).toHaveBeenCalledWith({
        where: { id: "loc-123" },
        data: { lastSyncAt: expect.any(Date) },
      });
    });
  });

  describe("reconcileMachines", () => {
    const mockConfig = { createMissingModels: true, updateExistingData: false };
    it("should add machines that exist on PinballMap but not locally", async () => {
      mockPrisma.machine.findMany.mockResolvedValue([]);
      mockPrisma.model.findUnique.mockResolvedValue({
        id: "model-1",
        name: "Medieval Madness",
      });
      mockPrisma.machine.create.mockResolvedValue({});
      const pinballMapMachines = [
        { opdb_id: "MM-001", machine_name: "Medieval Madness" },
        { opdb_id: "TZ-001", machine_name: "Twilight Zone" },
      ];
      const result = await servicePrivate.reconcileMachines(
        "loc-123",
        "org-123",
        pinballMapMachines,
        mockConfig,
      );
      expect(result.added).toBe(2);
      expect(result.removed).toBe(0);
      expect(mockPrisma.machine.create).toHaveBeenCalledTimes(2);
    });
    it("should preserve existing machines found on PinballMap", async () => {
      const existingMachine = {
        id: "machine-existing",
        modelId: "model-mm",
        model: { opdbId: "MM-001" },
      };
      mockPrisma.machine.findMany.mockResolvedValue([existingMachine]);
      mockPrisma.model.findUnique.mockResolvedValue({
        id: "model-mm",
        name: "Medieval Madness",
      });
      const pinballMapMachines = [
        { opdb_id: "MM-001", machine_name: "Medieval Madness" },
      ];
      const result = await servicePrivate.reconcileMachines(
        "loc-123",
        "org-123",
        pinballMapMachines,
        mockConfig,
      );
      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);
      expect(mockPrisma.machine.delete).not.toHaveBeenCalled();
    });
    it("should NEVER remove machines with associated issues", async () => {
      const machineWithIssues = {
        id: "machine-with-issues",
        modelId: "model-old",
        model: { opdbId: "OLD-001" },
      };
      mockPrisma.machine.findMany.mockResolvedValue([machineWithIssues]);
      mockPrisma.issue.count.mockResolvedValue(3);
      const result = await servicePrivate.reconcileMachines(
        "loc-123",
        "org-123",
        [],
        mockConfig,
      );
      expect(result.removed).toBe(0);
      expect(mockPrisma.machine.delete).not.toHaveBeenCalled();
      expect(mockPrisma.issue.count).toHaveBeenCalledWith({
        where: { machineId: "machine-with-issues" },
      });
    });
    it("should remove machines without issues when missing from PinballMap", async () => {
      const machineWithoutIssues = {
        id: "machine-no-issues",
        modelId: "model-old",
        model: { opdbId: "OLD-001" },
      };
      mockPrisma.machine.findMany.mockResolvedValue([machineWithoutIssues]);
      mockPrisma.issue.count.mockResolvedValue(0);
      const result = await servicePrivate.reconcileMachines(
        "loc-123",
        "org-123",
        [],
        mockConfig,
      );
      expect(result.removed).toBe(1);
      expect(mockPrisma.machine.delete).toHaveBeenCalledWith({
        where: { id: "machine-no-issues" },
      });
    });
    it("should respect createMissingModels configuration", async () => {
      const configNoCreate = { ...mockConfig, createMissingModels: false };
      mockPrisma.machine.findMany.mockResolvedValue([]); // No existing machines
      mockPrisma.model.findUnique.mockResolvedValue(null); // Model doesn't exist
      const unknownMachine = {
        opdb_id: "UNKNOWN-001",
        machine_name: "Unknown Game",
      };
      const result = await servicePrivate.reconcileMachines(
        "loc-123",
        "org-123",
        [unknownMachine],
        configNoCreate,
      );
      expect(result.added).toBe(0);
      expect(mockPrisma.model.create).not.toHaveBeenCalled();
      expect(mockPrisma.machine.create).not.toHaveBeenCalled();
    });
  });

  describe("findOrCreateModel", () => {
    it("should find existing Model by OPDB ID first", async () => {
      const existingModel = {
        id: "model-123",
        name: "Medieval Madness",
        opdbId: "MM-001",
      };
      mockPrisma.model.findUnique
        .mockResolvedValueOnce(existingModel)
        .mockResolvedValueOnce(null);
      const result = await servicePrivate.findOrCreateModel(
        {
          opdb_id: "MM-001",
          ipdb_id: "1234",
          machine_name: "Medieval Madness",
        },
        true,
      );
      expect(result).toEqual(existingModel);
      expect(mockPrisma.model.findUnique).toHaveBeenCalledWith({
        where: { opdbId: "MM-001" },
      });
      expect(mockPrisma.model.findUnique).toHaveBeenCalledTimes(1);
    });
    it("should fallback to IPDB ID if OPDB ID not found", async () => {
      const existingModel = {
        id: "model-456",
        name: "Twilight Zone",
        ipdbId: "1234",
      };
      mockPrisma.model.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingModel);
      const result = await servicePrivate.findOrCreateModel(
        { opdb_id: "TZ-001", ipdb_id: "1234", machine_name: "Twilight Zone" },
        true,
      );
      expect(result).toEqual(existingModel);
      expect(mockPrisma.model.findUnique).toHaveBeenCalledWith({
        where: { opdbId: "TZ-001" },
      });
      expect(mockPrisma.model.findUnique).toHaveBeenCalledWith({
        where: { ipdbId: "1234" },
      });
    });
    it("should create new Model if neither OPDB nor IPDB found", async () => {
      const newModel = { id: "model-new", name: "New Game" };
      mockPrisma.model.findUnique.mockResolvedValue(null);
      mockPrisma.model.create.mockResolvedValue(newModel);
      const result = await servicePrivate.findOrCreateModel(
        {
          opdb_id: "NEW-001",
          ipdb_id: "5678",
          machine_name: "New Game",
          manufacturer: "Stern",
          year: 2023,
          machine_type: "ss",
          machine_display: "dmd",
          is_active: true,
          ipdb_link: "http://ipdb.org/5678",
          opdb_img: "http://opdb.org/new-001.jpg",
          kineticist_url: "http://kineticist.com/new-001",
        },
        true,
      );
      expect(result).toEqual(newModel);
      expect(mockPrisma.model.create).toHaveBeenCalledWith({
        data: {
          name: "New Game",
          manufacturer: "Stern",
          year: 2023,
          opdbId: "NEW-001",
          ipdbId: "5678",
          machineType: "ss",
          machineDisplay: "dmd",
          isActive: true,
          ipdbLink: "http://ipdb.org/5678",
          opdbImgUrl: "http://opdb.org/new-001.jpg",
          kineticistUrl: "http://kineticist.com/new-001",
          isCustom: false,
        },
      });
    });
    it("should return null when createMissingModels is false and model not found", async () => {
      mockPrisma.model.findUnique.mockResolvedValue(null);

      const result = await servicePrivate.findOrCreateModel(
        { opdb_id: "UNKNOWN-001", machine_name: "Unknown Game" },
        false, // createMissingModels = false
      );

      expect(result).toBe(null);
      expect(mockPrisma.model.findUnique).toHaveBeenCalledWith({
        where: { opdbId: "UNKNOWN-001" },
      });
      expect(mockPrisma.model.create).not.toHaveBeenCalled();
    });
  });

  describe("Organization Isolation", () => {
    it("should only access locations within the organization", async () => {
      const org1Location = {
        id: "loc-org1",
        organizationId: "org-1",
        pinballMapId: 26454,
        organization: { pinballMapConfig: { apiEnabled: true } },
      };
      mockPrisma.location.findUnique.mockResolvedValue(org1Location);
      await service.syncLocation("loc-org1");
      expect(mockPrisma.location.findUnique).toHaveBeenCalledWith({
        where: { id: "loc-org1" },
        include: { organization: { include: { pinballMapConfig: true } } },
      });
    });
    it("should only access machines within the location", async () => {
      mockPrisma.machine.findMany.mockResolvedValue([]);
      await servicePrivate.reconcileMachines("loc-123", "org-123", [], {
        createMissingModels: true,
        updateExistingData: false,
      });
      expect(mockPrisma.machine.findMany).toHaveBeenCalledWith({
        where: { locationId: "loc-123" },
        include: { model: true },
      });
    });
    it("should scope getOrganizationSyncStatus to organization", async () => {
      // Mock the required data
      mockPrisma.pinballMapConfig.findUnique.mockResolvedValue({
        apiEnabled: true,
      });
      mockPrisma.location.findMany.mockResolvedValue([
        {
          id: "loc-1",
          name: "Test Location",
          pinballMapId: 123,
          syncEnabled: true,
          lastSyncAt: null,
          _count: { machines: 2 },
        },
      ]);

      await service.getOrganizationSyncStatus("org-123");
      expect(mockPrisma.pinballMapConfig.findUnique).toHaveBeenCalledWith({
        where: { organizationId: "org-123" },
      });
      expect(mockPrisma.location.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-123" },
        include: { _count: { select: { machines: true } } },
      });
    });
  });

  describe("API Error Handling", () => {
    function setupMockLocation() {
      mockPrisma.location.findUnique.mockResolvedValue({
        id: "loc-123",
        pinballMapId: 26454,
        organizationId: "org-123",
        organization: { pinballMapConfig: { apiEnabled: true } },
      });
    }
    it("should handle PinballMap API being unavailable", async () => {
      setupMockLocation();
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));
      const result = await service.syncLocation("loc-123");
      expect(result.success).toBe(false);
      expect(result.error).toBe("No machine data returned from PinballMap");
      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);
    });
    it("should handle HTTP error responses from PinballMap", async () => {
      setupMockLocation();
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
      const result = await service.syncLocation("loc-123");
      expect(result.success).toBe(false);
      expect(result.error).toBe("No machine data returned from PinballMap");
    });
    it("should handle malformed JSON responses", async () => {
      setupMockLocation();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: "data" }),
      });
      const result = await service.syncLocation("loc-123");
      expect(result.success).toBe(false);
      expect(result.error).toBe("No machine data returned from PinballMap");
    });
  });
});

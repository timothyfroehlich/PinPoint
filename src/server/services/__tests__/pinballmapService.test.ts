// Comprehensive tests for redesigned PinballMapService (Task 10)
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PinballMapService } from "../pinballmapService";

import type { ExtendedPrismaClient } from "~/server/db";

// Mock fetch globally for all tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Create properly typed mocks
const mockPinballMapConfigUpsert = vi.fn();
const mockPinballMapConfigFindUnique = vi.fn();
const mockLocationUpdate = vi.fn();
const mockLocationFindUnique = vi.fn();
const mockLocationFindMany = vi.fn();
const mockMachineFindMany = vi.fn();
const mockMachineCreate = vi.fn();
const mockMachineDelete = vi.fn();
const mockModelFindUnique = vi.fn();
const mockModelCreate = vi.fn();
const mockIssueCount = vi.fn();

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
  $accelerate: {
    invalidate: vi.fn(),
    ttl: vi.fn(),
  },
} as unknown as ExtendedPrismaClient;

const service = new PinballMapService(mockPrisma);

// Type assertion for testing private methods
const servicePrivate = service as any;

describe("PinballMapService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should instantiate with Prisma client dependency injection", () => {
      expect(service).toBeInstanceOf(PinballMapService);
    });
  });

  describe("enableIntegration", () => {
    it("should create PinballMapConfig for new organization", async () => {
      mockPinballMapConfigUpsert.mockResolvedValue({} as never);
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
      mockPinballMapConfigUpsert.mockResolvedValue({} as never);
      await service.enableIntegration("org-123");
      expect(mockPrisma.pinballMapConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { apiEnabled: true } }),
      );
    });
  });

  describe("configureLocationSync", () => {
    it("should require PinballMap integration to be enabled", async () => {
      mockPinballMapConfigFindUnique.mockResolvedValue(null);
      await expect(
        service.configureLocationSync("loc-123", 26454, "org-123"),
      ).rejects.toThrow("PinballMap integration not enabled for organization");
    });
    it("should update location with PinballMap ID and enable sync", async () => {
      mockPinballMapConfigFindUnique.mockResolvedValue({
        apiEnabled: true,
      } as never);
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
      mockLocationFindUnique.mockResolvedValue({
        id: "loc-123",
        pinballMapId: 26454,
        organizationId: "org-123",
        organization: { pinballMapConfig: { apiEnabled: true } },
        ...overrides,
      } as never);
    }
    function setupMockPinballMapAPI(
      machines = [{ opdb_id: "MM-001", machine_name: "Medieval Madness" }],
    ) {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ machines }),
        clone: () => mockResponse,
        text: () => Promise.resolve(JSON.stringify({ machines })),
        status: 200,
        statusText: "OK",
        headers: new Headers(),
      };
      mockFetch.mockResolvedValue(mockResponse);
    }
    it("should return error if location not found", async () => {
      mockLocationFindUnique.mockResolvedValue(null);
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
      mockMachineFindMany.mockResolvedValue([]);
      mockModelFindUnique.mockResolvedValue({
        id: "model-1",
        name: "Medieval Madness",
      } as never);
      mockMachineCreate.mockResolvedValue({} as never);
      mockLocationUpdate.mockResolvedValue({} as never);
      const result = await service.syncLocation("loc-123");
      expect(result.success).toBe(true);
      expect(result.added).toBeGreaterThan(0);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining("/locations/26454/machine_details.json"),
        }),
      );
    });
    it("should update lastSyncAt timestamp on successful sync", async () => {
      setupMockLocation();
      setupMockPinballMapAPI();
      mockMachineFindMany.mockResolvedValue([]);
      mockModelFindUnique.mockResolvedValue({
        id: "model-1",
        name: "Medieval Madness",
      } as never);
      mockMachineCreate.mockResolvedValue({} as never);
      mockLocationUpdate.mockResolvedValue({} as never);
      await service.syncLocation("loc-123");
      expect(mockPrisma.location.update).toHaveBeenCalledWith({
        where: { id: "loc-123" },
        data: { lastSyncAt: expect.any(Date) as Date },
      });
    });
  });

  describe("reconcileMachines", () => {
    const mockConfig = { createMissingModels: true, updateExistingData: false };
    it("should add machines that exist on PinballMap but not locally", async () => {
      mockMachineFindMany.mockResolvedValue([]);
      mockModelFindUnique.mockResolvedValue({
        id: "model-1",
        name: "Medieval Madness",
      } as never);
      mockMachineCreate.mockResolvedValue({} as never);
      const pinballMapMachines = [
        { opdb_id: "MM-001", machine_name: "Medieval Madness" },
        { opdb_id: "TZ-001", machine_name: "Twilight Zone" },
      ] as any[];
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
      mockMachineFindMany.mockResolvedValue([existingMachine] as never);
      mockModelFindUnique.mockResolvedValue({
        id: "model-mm",
        name: "Medieval Madness",
      } as never);
      const pinballMapMachines = [
        { opdb_id: "MM-001", machine_name: "Medieval Madness" },
      ] as any[];
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
      mockMachineFindMany.mockResolvedValue([machineWithIssues] as never);
      mockIssueCount.mockResolvedValue(3);
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
      mockMachineFindMany.mockResolvedValue([machineWithoutIssues] as never);
      mockIssueCount.mockResolvedValue(0);
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
      mockMachineFindMany.mockResolvedValue([]); // No existing machines
      mockModelFindUnique.mockResolvedValue(null); // Model doesn't exist
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
      mockModelFindUnique.mockResolvedValueOnce(existingModel as never);
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
      mockModelFindUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingModel as never);
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
      mockModelFindUnique.mockResolvedValue(null);
      mockModelCreate.mockResolvedValue(newModel as never);
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
      mockModelFindUnique.mockResolvedValue(null);

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
      mockLocationFindUnique.mockResolvedValue(org1Location as never);
      await service.syncLocation("loc-org1");
      expect(mockPrisma.location.findUnique).toHaveBeenCalledWith({
        where: { id: "loc-org1" },
        include: { organization: { include: { pinballMapConfig: true } } },
      });
    });
    it("should only access machines within the location", async () => {
      mockMachineFindMany.mockResolvedValue([]);
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
      mockPinballMapConfigFindUnique.mockResolvedValue({
        apiEnabled: true,
      } as never);
      mockLocationFindMany.mockResolvedValue([
        {
          id: "loc-1",
          name: "Test Location",
          pinballMapId: 123,
          syncEnabled: true,
          lastSyncAt: null,
          _count: { machines: 2 },
        },
      ] as never);

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
      mockLocationFindUnique.mockResolvedValue({
        id: "loc-123",
        pinballMapId: 26454,
        organizationId: "org-123",
        organization: { pinballMapConfig: { apiEnabled: true } },
      } as never);
    }
    it("should handle PinballMap API being unavailable", async () => {
      setupMockLocation();
      mockFetch.mockRejectedValue(new Error("Network error"));
      const result = await service.syncLocation("loc-123");
      expect(result.success).toBe(false);
      expect(result.error).toBe("No machine data returned from PinballMap");
      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);
    });
    it("should handle HTTP error responses from PinballMap", async () => {
      setupMockLocation();
      const mockErrorResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
        clone: () => mockErrorResponse,
        text: () => Promise.resolve("Not Found"),
        json: () => Promise.reject(new Error("Not JSON")),
        headers: new Headers(),
      };
      mockFetch.mockResolvedValue(mockErrorResponse);
      const result = await service.syncLocation("loc-123");
      expect(result.success).toBe(false);
      expect(result.error).toBe("No machine data returned from PinballMap");
    });
    it("should handle malformed JSON responses", async () => {
      setupMockLocation();
      const mockMalformedResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve({ invalid: "data" }),
        clone: () => mockMalformedResponse,
        text: () => Promise.resolve('{"invalid": "data"}'),
        headers: new Headers(),
      };
      mockFetch.mockResolvedValue(mockMalformedResponse);
      const result = await service.syncLocation("loc-123");
      expect(result.success).toBe(false);
      expect(result.error).toBe("No machine data returned from PinballMap");
    });
  });
});

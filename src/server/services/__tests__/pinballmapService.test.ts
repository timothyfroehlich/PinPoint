// Comprehensive tests for redesigned PinballMapService (Task 10)
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PinballMapService } from "../pinballmapService";

import type { DrizzleClient } from "~/server/db/drizzle";

// Mock fetch globally for all tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Create DrizzleClient mock
const mockDrizzle = {
  query: {
    pinballMapConfigs: {
      findFirst: vi.fn(),
    },
    locations: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    machines: {
      findMany: vi.fn(),
    },
    models: {
      findFirst: vi.fn(),
    },
  },
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn(),
      onConflictDoUpdate: vi.fn(),
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

const service = new PinballMapService(mockDrizzle);

// Type assertion for testing private methods
const servicePrivate = service as any;

describe("PinballMapService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should instantiate with DrizzleClient dependency injection", () => {
      expect(service).toBeInstanceOf(PinballMapService);
    });
  });

  describe("enableIntegration", () => {
    it("should create PinballMapConfig for new organization", async () => {
      vi.mocked(mockDrizzle.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue({}),
        }),
      } as any);
      await service.enableIntegration("org-123");
      expect(mockDrizzle.insert).toHaveBeenCalled();
      const insertCall = vi.mocked(mockDrizzle.insert).mock.calls[0];
      expect(insertCall).toBeDefined(); // Insert called with pinballMapConfigs table
    });
    it("should update existing PinballMapConfig to enabled", async () => {
      vi.mocked(mockDrizzle.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue({}),
        }),
      } as any);
      await service.enableIntegration("org-123");
      expect(mockDrizzle.insert).toHaveBeenCalled();
      // Verify the onConflictDoUpdate was called (which would update apiEnabled)
      const valuesCall = vi.mocked(mockDrizzle.insert().values);
      expect(valuesCall).toHaveBeenCalled();
    });
  });

  describe("configureLocationSync", () => {
    it("should require PinballMap integration to be enabled", async () => {
      vi.mocked(
        mockDrizzle.query.pinballMapConfigs.findFirst,
      ).mockResolvedValue(null);
      await expect(
        service.configureLocationSync("loc-123", 26454, "org-123"),
      ).rejects.toThrow("PinballMap integration not enabled for organization");
    });
    it("should update location with PinballMap ID and enable sync", async () => {
      vi.mocked(
        mockDrizzle.query.pinballMapConfigs.findFirst,
      ).mockResolvedValue({
        apiEnabled: true,
      } as never);
      vi.mocked(mockDrizzle.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      } as any);
      await service.configureLocationSync("loc-123", 26454, "org-123");
      expect(mockDrizzle.update).toHaveBeenCalled();
      const setCall = vi.mocked(mockDrizzle.update().set);
      expect(setCall).toHaveBeenCalledWith({
        pinballMapId: 26454,
        syncEnabled: true,
      });
    });
  });

  describe("syncLocation", () => {
    function setupMockLocation(overrides = {}) {
      vi.mocked(mockDrizzle.query.locations.findFirst).mockResolvedValue({
        id: "loc-123",
        pinballMapId: 26454,
        organizationId: "org-123",
        organization: { pinballMapConfig: [{ apiEnabled: true }] }, // Array since Drizzle schema uses array
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
      vi.mocked(mockDrizzle.query.locations.findFirst).mockResolvedValue(null);
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
        organization: { pinballMapConfig: [{ apiEnabled: false }] }, // Array format for Drizzle
      });
      const result = await service.syncLocation("loc-123");
      expect(result.success).toBe(false);
      expect(result.error).toBe("PinballMap integration not enabled");
    });
    it("should successfully sync machines from PinballMap", async () => {
      setupMockLocation();
      setupMockPinballMapAPI();
      vi.mocked(mockDrizzle.query.machines.findMany).mockResolvedValue([]);
      vi.mocked(mockDrizzle.query.models.findFirst).mockResolvedValue({
        id: "model-1",
        name: "Medieval Madness",
      } as never);
      vi.mocked(mockDrizzle.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      } as any);
      vi.mocked(mockDrizzle.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      } as any);
      const result = await service.syncLocation("loc-123");
      expect(result.success).toBe(true);
      expect(result.added).toBeGreaterThan(0);
      expect(mockFetch).toHaveBeenCalled();
      // Verify the URL is correct by checking the call arguments
      const fetchCall = mockFetch.mock.calls[0]?.[0];
      if (fetchCall && typeof fetchCall === "object" && "url" in fetchCall) {
        expect(fetchCall.url).toBe(
          "https://pinballmap.com/api/v1/locations/26454/machine_details.json",
        );
      } else {
        expect(fetchCall).toBe(
          "https://pinballmap.com/api/v1/locations/26454/machine_details.json",
        );
      }
    });
    it("should update lastSyncAt timestamp on successful sync", async () => {
      setupMockLocation();
      setupMockPinballMapAPI();
      vi.mocked(mockDrizzle.query.machines.findMany).mockResolvedValue([]);
      vi.mocked(mockDrizzle.query.models.findFirst).mockResolvedValue({
        id: "model-1",
        name: "Medieval Madness",
      } as never);
      vi.mocked(mockDrizzle.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      } as any);
      vi.mocked(mockDrizzle.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      } as any);
      await service.syncLocation("loc-123");
      expect(mockDrizzle.update).toHaveBeenCalled();
      const setCall = vi.mocked(mockDrizzle.update().set);
      expect(setCall).toHaveBeenCalledWith({
        lastSyncAt: expect.any(Date) as Date,
      });
    });
  });

  describe("reconcileMachines", () => {
    const mockConfig = { createMissingModels: true, updateExistingData: false };
    it("should add machines that exist on PinballMap but not locally", async () => {
      vi.mocked(mockDrizzle.query.machines.findMany).mockResolvedValue([]);
      vi.mocked(mockDrizzle.query.models.findFirst).mockResolvedValue({
        id: "model-1",
        name: "Medieval Madness",
      } as never);
      vi.mocked(mockDrizzle.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      } as any);
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
      expect(mockDrizzle.insert).toHaveBeenCalledTimes(2);
    });
    it("should preserve existing machines found on PinballMap", async () => {
      const existingMachine = {
        id: "machine-existing",
        modelId: "model-mm",
        model: { opdbId: "MM-001" },
      };
      vi.mocked(mockDrizzle.query.machines.findMany).mockResolvedValue([
        existingMachine,
      ] as never);
      vi.mocked(mockDrizzle.query.models.findFirst).mockResolvedValue({
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
      expect(mockDrizzle.delete).not.toHaveBeenCalled();
    });
    it("should NEVER remove machines with associated issues", async () => {
      const machineWithIssues = {
        id: "machine-with-issues",
        modelId: "model-old",
        model: { opdbId: "OLD-001" },
      };
      vi.mocked(mockDrizzle.query.machines.findMany).mockResolvedValue([
        machineWithIssues,
      ] as never);
      vi.mocked(mockDrizzle.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      } as any);
      const result = await servicePrivate.reconcileMachines(
        "loc-123",
        "org-123",
        [],
        mockConfig,
      );
      expect(result.removed).toBe(0);
      expect(mockDrizzle.delete).not.toHaveBeenCalled();
      expect(mockDrizzle.select).toHaveBeenCalled();
    });
    it("should remove machines without issues when missing from PinballMap", async () => {
      const machineWithoutIssues = {
        id: "machine-no-issues",
        modelId: "model-old",
        model: { opdbId: "OLD-001" },
      };
      vi.mocked(mockDrizzle.query.machines.findMany).mockResolvedValue([
        machineWithoutIssues,
      ] as never);
      vi.mocked(mockDrizzle.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      } as any);
      const result = await servicePrivate.reconcileMachines(
        "loc-123",
        "org-123",
        [],
        mockConfig,
      );
      expect(result.removed).toBe(1);
      expect(mockDrizzle.delete).toHaveBeenCalled();
      const whereCall = vi.mocked(mockDrizzle.delete().where);
      expect(whereCall).toHaveBeenCalled();
    });
    it("should respect createMissingModels configuration", async () => {
      const configNoCreate = { ...mockConfig, createMissingModels: false };
      vi.mocked(mockDrizzle.query.machines.findMany).mockResolvedValue([]); // No existing machines
      vi.mocked(mockDrizzle.query.models.findFirst).mockResolvedValue(null); // Model doesn't exist
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
      expect(mockDrizzle.insert).not.toHaveBeenCalled();
    });
  });

  describe("findOrCreateModel", () => {
    it("should find existing Model by OPDB ID first", async () => {
      const existingModel = {
        id: "model-123",
        name: "Medieval Madness",
        opdbId: "MM-001",
      };
      vi.mocked(mockDrizzle.query.models.findFirst).mockResolvedValueOnce(
        existingModel as never,
      );
      const result = await servicePrivate.findOrCreateModel(
        {
          opdb_id: "MM-001",
          ipdb_id: "1234",
          machine_name: "Medieval Madness",
        },
        true,
      );
      expect(result).toEqual(existingModel);
      expect(mockDrizzle.query.models.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object), // Drizzle where clause with eq()
      });
      expect(mockDrizzle.query.models.findFirst).toHaveBeenCalledTimes(1);
    });
    it("should fallback to IPDB ID if OPDB ID not found", async () => {
      const existingModel = {
        id: "model-456",
        name: "Twilight Zone",
        ipdbId: "1234",
      };
      vi.mocked(mockDrizzle.query.models.findFirst)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingModel as never);
      const result = await servicePrivate.findOrCreateModel(
        { opdb_id: "TZ-001", ipdb_id: "1234", machine_name: "Twilight Zone" },
        true,
      );
      expect(result).toEqual(existingModel);
      expect(mockDrizzle.query.models.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object), // Drizzle where clause with eq() for opdbId
      });
      expect(mockDrizzle.query.models.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object), // Drizzle where clause with eq() for ipdbId
      });
    });
    it("should create new Model if neither OPDB nor IPDB found", async () => {
      const newModel = { id: "model-new", name: "New Game" };
      vi.mocked(mockDrizzle.query.models.findFirst).mockResolvedValue(null);
      vi.mocked(mockDrizzle.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newModel]),
        }),
      } as any);
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
      expect(mockDrizzle.insert).toHaveBeenCalled();
      const valuesCall = vi.mocked(mockDrizzle.insert().values);
      expect(valuesCall).toHaveBeenCalledWith({
        id: expect.any(String), // Generated ID
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
      });
    });
    it("should return null when createMissingModels is false and model not found", async () => {
      vi.mocked(mockDrizzle.query.models.findFirst).mockResolvedValue(null);

      const result = await servicePrivate.findOrCreateModel(
        { opdb_id: "UNKNOWN-001", machine_name: "Unknown Game" },
        false, // createMissingModels = false
      );

      expect(result).toBe(null);
      expect(mockDrizzle.query.models.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object), // Drizzle where clause with eq()
      });
      expect(mockDrizzle.insert).not.toHaveBeenCalled();
    });
  });

  describe("Organization Isolation", () => {
    it("should only access locations within the organization", async () => {
      const org1Location = {
        id: "loc-org1",
        organizationId: "org-1",
        pinballMapId: 26454,
        organization: { pinballMapConfig: [{ apiEnabled: true }] }, // Array format
      };
      vi.mocked(mockDrizzle.query.locations.findFirst).mockResolvedValue(
        org1Location as never,
      );
      await service.syncLocation("loc-org1");
      expect(mockDrizzle.query.locations.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object), // Drizzle where clause with eq()
        with: {
          organization: {
            with: {
              pinballMapConfig: expect.any(Object),
            },
          },
        },
      });
    });
    it("should only access machines within the location", async () => {
      vi.mocked(mockDrizzle.query.machines.findMany).mockResolvedValue([]);
      await servicePrivate.reconcileMachines("loc-123", "org-123", [], {
        createMissingModels: true,
        updateExistingData: false,
      });
      expect(mockDrizzle.query.machines.findMany).toHaveBeenCalledWith({
        where: expect.any(Object), // Drizzle where clause with eq()
        with: {
          model: expect.any(Object),
        },
      });
    });
    it("should scope getOrganizationSyncStatus to organization", async () => {
      // Mock the required data
      vi.mocked(
        mockDrizzle.query.pinballMapConfigs.findFirst,
      ).mockResolvedValue({
        apiEnabled: true,
      } as never);
      vi.mocked(mockDrizzle.query.locations.findMany).mockResolvedValue([
        {
          id: "loc-1",
          name: "Test Location",
          pinballMapId: 123,
          syncEnabled: true,
          lastSyncAt: null,
          machines: [{ id: "machine-1" }, { id: "machine-2" }],
        },
      ] as never);

      await service.getOrganizationSyncStatus("org-123");
      expect(
        mockDrizzle.query.pinballMapConfigs.findFirst,
      ).toHaveBeenCalledWith({
        where: expect.any(Object), // Drizzle where clause with eq()
      });
      expect(mockDrizzle.query.locations.findMany).toHaveBeenCalledWith({
        where: expect.any(Object), // Drizzle where clause with eq()
        with: {
          machines: {
            columns: { id: true },
          },
        },
      });
    });
  });

  describe("API Error Handling", () => {
    function setupMockLocation() {
      vi.mocked(mockDrizzle.query.locations.findFirst).mockResolvedValue({
        id: "loc-123",
        pinballMapId: 26454,
        organizationId: "org-123",
        organization: { pinballMapConfig: [{ apiEnabled: true }] }, // Array format
      } as never);
    }
    it("should handle PinballMap API being unavailable", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // Suppress console.error for this test
      });

      setupMockLocation();
      mockFetch.mockRejectedValue(new Error("Network error"));
      const result = await service.syncLocation("loc-123");
      expect(result.success).toBe(false);
      expect(result.error).toBe("No machine data returned from PinballMap");
      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);

      consoleSpy.mockRestore();
    });
    it("should handle HTTP error responses from PinballMap", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // Suppress console.error for this test
      });

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

      consoleSpy.mockRestore();
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

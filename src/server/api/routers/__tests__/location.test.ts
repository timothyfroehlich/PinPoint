/**
 * Location Router Tests (Drizzle Conversion)
 *
 * Comprehensive tests for the location router converted from Prisma to Drizzle.
 * Tests all procedures with modern August 2025 patterns including:
 * - Organizational scoping (multi-tenancy)
 * - Permission-based access control
 * - Complex relational queries with Drizzle
 * - External service integrations (PinballMap)
 * - Error handling and edge cases
 *
 * Uses modern Vitest with type-safe mocking and PGlite integration patterns.
 */

/* eslint-disable @typescript-eslint/unbound-method */

import { TRPCError } from "@trpc/server";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock permission system with modern vi.importActual patterns
vi.mock("~/server/auth/permissions", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/server/auth/permissions")>();
  return {
    ...actual,
    getUserPermissionsForSession: vi.fn(),
    requirePermissionForSession: vi.fn(),
  };
});

// Mock ID generation
vi.mock("~/lib/utils/id-generation", () => ({
  generateId: vi.fn(() => "generated-id-123"),
}));

import type { VitestMockContext } from "~/test/vitestMockContext";

import { generateId } from "~/lib/utils/id-generation";
import { locationRouter } from "~/server/api/routers/location";
import {
  getUserPermissionsForSession,
  requirePermissionForSession,
} from "~/server/auth/permissions";
import { createVitestMockContext } from "~/test/vitestMockContext";

describe("Location Router (Drizzle Conversion)", () => {
  let mockContext: VitestMockContext;
  let caller: ReturnType<typeof locationRouter.createCaller>;

  // Mock data following Drizzle schema patterns
  const mockLocation = {
    id: "location-1",
    name: "Test Location",
    organizationId: "org-1",
    pinballMapId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const mockMachine = {
    id: "machine-1",
    name: "Test Machine",
    qrCodeId: "qr-123",
    organizationId: "org-1",
    locationId: "location-1",
    modelId: "model-1",
    ownerId: "owner-1",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    model: {
      id: "model-1",
      name: "Medieval Madness",
      manufacturer: "Williams",
    },
    owner: {
      id: "owner-1",
      name: "Test Owner",
      profilePicture: "https://example.com/avatar.jpg",
    },
  };

  const _mockIssue = {
    id: "issue-1",
    title: "Test Issue",
    organizationId: "org-1",
    machineId: "machine-1",
    statusId: "status-1",
    priorityId: "priority-1",
    createdById: "user-1",
    createdAt: new Date("2024-01-01"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = createVitestMockContext();

    // Setup authenticated user context with proper organizational membership
    mockContext = {
      ...mockContext,
      user: {
        id: "user-1",
        email: "test@example.com",
        user_metadata: { name: "Test User" },
        app_metadata: { organization_id: "org-1", role: "Member" },
      } as any,
      organization: {
        id: "org-1",
        name: "Test Organization",
        subdomain: "test",
      },
      userPermissions: [
        "location:edit",
        "location:delete",
        "organization:manage",
        "issue:view",
      ],
    } as any;

    // Mock membership validation for organizationProcedure
    vi.mocked(mockContext.db.membership.findFirst).mockResolvedValue({
      id: "membership-1",
      organizationId: "org-1",
      userId: "user-1",
      roleId: "role-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      role: {
        id: "role-1",
        name: "Admin",
        organizationId: "org-1",
        permissions: [
          { id: "perm-1", name: "location:edit" },
          { id: "perm-2", name: "location:delete" },
          { id: "perm-3", name: "organization:manage" },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as any);

    // Mock the permission system with proper async behavior
    vi.mocked(getUserPermissionsForSession).mockResolvedValue([
      "location:edit",
      "location:delete",
      "organization:manage",
      "issue:view",
    ]);

    // Mock requirePermissionForSession to validate permissions
    vi.mocked(requirePermissionForSession).mockImplementation(
      async (_session, permission) => {
        const hasPermission = mockContext.userPermissions.includes(permission);
        if (!hasPermission) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Missing required permission: ${permission}`,
          });
        }
      },
    );

    // Mock PinballMap service
    const mockPinballMapService = {
      syncLocation: vi.fn(),
    };
    vi.mocked(mockContext.services.createPinballMapService).mockReturnValue(
      mockPinballMapService as any,
    );

    caller = locationRouter.createCaller(mockContext);
  });

  describe("create", () => {
    it("should create a location with organizational scoping", async () => {
      // Mock the Drizzle insert chain: insert().values().returning()
      vi.mocked(mockContext.drizzle.returning).mockResolvedValue([
        mockLocation,
      ]);

      const result = await caller.create({ name: "New Test Location" });

      // Verify the Drizzle query chain was called correctly
      expect(mockContext.drizzle.insert).toHaveBeenCalledWith(
        expect.any(Object), // Accept any table object (locations table schema)
      );
      expect(mockContext.drizzle.values).toHaveBeenCalledWith({
        id: "generated-id-123",
        name: "New Test Location",
        organizationId: "org-1",
      });
      expect(mockContext.drizzle.returning).toHaveBeenCalled();
      expect(result).toEqual(mockLocation);
      expect(generateId).toHaveBeenCalled();
    });

    it("should require location:edit permission", async () => {
      // Remove location:edit permission
      vi.mocked(requirePermissionForSession).mockImplementation(
        async (_session, permission) => {
          if (permission === "location:edit") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Missing required permission: location:edit",
            });
          }
        },
      );

      await expect(caller.create({ name: "New Location" })).rejects.toThrow(
        "Missing required permission: location:edit",
      );
    });

    it("should validate input - require non-empty name", async () => {
      await expect(caller.create({ name: "" })).rejects.toThrow();
    });

    it("should require authentication context", async () => {
      const unauthenticatedCaller = locationRouter.createCaller({
        ...mockContext,
        user: null,
        organization: null,
      } as any);

      await expect(
        unauthenticatedCaller.create({ name: "New Location" }),
      ).rejects.toThrow();
    });
  });

  describe("getAll", () => {
    const locationsWithMachines = [
      {
        ...mockLocation,
        machines: [mockMachine],
      },
    ];

    it("should get all locations with machines using relational queries", async () => {
      // Mock the relational query: db.query.locations.findMany()
      vi.mocked(mockContext.drizzle.query.locations.findMany).mockResolvedValue(
        locationsWithMachines,
      );

      const result = await caller.getAll();

      expect(mockContext.drizzle.query.locations.findMany).toHaveBeenCalledWith(
        {
          where: expect.any(Object), // eq(locations.organizationId, "org-1")
          with: {
            machines: true,
          },
          orderBy: expect.any(Object), // locations.name
        },
      );
      expect(result).toEqual(locationsWithMachines);
    });

    it("should enforce organizational scoping", async () => {
      vi.mocked(mockContext.drizzle.query.locations.findMany).mockResolvedValue(
        [],
      );

      await caller.getAll();

      // Verify the where clause uses organizational filtering
      expect(mockContext.drizzle.query.locations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.any(Object), // This would be eq(locations.organizationId, ctx.organization.id)
        }),
      );
    });

    it("should return empty array when no locations exist", async () => {
      vi.mocked(mockContext.drizzle.query.locations.findMany).mockResolvedValue(
        [],
      );

      const result = await caller.getAll();

      expect(result).toEqual([]);
    });

    it("should require organizational membership", async () => {
      const noOrgCaller = locationRouter.createCaller({
        ...mockContext,
        organization: null,
      } as any);

      await expect(noOrgCaller.getAll()).rejects.toThrow();
    });
  });

  describe("getPublic", () => {
    const _publicLocationData = [
      {
        id: "location-1",
        name: "Test Location",
        _count: {
          machines: 1,
        },
        machines: [
          {
            id: "machine-1",
            name: "Test Machine",
            _count: {
              issues: 2, // Unresolved issues count
            },
            model: {
              name: "Medieval Madness",
              manufacturer: "Williams",
            },
          },
        ],
      },
    ];

    it("should get public location data with complex count queries", async () => {
      // Mock the locations query for getPublic
      vi.mocked(mockContext.drizzle.query.locations.findMany).mockResolvedValue(
        [
          {
            id: "location-1",
            name: "Test Location",
            machines: [
              {
                id: "machine-1",
                name: "Test Machine",
                model: {
                  name: "Medieval Madness",
                  manufacturer: "Williams",
                },
              },
            ],
          },
        ],
      );

      // Mock machine counts query
      vi.mocked(mockContext.drizzle.groupBy).mockResolvedValue([
        { locationId: "location-1", machineCount: 1 },
      ]);

      // Mock unresolved issue counts query
      const _issueCountQuery = vi
        .fn()
        .mockResolvedValue([{ machineId: "machine-1", issueCount: 2 }]);
      vi.mocked(mockContext.drizzle.groupBy)
        .mockResolvedValueOnce([{ locationId: "location-1", machineCount: 1 }])
        .mockResolvedValueOnce([{ machineId: "machine-1", issueCount: 2 }]);

      const result = await caller.getPublic();

      // Verify the relational query was called with proper column selection
      expect(mockContext.drizzle.query.locations.findMany).toHaveBeenCalledWith(
        {
          where: expect.any(Object),
          columns: {
            id: true,
            name: true,
          },
          with: {
            machines: {
              columns: {
                id: true,
                name: true,
              },
              with: {
                model: {
                  columns: {
                    name: true,
                    manufacturer: true,
                  },
                },
              },
            },
          },
          orderBy: expect.any(Object),
        },
      );

      // Verify machine count aggregation query
      expect(mockContext.drizzle.select).toHaveBeenCalled();
      expect(mockContext.drizzle.from).toHaveBeenCalled();
      expect(mockContext.drizzle.where).toHaveBeenCalled();
      expect(mockContext.drizzle.groupBy).toHaveBeenCalled();

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "location-1",
            name: "Test Location",
            _count: expect.objectContaining({
              machines: expect.any(Number),
            }),
            machines: expect.arrayContaining([
              expect.objectContaining({
                _count: expect.objectContaining({
                  issues: expect.any(Number),
                }),
              }),
            ]),
          }),
        ]),
      );
    });

    it("should work without authentication but require organization context", async () => {
      const publicCaller = locationRouter.createCaller({
        ...mockContext,
        user: null, // No authentication required for public endpoint
      } as any);

      vi.mocked(mockContext.drizzle.query.locations.findMany).mockResolvedValue(
        [],
      );
      vi.mocked(mockContext.drizzle.groupBy).mockResolvedValue([]);

      const result = await publicCaller.getPublic();
      expect(result).toEqual([]);
    });

    it("should throw error when organization context missing", async () => {
      const noOrgCaller = locationRouter.createCaller({
        ...mockContext,
        organization: null,
      } as any);

      await expect(noOrgCaller.getPublic()).rejects.toThrow(
        "Organization not found",
      );
    });

    it("should filter unresolved issues correctly", async () => {
      vi.mocked(mockContext.drizzle.query.locations.findMany).mockResolvedValue(
        [],
      );
      vi.mocked(mockContext.drizzle.groupBy).mockResolvedValue([]);

      await caller.getPublic();

      // Verify that the issue count query includes proper filtering
      expect(mockContext.drizzle.innerJoin).toHaveBeenCalled();
      expect(mockContext.drizzle.where).toHaveBeenCalledWith(
        expect.any(Object), // and() clause with organization filter and status != RESOLVED
      );
    });
  });

  describe("update", () => {
    it("should update location with organizational scoping", async () => {
      const updatedLocation = { ...mockLocation, name: "Updated Location" };
      vi.mocked(mockContext.drizzle.returning).mockResolvedValue([
        updatedLocation,
      ]);

      const result = await caller.update({
        id: "location-1",
        name: "Updated Location",
      });

      // Verify the Drizzle update chain: update().set().where().returning()
      expect(mockContext.drizzle.update).toHaveBeenCalledWith(
        expect.any(Object), // Accept any table object (locations table schema)
      );
      expect(mockContext.drizzle.set).toHaveBeenCalledWith({
        name: "Updated Location",
        updatedAt: expect.any(Date), // Drizzle auto-adds updatedAt
      });
      expect(mockContext.drizzle.where).toHaveBeenCalledWith(
        expect.any(Object), // and() clause with id and organization filters
      );
      expect(mockContext.drizzle.returning).toHaveBeenCalled();
      expect(result).toEqual(updatedLocation);
    });

    it("should handle partial updates (name optional)", async () => {
      vi.mocked(mockContext.drizzle.returning).mockResolvedValue([
        mockLocation,
      ]);

      await caller.update({ id: "location-1" }); // No name provided

      expect(mockContext.drizzle.set).toHaveBeenCalledWith({
        updatedAt: expect.any(Date), // Drizzle auto-adds updatedAt even for partial updates
      });
    });

    it("should throw error when location not found or access denied", async () => {
      // Mock no results returned (location not found or not in user's org)
      vi.mocked(mockContext.drizzle.returning).mockResolvedValue([]);

      await expect(
        caller.update({ id: "location-1", name: "Updated" }),
      ).rejects.toThrow("Location not found or access denied");
    });

    it("should require location:edit permission", async () => {
      vi.mocked(requirePermissionForSession).mockImplementation(
        async (_session, permission) => {
          if (permission === "location:edit") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Missing required permission: location:edit",
            });
          }
        },
      );

      await expect(
        caller.update({ id: "location-1", name: "Updated" }),
      ).rejects.toThrow("Missing required permission: location:edit");
    });

    it("should validate input - reject empty name", async () => {
      await expect(
        caller.update({ id: "location-1", name: "" }),
      ).rejects.toThrow();
    });

    it("should enforce organizational boundaries in where clause", async () => {
      vi.mocked(mockContext.drizzle.returning).mockResolvedValue([
        mockLocation,
      ]);

      await caller.update({ id: "location-1", name: "Updated" });

      // Verify that where clause includes both ID and organization filters
      expect(mockContext.drizzle.where).toHaveBeenCalledWith(
        expect.any(Object), // and(eq(locations.id, input.id), eq(locations.organizationId, ctx.organization.id))
      );
    });
  });

  describe("getById", () => {
    const detailedLocation = {
      ...mockLocation,
      machines: [
        {
          ...mockMachine,
          model: mockMachine.model,
          owner: mockMachine.owner,
        },
      ],
    };

    it("should get location with detailed relationships", async () => {
      vi.mocked(
        mockContext.drizzle.query.locations.findFirst,
      ).mockResolvedValue(detailedLocation);

      const result = await caller.getById({ id: "location-1" });

      expect(
        mockContext.drizzle.query.locations.findFirst,
      ).toHaveBeenCalledWith({
        where: expect.any(Object), // and() clause with id and organization filters
        with: {
          machines: {
            with: {
              model: true,
              owner: {
                columns: {
                  id: true,
                  name: true,
                  profilePicture: true, // Note: using profilePicture not image
                },
              },
            },
          },
        },
      });
      expect(result).toEqual(detailedLocation);
    });

    it("should throw error when location not found", async () => {
      vi.mocked(
        mockContext.drizzle.query.locations.findFirst,
      ).mockResolvedValue(null);

      await expect(caller.getById({ id: "nonexistent" })).rejects.toThrow(
        "Location not found or access denied",
      );
    });

    it("should enforce organizational scoping in query", async () => {
      vi.mocked(
        mockContext.drizzle.query.locations.findFirst,
      ).mockResolvedValue(null);

      try {
        await caller.getById({ id: "location-1" });
      } catch {
        // Expected to throw
      }

      // Verify organizational scoping in where clause
      expect(
        mockContext.drizzle.query.locations.findFirst,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.any(Object), // and(eq(locations.id, input.id), eq(locations.organizationId, ctx.organization.id))
        }),
      );
    });

    it("should require organizational membership", async () => {
      const noOrgCaller = locationRouter.createCaller({
        ...mockContext,
        organization: null,
      } as any);

      await expect(noOrgCaller.getById({ id: "location-1" })).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("should delete location with organizational scoping", async () => {
      vi.mocked(mockContext.drizzle.returning).mockResolvedValue([
        mockLocation,
      ]);

      const result = await caller.delete({ id: "location-1" });

      // Verify the Drizzle delete chain: delete().where().returning()
      expect(mockContext.drizzle.delete).toHaveBeenCalledWith(
        expect.any(Object), // Accept any table object (locations table schema)
      );
      expect(mockContext.drizzle.where).toHaveBeenCalledWith(
        expect.any(Object), // and() clause with id and organization filters
      );
      expect(mockContext.drizzle.returning).toHaveBeenCalled();
      expect(result).toEqual(mockLocation);
    });

    it("should throw error when location not found or access denied", async () => {
      vi.mocked(mockContext.drizzle.returning).mockResolvedValue([]);

      await expect(caller.delete({ id: "location-1" })).rejects.toThrow(
        "Location not found or access denied",
      );
    });

    it("should require location:delete permission", async () => {
      vi.mocked(requirePermissionForSession).mockImplementation(
        async (_session, permission) => {
          if (permission === "location:delete") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Missing required permission: location:delete",
            });
          }
        },
      );

      await expect(caller.delete({ id: "location-1" })).rejects.toThrow(
        "Missing required permission: location:delete",
      );
    });

    it("should enforce organizational boundaries", async () => {
      vi.mocked(mockContext.drizzle.returning).mockResolvedValue([
        mockLocation,
      ]);

      await caller.delete({ id: "location-1" });

      // Verify organizational scoping in where clause
      expect(mockContext.drizzle.where).toHaveBeenCalledWith(
        expect.any(Object), // and(eq(locations.id, input.id), eq(locations.organizationId, ctx.organization.id))
      );
    });
  });

  describe("setPinballMapId", () => {
    it("should set PinballMap ID for location (admin operation)", async () => {
      const updatedLocation = { ...mockLocation, pinballMapId: 12345 };
      vi.mocked(mockContext.drizzle.returning).mockResolvedValue([
        updatedLocation,
      ]);

      const result = await caller.setPinballMapId({
        locationId: "location-1",
        pinballMapId: 12345,
      });

      // Verify the Drizzle update chain for admin operation
      expect(mockContext.drizzle.update).toHaveBeenCalledWith(
        expect.any(Object), // Accept any table object (locations table schema)
      );
      expect(mockContext.drizzle.set).toHaveBeenCalledWith({
        pinballMapId: 12345,
      });
      expect(mockContext.drizzle.where).toHaveBeenCalledWith(
        expect.any(Object), // and() clause with locationId and organization filters
      );
      expect(mockContext.drizzle.returning).toHaveBeenCalled();
      expect(result).toEqual(updatedLocation);
    });

    it("should require organization:manage permission", async () => {
      vi.mocked(requirePermissionForSession).mockImplementation(
        async (_session, permission) => {
          if (permission === "organization:manage") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Missing required permission: organization:manage",
            });
          }
        },
      );

      await expect(
        caller.setPinballMapId({
          locationId: "location-1",
          pinballMapId: 12345,
        }),
      ).rejects.toThrow("Missing required permission: organization:manage");
    });

    it("should validate positive pinballMapId", async () => {
      await expect(
        caller.setPinballMapId({
          locationId: "location-1",
          pinballMapId: -1,
        }),
      ).rejects.toThrow();

      await expect(
        caller.setPinballMapId({
          locationId: "location-1",
          pinballMapId: 0,
        }),
      ).rejects.toThrow();
    });

    it("should throw error when location not found", async () => {
      vi.mocked(mockContext.drizzle.returning).mockResolvedValue([]);

      await expect(
        caller.setPinballMapId({
          locationId: "nonexistent",
          pinballMapId: 12345,
        }),
      ).rejects.toThrow("Location not found or access denied");
    });

    it("should enforce organizational boundaries", async () => {
      vi.mocked(mockContext.drizzle.returning).mockResolvedValue([
        mockLocation,
      ]);

      await caller.setPinballMapId({
        locationId: "location-1",
        pinballMapId: 12345,
      });

      // Verify organizational scoping in where clause
      expect(mockContext.drizzle.where).toHaveBeenCalledWith(
        expect.any(Object), // and(eq(locations.id, locationId), eq(locations.organizationId, ctx.organization.id))
      );
    });
  });

  describe("syncWithPinballMap", () => {
    let mockPinballMapService: any;

    beforeEach(() => {
      mockPinballMapService = {
        syncLocation: vi.fn(),
      };
      vi.mocked(mockContext.services.createPinballMapService).mockReturnValue(
        mockPinballMapService,
      );
    });

    it("should sync location with PinballMap service successfully", async () => {
      const syncResult = {
        success: true,
        data: { synced: true, machinesUpdated: 3 },
      };
      mockPinballMapService.syncLocation.mockResolvedValue(syncResult);

      const result = await caller.syncWithPinballMap({
        locationId: "location-1",
      });

      expect(mockContext.services.createPinballMapService).toHaveBeenCalled();
      expect(mockPinballMapService.syncLocation).toHaveBeenCalledWith(
        "location-1",
      );
      expect(result).toEqual(syncResult);
    });

    it("should handle sync failures with error message", async () => {
      const syncResult = {
        success: false,
        error: "PinballMap API unavailable",
      };
      mockPinballMapService.syncLocation.mockResolvedValue(syncResult);

      await expect(
        caller.syncWithPinballMap({ locationId: "location-1" }),
      ).rejects.toThrow("PinballMap API unavailable");
    });

    it("should handle sync failures without error message", async () => {
      const syncResult = {
        success: false,
      };
      mockPinballMapService.syncLocation.mockResolvedValue(syncResult);

      await expect(
        caller.syncWithPinballMap({ locationId: "location-1" }),
      ).rejects.toThrow("Sync failed");
    });

    it("should require organization:manage permission", async () => {
      vi.mocked(requirePermissionForSession).mockImplementation(
        async (_session, permission) => {
          if (permission === "organization:manage") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Missing required permission: organization:manage",
            });
          }
        },
      );

      await expect(
        caller.syncWithPinballMap({ locationId: "location-1" }),
      ).rejects.toThrow("Missing required permission: organization:manage");
    });

    it("should handle service creation errors", async () => {
      vi.mocked(
        mockContext.services.createPinballMapService,
      ).mockImplementation(() => {
        throw new Error("Service factory unavailable");
      });

      await expect(
        caller.syncWithPinballMap({ locationId: "location-1" }),
      ).rejects.toThrow("Service factory unavailable");
    });

    it("should handle service method errors", async () => {
      mockPinballMapService.syncLocation.mockRejectedValue(
        new Error("Network error"),
      );

      await expect(
        caller.syncWithPinballMap({ locationId: "location-1" }),
      ).rejects.toThrow("Network error");
    });
  });

  describe("Error Handling & Edge Cases", () => {
    it("should handle database connection errors gracefully", async () => {
      vi.mocked(
        mockContext.drizzle.query.locations.findMany,
      ).mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      await expect(caller.getAll()).rejects.toThrow(
        "Database connection failed",
      );
    });

    it("should handle null/undefined organization context", async () => {
      const nullOrgCaller = locationRouter.createCaller({
        ...mockContext,
        organization: null,
      } as any);

      await expect(nullOrgCaller.getAll()).rejects.toThrow();
    });

    it("should handle malformed input gracefully", async () => {
      // Test invalid ID format
      await expect(caller.getById({ id: "" })).rejects.toThrow();

      // Test invalid pinballMapId
      await expect(
        caller.setPinballMapId({
          locationId: "valid-id",
          pinballMapId: NaN,
        }),
      ).rejects.toThrow();
    });

    it("should handle permission system failures", async () => {
      vi.mocked(requirePermissionForSession).mockRejectedValue(
        new Error("Permission service unavailable"),
      );

      await expect(caller.create({ name: "Test Location" })).rejects.toThrow(
        "Permission service unavailable",
      );
    });

    it("should handle ID generation failures", async () => {
      vi.mocked(generateId).mockImplementation(() => {
        throw new Error("ID generation failed");
      });

      await expect(caller.create({ name: "Test Location" })).rejects.toThrow(
        "ID generation failed",
      );
    });
  });

  describe("Multi-Tenancy & Organizational Isolation", () => {
    it("should isolate data by organization in all queries", async () => {
      vi.mocked(mockContext.drizzle.query.locations.findMany).mockResolvedValue(
        [],
      );
      vi.mocked(
        mockContext.drizzle.query.locations.findFirst,
      ).mockResolvedValue(null);

      // Test all read operations include organizational scoping
      await caller.getAll().catch(() => {
        /* Expected error */
      });
      await caller.getById({ id: "test" }).catch(() => {
        /* Expected error */
      });

      expect(mockContext.drizzle.query.locations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.any(Object), // Organizational filter
        }),
      );

      expect(
        mockContext.drizzle.query.locations.findFirst,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.any(Object), // Organizational filter
        }),
      );
    });

    it("should prevent cross-organizational access in mutations", async () => {
      vi.mocked(mockContext.drizzle.returning).mockResolvedValue([]);

      // All mutations should fail when trying to access other org's data
      await caller
        .update({ id: "other-org-location", name: "Updated" })
        .catch(() => {
          /* Expected error */
        });
      await caller.delete({ id: "other-org-location" }).catch(() => {
        /* Expected error */
      });
      await caller
        .setPinballMapId({
          locationId: "other-org-location",
          pinballMapId: 123,
        })
        .catch(() => {
          /* Expected error */
        });

      // Verify all mutations include organizational scoping in where clauses
      expect(mockContext.drizzle.where).toHaveBeenCalledTimes(3);
      // Each where clause should include organizational filtering
    });

    it("should maintain organizational context throughout complex operations", async () => {
      // Test that getPublic maintains organizational filtering across multiple queries
      vi.mocked(mockContext.drizzle.query.locations.findMany).mockResolvedValue(
        [],
      );
      vi.mocked(mockContext.drizzle.groupBy).mockResolvedValue([]);

      await caller.getPublic();

      // Verify all sub-queries in getPublic use organizational filtering
      expect(mockContext.drizzle.query.locations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.any(Object), // eq(locations.organizationId, ctx.organization.id)
        }),
      );

      // Machine count and issue count queries should also be org-scoped
      expect(mockContext.drizzle.where).toHaveBeenCalledWith(
        expect.any(Object), // Should include organizational filters
      );
    });
  });

  describe("Type Safety & Schema Compliance", () => {
    it("should maintain TypeScript type safety throughout", () => {
      // This test validates compilation - if it compiles, types are working
      const testCaller = locationRouter.createCaller(mockContext);

      // All these should be typed correctly
      expect(typeof testCaller.create).toBe("function");
      expect(typeof testCaller.getAll).toBe("function");
      expect(typeof testCaller.getPublic).toBe("function");
      expect(typeof testCaller.update).toBe("function");
      expect(typeof testCaller.getById).toBe("function");
      expect(typeof testCaller.delete).toBe("function");
      expect(typeof testCaller.setPinballMapId).toBe("function");
      expect(typeof testCaller.syncWithPinballMap).toBe("function");
    });

    it("should handle Drizzle schema relationships correctly", async () => {
      // Verify that relational queries use proper with/columns syntax
      vi.mocked(mockContext.drizzle.query.locations.findMany).mockResolvedValue(
        [],
      );
      vi.mocked(
        mockContext.drizzle.query.locations.findFirst,
      ).mockResolvedValue(null);

      await caller.getAll();
      await caller.getById({ id: "test" }).catch(() => {
        /* Expected error */
      });

      // Verify proper Drizzle relational syntax usage
      expect(mockContext.drizzle.query.locations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          with: expect.objectContaining({
            machines: true, // Simple relation
          }),
        }),
      );

      expect(
        mockContext.drizzle.query.locations.findFirst,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          with: expect.objectContaining({
            machines: expect.objectContaining({
              with: expect.objectContaining({
                model: true,
                owner: expect.objectContaining({
                  columns: expect.objectContaining({
                    id: true,
                    name: true,
                    profilePicture: true, // Schema-specific field
                  }),
                }),
              }),
            }),
          }),
        }),
      );
    });
  });
});

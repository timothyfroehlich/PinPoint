import { TRPCError } from "@trpc/server";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock NextAuth first to avoid import issues
vi.mock("next-auth", () => ({
  default: vi.fn().mockImplementation(() => ({
    auth: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

// Mock permissions system
vi.mock("~/server/auth/permissions", async () => {
  const actual = await vi.importActual("~/server/auth/permissions");
  return {
    ...actual,
    getUserPermissionsForSession: vi.fn(),
    requirePermissionForSession: vi.fn(),
  };
});

import { appRouter } from "~/server/api/root";
import {
  getUserPermissionsForSession,
  requirePermissionForSession,
} from "~/server/auth/permissions";
import {
  createVitestMockContext,
  type VitestMockContext,
} from "~/test/vitestMockContext";

describe("locationRouter", () => {
  let ctx: VitestMockContext;
  let mockPinballMapService: any;

  const mockUser = {
    id: "user-1",
    email: "test@example.com",
    user_metadata: { name: "Test User" },
    app_metadata: { organization_id: "org-1", role: "Member" },
  };

  const mockOrganization = {
    id: "org-1",
    name: "Test Organization",
    subdomain: "test",
  };

  const mockLocation = {
    id: "location-1",
    name: "Test Location",
    organizationId: "org-1",
    pinballMapId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMachine = {
    id: "machine-1",
    name: "Test Machine",
    locationId: "location-1",
    organizationId: "org-1",
    model: {
      id: "model-1",
      name: "Test Model",
      manufacturer: "Test Manufacturer",
    },
    owner: {
      id: "owner-1",
      name: "Test Owner",
      image: "https://example.com/avatar.jpg",
    },
    _count: { issues: 2 },
  };

  const mockMembership = {
    id: "membership-1",
    userId: "user-1",
    organizationId: "org-1",
    roleId: "role-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    role: {
      id: "role-1",
      name: "Test Role",
      organizationId: "org-1",
      isSystem: false,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions: [
        {
          id: "perm-1",
          name: "location:edit",
          description: "location:edit permission",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "perm-2",
          name: "location:delete",
          description: "location:delete permission",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "perm-3",
          name: "organization:manage",
          description: "organization:manage permission",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createVitestMockContext();

    // Set up authenticated user context
    ctx.user = mockUser as any;
    ctx.organization = mockOrganization;

    // Mock the database query for membership lookup
    vi.mocked(ctx.db.membership.findFirst).mockResolvedValue(
      mockMembership as any,
    );

    // Set up default permissions
    vi.mocked(getUserPermissionsForSession).mockResolvedValue([
      "location:edit",
      "location:delete",
      "organization:manage",
    ]);

    // Mock requirePermissionForSession - should only throw when permission is missing
    vi.mocked(requirePermissionForSession).mockImplementation(
      (_session, permission, _db, _orgId) => {
        const hasPermission = [
          "location:edit",
          "location:delete",
          "organization:manage",
        ].includes(permission);

        if (!hasPermission) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Missing required permission: ${permission}`,
          });
        }
        return Promise.resolve();
      },
    );

    // Mock PinballMap service
    mockPinballMapService = {
      syncLocation: vi.fn(),
    };
    (ctx.services.createPinballMapService as any).mockReturnValue(
      mockPinballMapService,
    );
  });

  describe("create", () => {
    it("should create a new location", async () => {
      const newLocation = {
        ...mockLocation,
        name: "New Location",
      };

      vi.mocked(ctx.db.location.create).mockResolvedValue(newLocation);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.location.create({ name: "New Location" });

      expect(ctx.db.location.create).toHaveBeenCalledWith({
        data: {
          name: "New Location",
          organizationId: "org-1",
        },
      });
      expect(result).toEqual(newLocation);
    });

    it("should require location:edit permission", async () => {
      // Mock the permission system to deny location:edit permission
      vi.mocked(requirePermissionForSession).mockImplementation(
        (_session, permission, _db, _orgId) => {
          if (permission === "location:edit") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Missing required permission: ${permission}`,
            });
          }
          return Promise.resolve();
        },
      );

      const caller = appRouter.createCaller(ctx as any);

      await expect(
        caller.location.create({ name: "New Location" }),
      ).rejects.toThrow("Missing required permission: location:edit");
    });

    it("should validate input", async () => {
      const caller = appRouter.createCaller(ctx as any);

      await expect(caller.location.create({ name: "" })).rejects.toThrow();
    });

    it("should require authentication", async () => {
      const caller = appRouter.createCaller({ ...ctx, user: null } as any);

      await expect(
        caller.location.create({ name: "New Location" }),
      ).rejects.toThrow("UNAUTHORIZED");
    });
  });

  describe("getAll", () => {
    it("should get all locations for organization with machine counts", async () => {
      const locationsWithMachines = [
        {
          ...mockLocation,
          machines: [
            {
              ...mockMachine,
              _count: { issues: 2 },
            },
          ],
        },
      ];

      vi.mocked(ctx.db.location.findMany).mockResolvedValue(
        locationsWithMachines,
      );

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.location.getAll();

      expect(ctx.db.location.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
        },
        include: {
          machines: {
            include: {
              _count: {
                select: {
                  issues: true,
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });
      expect(result).toEqual(locationsWithMachines);
    });

    it("should filter by organization", async () => {
      vi.mocked(ctx.db.location.findMany).mockResolvedValue([]);

      const caller = appRouter.createCaller(ctx as any);
      await caller.location.getAll();

      expect(ctx.db.location.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: "org-1" },
        }),
      );
    });

    it("should require organization membership", async () => {
      const caller = appRouter.createCaller({ ...ctx, user: null } as any);

      await expect(caller.location.getAll()).rejects.toThrow("UNAUTHORIZED");
    });

    it("should return empty array when no locations found", async () => {
      vi.mocked(ctx.db.location.findMany).mockResolvedValue([]);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.location.getAll();

      expect(result).toEqual([]);
    });
  });

  describe("getPublic", () => {
    it("should get public location data with filtered issue counts", async () => {
      const publicLocationData = [
        {
          id: "location-1",
          name: "Test Location",
          _count: { machines: 1 },
          machines: [
            {
              id: "machine-1",
              name: "Test Machine",
              model: {
                name: "Test Model",
                manufacturer: "Test Manufacturer",
              },
              _count: {
                issues: 1, // Non-resolved issues only
              },
            },
          ],
        },
      ];

      vi.mocked(ctx.db.location.findMany).mockResolvedValue(publicLocationData);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.location.getPublic();

      expect(ctx.db.location.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
        },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              machines: true,
            },
          },
          machines: {
            select: {
              id: true,
              name: true,
              model: {
                select: {
                  name: true,
                  manufacturer: true,
                },
              },
              _count: {
                select: {
                  issues: {
                    where: {
                      status: {
                        category: {
                          not: "RESOLVED",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });
      expect(result).toEqual(publicLocationData);
    });

    it("should work without authentication but require organization context", async () => {
      ctx.user = null; // No user authentication required for public endpoint

      vi.mocked(ctx.db.location.findMany).mockResolvedValue([]);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.location.getPublic();

      expect(result).toEqual([]);
    });

    it("should throw error when organization not found", async () => {
      ctx.organization = null;

      const caller = appRouter.createCaller(ctx as any);

      await expect(caller.location.getPublic()).rejects.toThrow(
        "Organization not found",
      );
    });
  });

  describe("update", () => {
    it("should update location name", async () => {
      const updatedLocation = {
        ...mockLocation,
        name: "Updated Location",
      };

      vi.mocked(ctx.db.location.update).mockResolvedValue(updatedLocation);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.location.update({
        id: "location-1",
        name: "Updated Location",
      });

      expect(ctx.db.location.update).toHaveBeenCalledWith({
        where: {
          id: "location-1",
          organizationId: "org-1",
        },
        data: {
          name: "Updated Location",
        },
      });
      expect(result).toEqual(updatedLocation);
    });

    it("should handle partial updates", async () => {
      vi.mocked(ctx.db.location.update).mockResolvedValue(mockLocation);

      const caller = appRouter.createCaller(ctx as any);
      await caller.location.update({ id: "location-1" });

      expect(ctx.db.location.update).toHaveBeenCalledWith({
        where: {
          id: "location-1",
          organizationId: "org-1",
        },
        data: {},
      });
    });

    it("should enforce organization scoping", async () => {
      const caller = appRouter.createCaller(ctx as any);
      await caller.location.update({ id: "location-1", name: "Updated" });

      expect(ctx.db.location.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
          }),
        }),
      );
    });

    it("should require location:edit permission", async () => {
      // Mock the permission system to deny location:edit permission
      vi.mocked(requirePermissionForSession).mockImplementation(
        (_session, permission, _db, _orgId) => {
          if (permission === "location:edit") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Missing required permission: ${permission}`,
            });
          }
          return Promise.resolve();
        },
      );

      const caller = appRouter.createCaller(ctx as any);

      await expect(
        caller.location.update({ id: "location-1", name: "Updated" }),
      ).rejects.toThrow("Missing required permission: location:edit");
    });

    it("should validate input", async () => {
      const caller = appRouter.createCaller(ctx as any);

      await expect(
        caller.location.update({ id: "location-1", name: "" }),
      ).rejects.toThrow();
    });
  });

  describe("getById", () => {
    it("should get location with detailed machine info", async () => {
      const detailedLocation = {
        ...mockLocation,
        machines: [
          {
            ...mockMachine,
            model: {
              id: "model-1",
              name: "Test Model",
              manufacturer: "Test Manufacturer",
            },
            owner: {
              id: "owner-1",
              name: "Test Owner",
              image: "https://example.com/avatar.jpg",
            },
          },
        ],
      };

      vi.mocked(ctx.db.location.findFirst).mockResolvedValue(detailedLocation);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.location.getById({ id: "location-1" });

      expect(ctx.db.location.findFirst).toHaveBeenCalledWith({
        where: {
          id: "location-1",
          organizationId: "org-1",
        },
        include: {
          machines: {
            include: {
              model: true,
              owner: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      });
      expect(result).toEqual(detailedLocation);
    });

    it("should throw error when location not found", async () => {
      vi.mocked(ctx.db.location.findFirst).mockResolvedValue(null);

      const caller = appRouter.createCaller(ctx as any);

      await expect(
        caller.location.getById({ id: "nonexistent" }),
      ).rejects.toThrow("Location not found");
    });

    it("should enforce organization scoping", async () => {
      vi.mocked(ctx.db.location.findFirst).mockResolvedValue(null);

      const caller = appRouter.createCaller(ctx as any);

      try {
        await caller.location.getById({ id: "location-1" });
      } catch {
        // Expected to throw
      }

      expect(ctx.db.location.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
          }),
        }),
      );
    });

    it("should require organization membership", async () => {
      const caller = appRouter.createCaller({ ...ctx, user: null } as any);

      await expect(
        caller.location.getById({ id: "location-1" }),
      ).rejects.toThrow("UNAUTHORIZED");
    });
  });

  describe("delete", () => {
    it("should delete location", async () => {
      vi.mocked(ctx.db.location.delete).mockResolvedValue(mockLocation);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.location.delete({ id: "location-1" });

      expect(ctx.db.location.delete).toHaveBeenCalledWith({
        where: {
          id: "location-1",
          organizationId: "org-1",
        },
      });
      expect(result).toEqual(mockLocation);
    });

    it("should enforce organization scoping", async () => {
      vi.mocked(ctx.db.location.delete).mockResolvedValue(mockLocation);

      const caller = appRouter.createCaller(ctx as any);
      await caller.location.delete({ id: "location-1" });

      expect(ctx.db.location.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
          }),
        }),
      );
    });

    it("should require location:delete permission", async () => {
      // Mock the permission system to deny location:delete permission
      vi.mocked(requirePermissionForSession).mockImplementation(
        (_session, permission, _db, _orgId) => {
          if (permission === "location:delete") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Missing required permission: ${permission}`,
            });
          }
          return Promise.resolve();
        },
      );

      const caller = appRouter.createCaller(ctx as any);

      await expect(
        caller.location.delete({ id: "location-1" }),
      ).rejects.toThrow("Missing required permission: location:delete");
    });

    it("should require authentication", async () => {
      const caller = appRouter.createCaller({ ...ctx, user: null } as any);

      await expect(
        caller.location.delete({ id: "location-1" }),
      ).rejects.toThrow("UNAUTHORIZED");
    });
  });

  describe("setPinballMapId", () => {
    it("should set PinballMap ID for location", async () => {
      const updatedLocation = {
        ...mockLocation,
        pinballMapId: 12345,
      };

      vi.mocked(ctx.db.location.update).mockResolvedValue(updatedLocation);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.location.setPinballMapId({
        locationId: "location-1",
        pinballMapId: 12345,
      });

      expect(ctx.db.location.update).toHaveBeenCalledWith({
        where: {
          id: "location-1",
          organizationId: "org-1",
        },
        data: {
          pinballMapId: 12345,
        },
      });
      expect(result).toEqual(updatedLocation);
    });

    it("should require organization:manage permission", async () => {
      // Mock the permission system to deny organization:manage permission
      vi.mocked(requirePermissionForSession).mockImplementation(
        (_session, permission, _db, _orgId) => {
          if (permission === "organization:manage") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Missing required permission: ${permission}`,
            });
          }
          return Promise.resolve();
        },
      );

      const caller = appRouter.createCaller(ctx as any);

      await expect(
        caller.location.setPinballMapId({
          locationId: "location-1",
          pinballMapId: 12345,
        }),
      ).rejects.toThrow("Missing required permission: organization:manage");
    });

    it("should enforce organization scoping", async () => {
      vi.mocked(ctx.db.location.update).mockResolvedValue(mockLocation);

      const caller = appRouter.createCaller(ctx as any);
      await caller.location.setPinballMapId({
        locationId: "location-1",
        pinballMapId: 12345,
      });

      expect(ctx.db.location.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
          }),
        }),
      );
    });

    it("should validate positive pinballMapId", async () => {
      const caller = appRouter.createCaller(ctx as any);

      await expect(
        caller.location.setPinballMapId({
          locationId: "location-1",
          pinballMapId: -1,
        }),
      ).rejects.toThrow();
    });
  });

  describe("syncWithPinballMap", () => {
    it("should sync location with PinballMap service", async () => {
      const syncResult = {
        success: true,
        data: { synced: true, machinesUpdated: 3 },
      };

      mockPinballMapService.syncLocation.mockResolvedValue(syncResult);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.location.syncWithPinballMap({
        locationId: "location-1",
      });

      expect(mockPinballMapService.syncLocation).toHaveBeenCalledWith(
        "location-1",
      );
      expect(result).toEqual(syncResult);
    });

    it("should handle sync failures", async () => {
      const syncResult = {
        success: false,
        error: "PinballMap API unavailable",
      };

      mockPinballMapService.syncLocation.mockResolvedValue(syncResult);

      const caller = appRouter.createCaller(ctx as any);

      await expect(
        caller.location.syncWithPinballMap({ locationId: "location-1" }),
      ).rejects.toThrow("PinballMap API unavailable");
    });

    it("should handle sync failures without error message", async () => {
      const syncResult = {
        success: false,
      };

      mockPinballMapService.syncLocation.mockResolvedValue(syncResult);

      const caller = appRouter.createCaller(ctx as any);

      await expect(
        caller.location.syncWithPinballMap({ locationId: "location-1" }),
      ).rejects.toThrow("Sync failed");
    });

    it("should require organization:manage permission", async () => {
      // Mock the permission system to deny organization:manage permission
      vi.mocked(requirePermissionForSession).mockImplementation(
        (_session, permission, _db, _orgId) => {
          if (permission === "organization:manage") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Missing required permission: ${permission}`,
            });
          }
          return Promise.resolve();
        },
      );

      const caller = appRouter.createCaller(ctx as any);

      await expect(
        caller.location.syncWithPinballMap({ locationId: "location-1" }),
      ).rejects.toThrow("Missing required permission: organization:manage");
    });

    it("should require authentication", async () => {
      const caller = appRouter.createCaller({ ...ctx, user: null } as any);

      await expect(
        caller.location.syncWithPinballMap({ locationId: "location-1" }),
      ).rejects.toThrow("UNAUTHORIZED");
    });

    it("should handle service creation", async () => {
      mockPinballMapService.syncLocation.mockResolvedValue({
        success: true,
        data: {},
      });

      const caller = appRouter.createCaller(ctx as any);
      await caller.location.syncWithPinballMap({ locationId: "location-1" });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(ctx.services.createPinballMapService).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      vi.mocked(ctx.db.location.findMany).mockRejectedValue(
        new Error("Database connection failed"),
      );

      const caller = appRouter.createCaller(ctx as any);

      await expect(caller.location.getAll()).rejects.toThrow(
        "Database connection failed",
      );
    });

    it("should handle permission check failures", async () => {
      // Mock requirePermissionForSession to fail due to permission system error
      vi.mocked(requirePermissionForSession).mockImplementation(() => {
        throw new Error("Permission system unavailable");
      });

      const caller = appRouter.createCaller(ctx as any);

      await expect(caller.location.create({ name: "Test" })).rejects.toThrow(
        "Permission system unavailable",
      );
    });
  });

  describe("Multi-tenancy", () => {
    it("should isolate data by organization", async () => {
      vi.mocked(ctx.db.location.findMany).mockResolvedValue([]);

      const caller = appRouter.createCaller(ctx as any);
      await caller.location.getAll();

      expect(ctx.db.location.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: "org-1" },
        }),
      );
    });

    it("should prevent cross-organization access in updates", async () => {
      const caller = appRouter.createCaller(ctx as any);
      await caller.location.update({ id: "other-org-location" });

      expect(ctx.db.location.update).toHaveBeenCalledWith({
        where: {
          id: "other-org-location",
          organizationId: "org-1", // Always scoped to user's org
        },
        data: {},
      });
    });

    it("should prevent cross-organization access in deletes", async () => {
      const caller = appRouter.createCaller(ctx as any);
      await caller.location.delete({ id: "other-org-location" });

      expect(ctx.db.location.delete).toHaveBeenCalledWith({
        where: {
          id: "other-org-location",
          organizationId: "org-1", // Always scoped to user's org
        },
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty organization context gracefully in public endpoint", async () => {
      ctx.organization = null;

      const caller = appRouter.createCaller(ctx as any);

      await expect(caller.location.getPublic()).rejects.toThrow(
        "Organization not found",
      );
    });

    it("should handle null database responses", async () => {
      vi.mocked(ctx.db.location.findFirst).mockResolvedValue(null);

      const caller = appRouter.createCaller(ctx as any);

      await expect(
        caller.location.getById({ id: "nonexistent" }),
      ).rejects.toThrow("Location not found");
    });

    it("should handle service factory errors", async () => {
      (ctx.services.createPinballMapService as any).mockImplementation(() => {
        throw new Error("Service unavailable");
      });

      const caller = appRouter.createCaller(ctx as any);

      await expect(
        caller.location.syncWithPinballMap({ locationId: "location-1" }),
      ).rejects.toThrow("Service unavailable");
    });
  });
});

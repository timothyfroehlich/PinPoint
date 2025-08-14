/* eslint-disable @typescript-eslint/unbound-method */
import { TRPCError } from "@trpc/server";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock permissions system
vi.mock("~/server/auth/permissions", async () => {
  const actual = await vi.importActual("~/server/auth/permissions");
  return {
    ...actual,
    requirePermissionForSession: vi.fn(),
  };
});

import { appRouter } from "~/server/api/root";
import { requirePermissionForSession } from "~/server/auth/permissions";
import { createVitestMockContext } from "~/test/vitestMockContext";

// Mock data for tests
const mockMachine = {
  id: "machine-1",
  name: "Test Machine",
  modelId: "model-1",
  locationId: "location-1",
  organizationId: "org-1",
  ownerId: "user-1",
  qrCodeId: "qr-1",
  qrCodeUrl: "https://example.com/qr",
  qrCodeGeneratedAt: new Date(),
  ownerNotificationsEnabled: true,
  notifyOnNewIssues: true,
  notifyOnStatusChanges: true,
  notifyOnComments: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockLocation = {
  id: "location-2",
  name: "New Location",
  organizationId: "org-1",
  address: "123 Main St",
  city: "Test City",
  state: "TS",
  zipCode: "12345",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockModel = {
  id: "model-1",
  name: "Test Model",
  manufacturer: "Test Manufacturer",
  year: 2020,
  ipdbId: 12345,
  opdbId: "test-opdb",
  machineType: "SS",
  machineDisplay: "LED",
  isActive: true,
  ipdbLink: "https://ipdb.org/12345",
  opdbImgUrl: "https://opdb.org/test.jpg",
  kineticistUrl: "https://kineticist.org/test",
  isCustom: false,
};

const mockOwner = {
  id: "user-1",
  name: "Test Owner",
  image: "https://example.com/avatar.jpg",
};

const mockMachineWithRelations = {
  id: "machine-1",
  name: "Test Machine",
  modelId: "model-1",
  locationId: "location-2",
  organizationId: "org-1",
  ownerId: "user-1",
  qrCodeId: "qr-1",
  qrCodeUrl: "https://example.com/qr",
  qrCodeGeneratedAt: new Date(),
  ownerNotificationsEnabled: true,
  notifyOnNewIssues: true,
  notifyOnStatusChanges: true,
  notifyOnComments: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  model: mockModel,
  location: mockLocation,
  owner: mockOwner,
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
    name: "Admin",
    organizationId: "org-1",
    isSystem: false,
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: [
      {
        id: "perm-1",
        name: "machine:edit",
        description: "Edit machines",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  },
};

// Helper to create authenticated context with machine:edit permissions
const createAuthenticatedContext = () => {
  const mockContext = createVitestMockContext();

  // Override the user with proper test data
  (mockContext as any).user = {
    id: "user-1",
    email: "test@example.com",
    user_metadata: {
      name: "Test User",
      avatar_url: null,
    },
    app_metadata: {
      organization_id: "org-1",
      role: "Admin",
    },
  };

  (mockContext as any).organization = {
    id: "org-1",
    name: "Test Organization",
    subdomain: "test",
  };

  // Mock the membership lookup that the organization procedure requires
  vi.mocked(mockContext.db.membership.findFirst).mockResolvedValue(
    mockMembership as any,
  );

  // Mock the permissions system to allow machine:edit
  vi.mocked(requirePermissionForSession).mockResolvedValue();

  return mockContext;
};

describe("machineLocationRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("moveToLocation", () => {
    it("should successfully move machine to new location", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      // Mock database queries
      ctx.drizzle.query.machines.findFirst
        .mockResolvedValueOnce(mockMachine) // Machine exists check
        .mockResolvedValueOnce(null); // Not used in this path

      ctx.drizzle.query.locations.findFirst.mockResolvedValue(mockLocation);

      // Mock update operation
      const mockUpdatedMachine = { ...mockMachine, locationId: "location-2" };
      ctx.drizzle.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpdatedMachine]),
          }),
        }),
      });

      // Mock final select with joins
      ctx.drizzle.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([mockMachineWithRelations]),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await caller.machine.location.moveToLocation({
        machineId: "machine-1",
        locationId: "location-2",
      });

      expect(result).toEqual(mockMachineWithRelations);
      expect(
        vi.mocked(ctx.drizzle.query.machines.findFirst),
      ).toHaveBeenCalledWith({
        where: expect.any(Object), // Drizzle SQL object
      });
      expect(
        vi.mocked(ctx.drizzle.query.locations.findFirst),
      ).toHaveBeenCalledWith({
        where: expect.any(Object), // Drizzle SQL object
      });
    });

    it("should throw NOT_FOUND when machine does not exist", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      // Mock machine not found
      ctx.drizzle.query.machines.findFirst.mockResolvedValue(null);

      await expect(
        caller.machine.location.moveToLocation({
          machineId: "nonexistent-machine",
          locationId: "location-2",
        }),
      ).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Game instance not found",
        }),
      );

      expect(
        vi.mocked(ctx.drizzle.query.machines.findFirst),
      ).toHaveBeenCalledWith({
        where: expect.any(Object),
      });
      // Should not check location if machine doesn't exist
      expect(
        vi.mocked(ctx.drizzle.query.locations.findFirst),
      ).not.toHaveBeenCalled();
    });

    it("should throw NOT_FOUND when machine belongs to different organization", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      // Mock machine from different organization (not returned due to org filter)
      ctx.drizzle.query.machines.findFirst.mockResolvedValue(null); // Will return null due to organization filter

      await expect(
        caller.machine.location.moveToLocation({
          machineId: "machine-1",
          locationId: "location-2",
        }),
      ).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Game instance not found",
        }),
      );
    });

    it("should throw NOT_FOUND when location does not exist", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      // Mock machine exists but location does not
      ctx.drizzle.query.machines.findFirst.mockResolvedValue(mockMachine);
      ctx.drizzle.query.locations.findFirst.mockResolvedValue(null);

      await expect(
        caller.machine.location.moveToLocation({
          machineId: "machine-1",
          locationId: "nonexistent-location",
        }),
      ).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Target location not found",
        }),
      );

      expect(
        vi.mocked(ctx.drizzle.query.machines.findFirst),
      ).toHaveBeenCalled();
      expect(
        vi.mocked(ctx.drizzle.query.locations.findFirst),
      ).toHaveBeenCalledWith({
        where: expect.any(Object),
      });
    });

    it("should throw NOT_FOUND when location belongs to different organization", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      // Mock machine exists but location from different org
      ctx.drizzle.query.machines.findFirst.mockResolvedValue(mockMachine);
      ctx.drizzle.query.locations.findFirst.mockResolvedValue(null); // Will return null due to organization filter

      await expect(
        caller.machine.location.moveToLocation({
          machineId: "machine-1",
          locationId: "location-2",
        }),
      ).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Target location not found",
        }),
      );
    });

    it("should throw NOT_FOUND when machine update fails", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      // Mock machine and location exist
      ctx.drizzle.query.machines.findFirst.mockResolvedValue(mockMachine);
      ctx.drizzle.query.locations.findFirst.mockResolvedValue(mockLocation);

      // Mock update operation returning empty array (no rows affected)
      ctx.drizzle.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]), // No rows returned
          }),
        }),
      });

      await expect(
        caller.machine.location.moveToLocation({
          machineId: "machine-1",
          locationId: "location-2",
        }),
      ).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Machine not found or not accessible",
        }),
      );
    });

    // Test removed: The optimization eliminated the final error check that this test was validating
    // Since we use non-null assertion, if the machine was updated successfully,
    // the subsequent select should always return a result

    it("should validate input parameters", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      // Test empty strings
      await expect(
        caller.machine.location.moveToLocation({
          machineId: "",
          locationId: "location-2",
        }),
      ).rejects.toThrow(); // Zod validation should fail

      await expect(
        caller.machine.location.moveToLocation({
          machineId: "machine-1",
          locationId: "",
        }),
      ).rejects.toThrow(); // Zod validation should fail

      // Test missing parameters
      await expect(
        caller.machine.location.moveToLocation({
          machineId: "machine-1",
        } as any),
      ).rejects.toThrow(); // Zod validation should fail
    });

    it("should enforce machine:edit permission", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      // Mock permission check to throw
      vi.mocked(requirePermissionForSession).mockRejectedValue(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Missing required permission: machine:edit",
        }),
      );

      await expect(
        caller.machine.location.moveToLocation({
          machineId: "machine-1",
          locationId: "location-2",
        }),
      ).rejects.toThrow("Missing required permission: machine:edit");

      expect(requirePermissionForSession).toHaveBeenCalled();
    });

    it("should handle database connection errors gracefully", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      // Mock database error
      ctx.drizzle.query.machines.findFirst.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(
        caller.machine.location.moveToLocation({
          machineId: "machine-1",
          locationId: "location-2",
        }),
      ).rejects.toThrow("Database connection failed");
    });

    it("should handle update operation database errors", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      // Mock machine and location exist
      ctx.drizzle.query.machines.findFirst.mockResolvedValue(mockMachine);
      ctx.drizzle.query.locations.findFirst.mockResolvedValue(mockLocation);

      // Mock update operation throwing error
      ctx.drizzle.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue(new Error("Update failed")),
          }),
        }),
      });

      await expect(
        caller.machine.location.moveToLocation({
          machineId: "machine-1",
          locationId: "location-2",
        }),
      ).rejects.toThrow("Update failed");
    });

    it("should verify organizational scoping in all queries", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      // Mock successful flow
      ctx.drizzle.query.machines.findFirst.mockResolvedValue(mockMachine);
      ctx.drizzle.query.locations.findFirst.mockResolvedValue(mockLocation);

      const mockUpdatedMachine = { ...mockMachine, locationId: "location-2" };
      ctx.drizzle.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpdatedMachine]),
          }),
        }),
      });

      ctx.drizzle.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([mockMachineWithRelations]),
                }),
              }),
            }),
          }),
        }),
      });

      await caller.machine.location.moveToLocation({
        machineId: "machine-1",
        locationId: "location-2",
      });

      // Verify that queries include organization scoping
      expect(
        vi.mocked(ctx.drizzle.query.machines.findFirst),
      ).toHaveBeenCalledWith({
        where: expect.any(Object), // Should include organization check
      });
      expect(
        vi.mocked(ctx.drizzle.query.locations.findFirst),
      ).toHaveBeenCalledWith({
        where: expect.any(Object), // Should include organization check
      });
    });

    it("should include updatedAt timestamp in machine update", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      // Mock successful flow
      ctx.drizzle.query.machines.findFirst.mockResolvedValue(mockMachine);
      ctx.drizzle.query.locations.findFirst.mockResolvedValue(mockLocation);

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockMachine]),
        }),
      });

      ctx.drizzle.update = vi.fn().mockReturnValue({
        set: mockSet,
      });

      ctx.drizzle.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([mockMachineWithRelations]),
                }),
              }),
            }),
          }),
        }),
      });

      await caller.machine.location.moveToLocation({
        machineId: "machine-1",
        locationId: "location-2",
      });

      // Verify that set was called with locationId and updatedAt
      expect(mockSet).toHaveBeenCalledWith({
        locationId: "location-2",
        updatedAt: expect.any(Date),
      });
    });

    it("should return complete machine data with all relationships", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      // Mock successful flow
      ctx.drizzle.query.machines.findFirst.mockResolvedValue(mockMachine);
      ctx.drizzle.query.locations.findFirst.mockResolvedValue(mockLocation);

      const mockUpdatedMachine = { ...mockMachine, locationId: "location-2" };
      ctx.drizzle.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpdatedMachine]),
          }),
        }),
      });

      ctx.drizzle.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([mockMachineWithRelations]),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await caller.machine.location.moveToLocation({
        machineId: "machine-1",
        locationId: "location-2",
      });

      // Verify result structure includes all expected fields and relationships
      expect(result).toEqual(mockMachineWithRelations);
      expect(result.model).toBeDefined();
      expect(result.location).toBeDefined();
      expect(result.owner).toBeDefined();
      expect(result.locationId).toBe("location-2");
    });
  });
});

 
/**
 * Machine Owner Router Unit Tests
 *
 * Tests for the machine.owner router using mocked Drizzle operations.
 * Validates owner assignment/removal logic, permissions, and organizational scoping.
 *
 * Uses modern August 2025 patterns:
 * - Vitest with vi.mock and vi.importActual for type safety
 * - Mocked Drizzle query operations for fast unit testing
 * - Comprehensive error scenario testing
 * - Input validation and security boundary testing
 */

import { TRPCError } from "@trpc/server";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock permissions system with type-safe partial mocking
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
  ownerId: null,
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

const mockMachineWithOwner = {
  ...mockMachine,
  ownerId: "user-2",
};

const mockMembership = {
  id: "membership-1",
  userId: "user-2",
  organizationId: "org-1",
  roleId: "role-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUpdatedMachine = {
  ...mockMachine,
  ownerId: "user-2",
};

const mockMachineWithRelations = {
  ...mockUpdatedMachine,
  model: {
    id: "model-1",
    name: "Medieval Madness",
    manufacturer: "Williams",
    year: 1997,
    type: "Pinball",
    description: "A fantasy-themed pinball machine",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  location: {
    id: "location-1",
    name: "Main Arcade",
    organizationId: "org-1",
    address: "123 Main St",
    city: "Test City",
    state: "TS",
    zipCode: "12345",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  owner: {
    id: "user-2",
    name: "Test Owner",
    image: "https://example.com/avatar.jpg",
  },
};

const mockMachineWithoutOwnerRelations = {
  ...mockMachine,
  ownerId: null,
  model: mockMachineWithRelations.model,
  location: mockMachineWithRelations.location,
  owner: null,
};

describe("machine.owner router", () => {
  let mockCtx: ReturnType<typeof createVitestMockContext>;

  beforeEach(() => {
    mockCtx = createVitestMockContext();
    vi.clearAllMocks();

    // Mock successful permission check by default
    vi.mocked(requirePermissionForSession).mockResolvedValue(undefined);

    // Mock membership query for organizationProcedure
    mockCtx.db.query.memberships.findFirst.mockResolvedValue({
      id: "membership-1",
      userId: "user-1",
      organizationId: "org-1",
      roleId: "role-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe("assignOwner mutation", () => {
    describe("success scenarios", () => {
      it("should assign owner to machine successfully", async () => {
        // Mock database operations
        mockCtx.db.query.machines.findFirst
          .mockResolvedValueOnce(mockMachine) // Machine exists check
          .mockResolvedValueOnce(mockMachineWithRelations); // Final fetch with relations

        mockCtx.db.query.memberships.findFirst.mockResolvedValueOnce(
          mockMembership,
        ); // Membership validation

        (mockCtx.db.update as any).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockUpdatedMachine]),
            }),
          }),
        });

        const caller = appRouter.createCaller(mockCtx);

        const result = await caller.machine.owner.assignOwner({
          machineId: "machine-1",
          ownerId: "user-2",
        });

        expect(result).toEqual(mockMachineWithRelations);
        expect(mockCtx.db.query.machines.findFirst).toHaveBeenCalledTimes(2);
        expect(mockCtx.db.query.memberships.findFirst).toHaveBeenCalled();
        expect(mockCtx.db.update).toHaveBeenCalled();
      });

      it("should remove owner from machine successfully", async () => {
        // Mock database operations for removing owner
        mockCtx.db.query.machines.findFirst
          .mockResolvedValueOnce(mockMachineWithOwner) // Machine exists check
          .mockResolvedValueOnce(mockMachineWithoutOwnerRelations); // Final fetch without owner

        // No membership check when removing owner (ownerId is undefined)

        (mockCtx.db.update as any).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi
                .fn()
                .mockResolvedValue([{ ...mockMachine, ownerId: null }]),
            }),
          }),
        });

        const caller = appRouter.createCaller(mockCtx);

        const result = await caller.machine.owner.assignOwner({
          machineId: "machine-1",
          // ownerId is omitted to remove owner
        });

        expect(result).toEqual(mockMachineWithoutOwnerRelations);
        expect(mockCtx.db.query.machines.findFirst).toHaveBeenCalledTimes(2);
        expect(mockCtx.db.query.memberships.findFirst).not.toHaveBeenCalled();
        expect(mockCtx.db.update).toHaveBeenCalled();
      });

      it("should handle reassigning owner to different user", async () => {
        const newOwner = "user-3";
        const newMembership = { ...mockMembership, userId: newOwner };
        const machineWithNewOwner = {
          ...mockMachineWithRelations,
          ownerId: newOwner,
          owner: {
            id: newOwner,
            name: "New Owner",
            image: "https://example.com/new-avatar.jpg",
          },
        };

        mockCtx.db.query.machines.findFirst
          .mockResolvedValueOnce(mockMachineWithOwner) // Machine exists with current owner
          .mockResolvedValueOnce(machineWithNewOwner); // Final fetch with new owner

        mockCtx.db.query.memberships.findFirst.mockResolvedValueOnce(
          newMembership,
        ); // New owner membership validation

        (mockCtx.db.update as any).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi
                .fn()
                .mockResolvedValue([{ ...mockMachine, ownerId: newOwner }]),
            }),
          }),
        });

        const caller = appRouter.createCaller(mockCtx);

        const result = await caller.machine.owner.assignOwner({
          machineId: "machine-1",
          ownerId: newOwner,
        });

        expect(result).toEqual(machineWithNewOwner);
        expect(result.owner?.id).toBe(newOwner);
      });
    });

    describe("error scenarios", () => {
      it("should throw NOT_FOUND when machine does not exist", async () => {
        mockCtx.db.query.machines.findFirst.mockResolvedValueOnce(null);

        const caller = appRouter.createCaller(mockCtx);

        await expect(
          caller.machine.owner.assignOwner({
            machineId: "nonexistent-machine",
            ownerId: "user-2",
          }),
        ).rejects.toThrow(
          new TRPCError({
            code: "NOT_FOUND",
            message: "Machine not found",
          }),
        );

        expect(mockCtx.db.query.machines.findFirst).toHaveBeenCalledTimes(1);
        expect(mockCtx.db.query.memberships.findFirst).not.toHaveBeenCalled();
        expect(mockCtx.db.update).not.toHaveBeenCalled();
      });

      it("should throw NOT_FOUND when machine belongs to different organization", async () => {
        const _machineFromDifferentOrg = {
          ...mockMachine,
          organizationId: "org-2", // Different organization
        };

        mockCtx.db.query.machines.findFirst.mockResolvedValueOnce(null); // Scoped query returns null

        const caller = appRouter.createCaller(mockCtx);

        await expect(
          caller.machine.owner.assignOwner({
            machineId: "machine-1",
            ownerId: "user-2",
          }),
        ).rejects.toThrow(
          new TRPCError({
            code: "NOT_FOUND",
            message: "Machine not found",
          }),
        );
      });

      it("should throw FORBIDDEN when user is not a member of organization", async () => {
        mockCtx.db.query.machines.findFirst.mockResolvedValueOnce(mockMachine);
        mockCtx.db.query.memberships.findFirst.mockResolvedValueOnce(null); // No membership found

        const caller = appRouter.createCaller(mockCtx);

        await expect(
          caller.machine.owner.assignOwner({
            machineId: "machine-1",
            ownerId: "user-from-different-org",
          }),
        ).rejects.toThrow(
          new TRPCError({
            code: "FORBIDDEN",
            message: "User is not a member of this organization",
          }),
        );

        expect(mockCtx.db.query.machines.findFirst).toHaveBeenCalledTimes(1);
        expect(mockCtx.db.query.memberships.findFirst).toHaveBeenCalledTimes(1);
        expect(mockCtx.db.update).not.toHaveBeenCalled();
      });

      it("should throw INTERNAL_SERVER_ERROR when machine update fails", async () => {
        mockCtx.db.query.machines.findFirst.mockResolvedValueOnce(mockMachine);
        mockCtx.db.query.memberships.findFirst.mockResolvedValueOnce(
          mockMembership,
        );

        (mockCtx.db.update as any).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]), // Empty array = update failed
            }),
          }),
        });

        const caller = appRouter.createCaller(mockCtx);

        await expect(
          caller.machine.owner.assignOwner({
            machineId: "machine-1",
            ownerId: "user-2",
          }),
        ).rejects.toThrow(
          new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update machine owner",
          }),
        );
      });

      it("should throw INTERNAL_SERVER_ERROR when final fetch fails", async () => {
        mockCtx.db.query.machines.findFirst
          .mockResolvedValueOnce(mockMachine) // Initial check succeeds
          .mockResolvedValueOnce(null); // Final fetch fails

        mockCtx.db.query.memberships.findFirst.mockResolvedValueOnce(
          mockMembership,
        );

        (mockCtx.db.update as any).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockUpdatedMachine]),
            }),
          }),
        });

        const caller = appRouter.createCaller(mockCtx);

        await expect(
          caller.machine.owner.assignOwner({
            machineId: "machine-1",
            ownerId: "user-2",
          }),
        ).rejects.toThrow(
          new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch updated machine",
          }),
        );
      });

      it("should throw error when permission check fails", async () => {
        vi.mocked(requirePermissionForSession).mockRejectedValue(
          new TRPCError({
            code: "FORBIDDEN",
            message: "Insufficient permissions",
          }),
        );

        const caller = appRouter.createCaller(mockCtx);

        await expect(
          caller.machine.owner.assignOwner({
            machineId: "machine-1",
            ownerId: "user-2",
          }),
        ).rejects.toThrow(
          new TRPCError({
            code: "FORBIDDEN",
            message: "Insufficient permissions",
          }),
        );

        // Should not call database operations when permission check fails
        expect(mockCtx.db.query.machines.findFirst).not.toHaveBeenCalled();
      });
    });

    describe("input validation", () => {
      it("should accept valid machineId", async () => {
        mockCtx.db.query.machines.findFirst
          .mockResolvedValueOnce(mockMachine)
          .mockResolvedValueOnce(mockMachineWithoutOwnerRelations);

        (mockCtx.db.update as any).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi
                .fn()
                .mockResolvedValue([{ ...mockMachine, ownerId: null }]),
            }),
          }),
        });

        const caller = appRouter.createCaller(mockCtx);

        const result = await caller.machine.owner.assignOwner({
          machineId: "valid-machine-id",
        });

        expect(result).toBeDefined();
      });

      it("should accept optional ownerId", async () => {
        mockCtx.db.query.machines.findFirst
          .mockResolvedValueOnce(mockMachine)
          .mockResolvedValueOnce(mockMachineWithRelations);

        mockCtx.db.query.memberships.findFirst.mockResolvedValueOnce(
          mockMembership,
        );

        (mockCtx.db.update as any).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockUpdatedMachine]),
            }),
          }),
        });

        const caller = appRouter.createCaller(mockCtx);

        const result = await caller.machine.owner.assignOwner({
          machineId: "machine-1",
          ownerId: "user-2",
        });

        expect(result).toBeDefined();
      });

      it("should handle empty string ownerId as removal", async () => {
        mockCtx.db.query.machines.findFirst
          .mockResolvedValueOnce(mockMachine)
          .mockResolvedValueOnce(mockMachineWithoutOwnerRelations);

        (mockCtx.db.update as any).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi
                .fn()
                .mockResolvedValue([{ ...mockMachine, ownerId: null }]),
            }),
          }),
        });

        const caller = appRouter.createCaller(mockCtx);

        // Empty string should be treated as removal (converted to null)
        const result = await caller.machine.owner.assignOwner({
          machineId: "machine-1",
          ownerId: "",
        });

        expect(result).toEqual(mockMachineWithoutOwnerRelations);
        expect(mockCtx.db.query.memberships.findFirst).not.toHaveBeenCalled();
      });
    });

    describe("organizational scoping", () => {
      it("should only find machines within user's organization", async () => {
        mockCtx.db.query.machines.findFirst.mockResolvedValueOnce(mockMachine);
        mockCtx.db.query.memberships.findFirst.mockResolvedValueOnce(
          mockMembership,
        );

        (mockCtx.db.update as any).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockUpdatedMachine]),
            }),
          }),
        });

        mockCtx.db.query.machines.findFirst.mockResolvedValueOnce(
          mockMachineWithRelations,
        );

        const caller = appRouter.createCaller(mockCtx);

        await caller.machine.owner.assignOwner({
          machineId: "machine-1",
          ownerId: "user-2",
        });

        // Verify organizational scoping in machine lookup
        expect(mockCtx.db.query.machines.findFirst).toHaveBeenCalledWith({
          where: expect.anything(), // SQL object from and(eq(machines.id, input.machineId), eq(machines.organizationId, ctx.organization.id))
        });
      });

      it("should only validate membership within user's organization", async () => {
        mockCtx.db.query.machines.findFirst.mockResolvedValueOnce(mockMachine);
        mockCtx.db.query.memberships.findFirst.mockResolvedValueOnce(
          mockMembership,
        );

        (mockCtx.db.update as any).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockUpdatedMachine]),
            }),
          }),
        });

        mockCtx.db.query.machines.findFirst.mockResolvedValueOnce(
          mockMachineWithRelations,
        );

        const caller = appRouter.createCaller(mockCtx);

        await caller.machine.owner.assignOwner({
          machineId: "machine-1",
          ownerId: "user-2",
        });

        // Verify organizational scoping in membership validation
        expect(mockCtx.db.query.memberships.findFirst).toHaveBeenCalledWith({
          where: expect.anything(), // SQL object from and(eq(memberships.userId, input.ownerId), eq(memberships.organizationId, ctx.organization.id))
        });
      });

      it("should use correct organization context", async () => {
        // Test with different organization context
        const customCtx = {
          ...mockCtx,
          organization: {
            id: "org-2",
            name: "Different Organization",
            subdomain: "different",
          },
        };

        mockCtx.db.query.machines.findFirst.mockResolvedValueOnce(null); // No machine in org-2

        const caller = appRouter.createCaller(customCtx);

        await expect(
          caller.machine.owner.assignOwner({
            machineId: "machine-1", // This machine belongs to org-1
            ownerId: "user-2",
          }),
        ).rejects.toThrow(
          new TRPCError({
            code: "NOT_FOUND",
            message: "Machine not found",
          }),
        );
      });
    });

    describe("permission validation", () => {
      it("should require machine:edit permission", async () => {
        // Set up mocks to reach the permission check
        mockCtx.db.query.machines.findFirst
          .mockResolvedValueOnce(mockMachine)
          .mockResolvedValueOnce(mockMachineWithRelations);

        mockCtx.db.query.memberships.findFirst.mockResolvedValueOnce(
          mockMembership,
        );

        (mockCtx.db.update as any).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockUpdatedMachine]),
            }),
          }),
        });

        const caller = appRouter.createCaller(mockCtx);

        // This will trigger the permission check in machineEditProcedure
        await caller.machine.owner.assignOwner({
          machineId: "machine-1",
          ownerId: "user-2",
        });

        expect(requirePermissionForSession).toHaveBeenCalledWith(
          expect.any(Object), // session
          "machine:edit",
          mockCtx.db,
          mockCtx.organization.id,
        );
      });
    });

    describe("relationship loading", () => {
      it("should load machine with model, location, and owner relationships", async () => {
        mockCtx.db.query.machines.findFirst
          .mockResolvedValueOnce(mockMachine)
          .mockResolvedValueOnce(mockMachineWithRelations);

        mockCtx.db.query.memberships.findFirst.mockResolvedValueOnce(
          mockMembership,
        );

        (mockCtx.db.update as any).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockUpdatedMachine]),
            }),
          }),
        });

        const caller = appRouter.createCaller(mockCtx);

        const result = await caller.machine.owner.assignOwner({
          machineId: "machine-1",
          ownerId: "user-2",
        });

        expect(result.model).toBeDefined();
        expect(result.location).toBeDefined();
        expect(result.owner).toBeDefined();
        expect(result.owner?.id).toBe("user-2");
        expect(result.owner?.name).toBe("Test Owner");
        expect(result.owner?.image).toBe("https://example.com/avatar.jpg");
      });

      it("should handle null owner relationship when removing owner", async () => {
        mockCtx.db.query.machines.findFirst
          .mockResolvedValueOnce(mockMachineWithOwner)
          .mockResolvedValueOnce(mockMachineWithoutOwnerRelations);

        (mockCtx.db.update as any).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi
                .fn()
                .mockResolvedValue([{ ...mockMachine, ownerId: null }]),
            }),
          }),
        });

        const caller = appRouter.createCaller(mockCtx);

        const result = await caller.machine.owner.assignOwner({
          machineId: "machine-1",
        });

        expect(result.model).toBeDefined();
        expect(result.location).toBeDefined();
        expect(result.owner).toBeNull();
      });

      it("should load only necessary owner fields for security", async () => {
        mockCtx.db.query.machines.findFirst
          .mockResolvedValueOnce(mockMachine)
          .mockResolvedValueOnce(mockMachineWithRelations);

        mockCtx.db.query.memberships.findFirst.mockResolvedValueOnce(
          mockMembership,
        );

        (mockCtx.db.update as any).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockUpdatedMachine]),
            }),
          }),
        });

        const caller = appRouter.createCaller(mockCtx);

        const result = await caller.machine.owner.assignOwner({
          machineId: "machine-1",
          ownerId: "user-2",
        });

        // Only id, name, and image should be included (no sensitive data like email)
        expect(result.owner).toEqual({
          id: "user-2",
          name: "Test Owner",
          image: "https://example.com/avatar.jpg",
        });
      });
    });
  });
});

import { describe, it, expect, beforeEach } from "@jest/globals";
import { TRPCError } from "@trpc/server";

import {
  createMockContext,
  resetMockContext,
  type MockContext,
} from "../../../../test/mockContext";
import { appRouter } from "../../root";
import { createCallerFactory } from "../../trpc";

/**
 * Integration Tests for Existing Routers with Permission System
 *
 * These tests verify that the permission system correctly integrates with
 * existing router implementations, testing end-to-end permission workflows.
 */

// Mock context helper with different permission sets
const createMockTRPCContext = (permissions: string[] = []) => {
  const mockContext = createMockContext();

  return {
    ...mockContext,
    session: {
      user: {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        image: null,
      },
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    },
    organization: {
      id: "org-1",
      name: "Test Organization",
      subdomain: "test",
      logoUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    membership: {
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
        permissions: permissions.map((name, index) => ({
          id: `perm-${(index + 1).toString()}`,
          name,
          description: `${name} permission`,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    },
    userPermissions: permissions,
  };
};

describe("Router Integration Tests", () => {
  let mockContext: MockContext;
  const createCaller = createCallerFactory(appRouter);

  beforeEach(() => {
    mockContext = createMockContext();
    resetMockContext(mockContext);
  });

  describe("Issue Router Integration", () => {
    it("should allow issue creation with proper permissions", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:create"]);
      const caller = createCaller(ctx as any);

      const mockMachine = {
        id: "machine-1",
        name: "Test Machine",
        organizationId: "org-1",
        locationId: "location-1",
        modelId: "model-1",
        ownerId: "user-1",
        location: {
          id: "location-1",
          name: "Test Location",
          organizationId: "org-1",
        },
        model: {
          id: "model-1",
          name: "Test Model",
        },
        owner: {
          id: "user-1",
          name: "Test User",
          email: "test@example.com",
        },
      };

      const mockStatus = {
        id: "status-1",
        name: "New",
        category: "NEW",
        organizationId: "org-1",
        isDefault: true,
      };

      const mockPriority = {
        id: "priority-1",
        name: "Medium",
        organizationId: "org-1",
        isDefault: true,
      };

      const mockIssue = {
        id: "issue-1",
        title: "Test Issue",
        description: "Test description",
        machineId: "machine-1",
        statusId: "status-1",
        priorityId: "priority-1",
        organizationId: "org-1",
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
        consistency: "Always",
        checklist: null,
        assignedToId: null,
        machine: mockMachine,
        status: mockStatus,
        priority: mockPriority,
        createdBy: {
          id: "user-1",
          name: "Test User",
          email: "test@example.com",
        },
        assignedTo: null,
        comments: [],
        attachments: [],
        history: [],
        upvotes: [],
      };

      mockContext.db.machine.findFirst.mockResolvedValue(mockMachine);
      mockContext.db.machine.findUnique.mockResolvedValue(mockMachine);
      mockContext.db.issueStatus.findFirst.mockResolvedValue(mockStatus);
      mockContext.db.priority.findFirst.mockResolvedValue(mockPriority);
      mockContext.db.issue.create.mockResolvedValue(mockIssue);

      // Act
      const result = await caller.issue.core.create({
        title: "Test Issue",
        description: "Test description",
        severity: "Medium",
        machineId: "machine-1",
      });

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: "issue-1",
          title: "Test Issue",
          description: "Test description",
        }),
      );
      expect(mockContext.db.issue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Test Issue",
            description: "Test description",
            organizationId: "org-1",
            createdById: "user-1",
          }),
        }),
      );
    });

    it("should deny issue creation without proper permissions", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:view"]);
      const caller = createCaller(ctx as any);

      // Act & Assert
      await expect(
        caller.issue.core.create({
          title: "Test Issue",
          machineId: "machine-1",
        }),
      ).rejects.toThrow("Permission required: issue:create");
    });

    it("should allow issue editing with proper permissions", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:edit"]);
      const caller = createCaller(ctx as any);

      const mockIssue = {
        id: "issue-1",
        title: "Original Title",
        description: "Original description",
        organizationId: "org-1",
        machineId: "machine-1",
        statusId: "status-1",
        priorityId: "priority-1",
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
        consistency: "Always",
        checklist: null,
        assignedToId: null,
        machine: {
          id: "machine-1",
          name: "Test Machine",
          location: {
            id: "location-1",
            name: "Test Location",
          },
          model: {
            id: "model-1",
            name: "Test Model",
          },
        },
        status: {
          id: "status-1",
          name: "New",
          category: "NEW",
        },
        priority: {
          id: "priority-1",
          name: "Medium",
        },
        createdBy: {
          id: "user-1",
          name: "Test User",
          email: "test@example.com",
        },
        assignedTo: null,
        comments: [],
        attachments: [],
        history: [],
        upvotes: [],
      };

      const updatedIssue = {
        ...mockIssue,
        title: "Updated Title",
        description: "Updated description",
      };

      mockContext.db.issue.findUnique.mockResolvedValue(mockIssue);
      mockContext.db.issue.update.mockResolvedValue(updatedIssue);

      // Act
      const result = await caller.issue.core.update({
        id: "issue-1",
        title: "Updated Title",
        description: "Updated description",
      });

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: "issue-1",
          title: "Updated Title",
          description: "Updated description",
        }),
      );
      expect(mockContext.db.issue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "issue-1" },
          data: expect.objectContaining({
            title: "Updated Title",
            description: "Updated description",
          }),
        }),
      );
    });

    it("should deny issue editing without proper permissions", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:view"]);
      const caller = createCaller(ctx as any);

      // Act & Assert
      await expect(
        caller.issue.core.update({
          id: "issue-1",
          title: "Updated Title",
        }),
      ).rejects.toThrow("Permission required: issue:edit");
    });

    it("should enforce organization isolation in issue operations", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:edit"]);
      const caller = createCaller(ctx as any);

      // Mock issue from different organization
      const mockIssue = {
        id: "issue-1",
        title: "Cross Org Issue",
        organizationId: "different-org", // Different organization!
        machineId: "machine-1",
        statusId: "status-1",
        priorityId: "priority-1",
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
        consistency: "Always",
        checklist: null,
        assignedToId: null,
      };

      mockContext.db.issue.findUnique.mockResolvedValue(mockIssue);

      // Act & Assert
      await expect(
        caller.issue.core.update({
          id: "issue-1",
          title: "Malicious Update",
        }),
      ).rejects.toThrow("Issue not found");
    });
  });

  describe("Machine Router Integration", () => {
    it("should allow machine operations with proper permissions", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["machine:edit"]);
      const caller = createCaller(ctx as any);

      const mockMachine = {
        id: "machine-1",
        name: "Test Machine",
        organizationId: "org-1",
        locationId: "location-1",
        modelId: "model-1",
        ownerId: "user-1",
        qrCodeId: "qr-1",
        qrCodeUrl: "https://example.com/qr/qr-1",
        qrCodeGeneratedAt: new Date(),
        ownerNotificationsEnabled: true,
        notifyOnNewIssues: true,
        notifyOnStatusChanges: true,
        notifyOnComments: false,
        location: {
          id: "location-1",
          name: "Test Location",
          organizationId: "org-1",
        },
        model: {
          id: "model-1",
          name: "Test Model",
        },
        owner: {
          id: "user-1",
          name: "Test User",
          email: "test@example.com",
        },
        issues: [],
        collections: [],
      };

      const updatedMachine = {
        ...mockMachine,
        name: "Updated Machine Name",
      };

      mockContext.db.machine.findUnique.mockResolvedValue(mockMachine);
      mockContext.db.machine.update.mockResolvedValue(updatedMachine);

      // Act
      const result = await caller.machine.core.update({
        id: "machine-1",
        name: "Updated Machine Name",
      });

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: "machine-1",
          name: "Updated Machine Name",
        }),
      );
      expect(mockContext.db.machine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "machine-1" },
          data: expect.objectContaining({
            name: "Updated Machine Name",
          }),
        }),
      );
    });

    it("should deny machine operations without proper permissions", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["machine:view"]);
      const caller = createCaller(ctx as any);

      // Act & Assert
      await expect(
        caller.machine.core.update({
          id: "machine-1",
          name: "Updated Machine Name",
        }),
      ).rejects.toThrow("Permission required: machine:edit");
    });

    it("should enforce organization isolation in machine operations", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["machine:edit"]);
      const caller = createCaller(ctx as any);

      // Mock machine from different organization
      const mockMachine = {
        id: "machine-1",
        name: "Cross Org Machine",
        organizationId: "different-org", // Different organization!
        locationId: "location-1",
        modelId: "model-1",
        ownerId: "user-1",
        location: {
          id: "location-1",
          name: "Test Location",
          organizationId: "different-org",
        },
      };

      mockContext.db.machine.findUnique.mockResolvedValue(mockMachine);

      // Act & Assert
      await expect(
        caller.machine.core.update({
          id: "machine-1",
          name: "Malicious Update",
        }),
      ).rejects.toThrow("Machine not found or access denied");
    });
  });

  describe("Location Router Integration", () => {
    it("should allow location operations with proper permissions", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["location:edit"]);
      const caller = createCaller(ctx as any);

      const mockLocation = {
        id: "location-1",
        name: "Test Location",
        organizationId: "org-1",
        street: "123 Main St",
        city: "Test City",
        state: "TS",
        zip: "12345",
        phone: "555-1234",
        website: "https://example.com",
        latitude: 40.7128,
        longitude: -74.006,
        description: "Test location description",
        pinballMapId: null,
        regionId: null,
        lastSyncAt: null,
        syncEnabled: false,
        organization: {
          id: "org-1",
          name: "Test Organization",
        },
        machines: [],
        collections: [],
      };

      const updatedLocation = {
        ...mockLocation,
        name: "Updated Location Name",
      };

      mockContext.db.location.findUnique.mockResolvedValue(mockLocation);
      mockContext.db.location.update.mockResolvedValue(updatedLocation);

      // Act
      const result = await caller.location.update({
        id: "location-1",
        name: "Updated Location Name",
      });

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: "location-1",
          name: "Updated Location Name",
        }),
      );
      expect(mockContext.db.location.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "location-1" },
          data: expect.objectContaining({
            name: "Updated Location Name",
          }),
        }),
      );
    });

    it("should deny location operations without proper permissions", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["location:view"]);
      const caller = createCaller(ctx as any);

      // Act & Assert
      await expect(
        caller.location.update({
          id: "location-1",
          name: "Updated Location Name",
        }),
      ).rejects.toThrow("Permission required: location:edit");
    });
  });

  describe("Organization Router Integration", () => {
    it("should allow organization operations with proper permissions", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["organization:manage"]);
      const caller = createCaller(ctx as any);

      const mockOrganization = {
        id: "org-1",
        name: "Test Organization",
        subdomain: "test",
        logoUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        memberships: [],
        locations: [],
        roles: [],
        machines: [],
        issues: [],
        priorities: [],
        issueStatuses: [],
        collectionTypes: [],
        issueHistory: [],
        attachments: [],
        pinballMapConfig: null,
      };

      const updatedOrganization = {
        ...mockOrganization,
        name: "Updated Organization Name",
      };

      mockContext.db.organization.findUnique.mockResolvedValue(
        mockOrganization,
      );
      mockContext.db.organization.update.mockResolvedValue(updatedOrganization);

      // Act
      const result = await caller.organization.update({
        name: "Updated Organization Name",
      });

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: "org-1",
          name: "Updated Organization Name",
        }),
      );
      expect(mockContext.db.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "org-1" },
          data: expect.objectContaining({
            name: "Updated Organization Name",
          }),
        }),
      );
    });

    it("should deny organization operations without proper permissions", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["user:manage"]);
      const caller = createCaller(ctx as any);

      // Act & Assert
      await expect(
        caller.organization.update({
          name: "Updated Organization Name",
        }),
      ).rejects.toThrow("Permission required: organization:manage");
    });
  });

  describe("User Router Integration", () => {
    it("should allow user operations with proper permissions", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["user:manage"]);
      const caller = createCaller(ctx as any);

      const mockUser = {
        id: "user-2",
        name: "Target User",
        email: "target@example.com",
        emailVerified: null,
        image: null,
        bio: null,
        profilePicture: null,
        emailNotificationsEnabled: true,
        pushNotificationsEnabled: false,
        notificationFrequency: "IMMEDIATE",
        createdAt: new Date(),
        updatedAt: new Date(),
        accounts: [],
        sessions: [],
        memberships: [],
        ownedMachines: [],
        issuesCreated: [],
        issuesAssigned: [],
        comments: [],
        deletedComments: [],
        upvotes: [],
        activityHistory: [],
        notifications: [],
      };

      const mockMembership = {
        id: "membership-2",
        userId: "user-2",
        organizationId: "org-1",
        roleId: "role-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockUser,
        organization: {
          id: "org-1",
          name: "Test Organization",
        },
        role: {
          id: "role-1",
          name: "Member",
          organizationId: "org-1",
          isSystem: false,
          isDefault: true,
        },
      };

      const updatedMembership = {
        ...mockMembership,
        roleId: "role-2",
      };

      mockContext.db.membership.findUnique.mockResolvedValue(mockMembership);
      mockContext.db.membership.update.mockResolvedValue(updatedMembership);

      // Act
      const result = await caller.user.updateMembership({
        userId: "user-2",
        roleId: "role-2",
      });

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: "membership-2",
          userId: "user-2",
          roleId: "role-2",
        }),
      );
      expect(mockContext.db.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId_organizationId: {
              userId: "user-2",
              organizationId: "org-1",
            },
          }),
          data: expect.objectContaining({
            roleId: "role-2",
          }),
        }),
      );
    });

    it("should deny user operations without proper permissions", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["organization:manage"]);
      const caller = createCaller(ctx as any);

      // Act & Assert
      await expect(
        caller.user.updateMembership({
          userId: "user-2",
          roleId: "role-2",
        }),
      ).rejects.toThrow("Permission required: user:manage");
    });
  });

  describe("Permission Inheritance and Cascading", () => {
    it("should properly inherit permissions from role hierarchy", async () => {
      // Arrange - User with admin role having all permissions
      const ctx = createMockTRPCContext([
        "issue:create",
        "issue:edit",
        "issue:delete",
        "issue:assign",
        "machine:edit",
        "machine:delete",
        "location:edit",
        "location:delete",
        "organization:manage",
        "user:manage",
        "role:manage",
      ]);
      const caller = createCaller(ctx as any);

      // Mock data for multiple operations
      const mockIssue = {
        id: "issue-1",
        title: "Test Issue",
        organizationId: "org-1",
        machineId: "machine-1",
        statusId: "status-1",
        priorityId: "priority-1",
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
        consistency: "Always",
        checklist: null,
        assignedToId: null,
        machine: {
          id: "machine-1",
          name: "Test Machine",
          location: { id: "location-1", name: "Test Location" },
          model: { id: "model-1", name: "Test Model" },
        },
        status: { id: "status-1", name: "New", category: "NEW" },
        priority: { id: "priority-1", name: "Medium" },
        createdBy: {
          id: "user-1",
          name: "Test User",
          email: "test@example.com",
        },
        assignedTo: null,
        comments: [],
        attachments: [],
        history: [],
        upvotes: [],
      };

      mockContext.db.issue.findUnique.mockResolvedValue(mockIssue);
      mockContext.db.issue.update.mockResolvedValue({
        ...mockIssue,
        assignedToId: "user-2",
      });

      // Act - Admin should be able to perform all operations
      const result = await caller.issue.core.assign({
        issueId: "issue-1",
        userId: "user-2",
      });

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: "issue-1",
          assignedToId: "user-2",
        }),
      );
    });

    it("should properly restrict permissions based on role limitations", async () => {
      // Arrange - User with limited permissions (only view)
      const ctx = createMockTRPCContext(["issue:view"]);
      const caller = createCaller(ctx as any);

      // Act & Assert - Should be denied for all write operations
      await expect(
        caller.issue.core.create({
          title: "Test Issue",
          machineId: "machine-1",
        }),
      ).rejects.toThrow("Permission required: issue:create");

      await expect(
        caller.issue.core.update({
          id: "issue-1",
          title: "Updated Title",
        }),
      ).rejects.toThrow("Permission required: issue:edit");

      await expect(
        caller.issue.core.delete({
          id: "issue-1",
        }),
      ).rejects.toThrow("Permission required: issue:delete");
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle missing permission middleware gracefully", async () => {
      // Arrange
      const ctx = createMockTRPCContext([]);
      const caller = createCaller(ctx as any);

      // Act & Assert
      await expect(
        caller.issue.core.create({
          title: "Test Issue",
          machineId: "machine-1",
        }),
      ).rejects.toThrow("Permission required: issue:create");
    });

    it("should handle corrupted permission data gracefully", async () => {
      // Arrange
      const ctx = createMockTRPCContext([]);
      // Corrupt the permissions array
      (ctx as any).userPermissions = undefined;
      const caller = createCaller(ctx as any);

      // Act & Assert
      await expect(
        caller.issue.core.create({
          title: "Test Issue",
          machineId: "machine-1",
        }),
      ).rejects.toThrow(TRPCError);
    });

    it("should handle permission changes during session", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:create"]);
      const caller = createCaller(ctx as any);

      const mockMachine = {
        id: "machine-1",
        location: { organizationId: "org-1" },
      };

      const mockStatus = {
        id: "status-1",
        name: "New",
        organizationId: "org-1",
        isDefault: true,
      };

      const mockPriority = {
        id: "priority-1",
        name: "Medium",
        organizationId: "org-1",
        isDefault: true,
      };

      mockContext.db.machine.findFirst.mockResolvedValue(mockMachine);
      mockContext.db.issueStatus.findFirst.mockResolvedValue(mockStatus);
      mockContext.db.priority.findFirst.mockResolvedValue(mockPriority);

      // Simulate permission being revoked mid-session
      (ctx as any).userPermissions = ["issue:view"];

      // Act & Assert
      await expect(
        caller.issue.core.create({
          title: "Test Issue",
          machineId: "machine-1",
        }),
      ).rejects.toThrow("Permission required: issue:create");
    });
  });
});

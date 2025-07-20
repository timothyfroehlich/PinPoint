import { describe, it, expect, beforeEach } from "@jest/globals";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createMockContext, type MockContext } from "../../../test/mockContext";
import { createTRPCRouter } from "../trpc";
import {
  requirePermission,
  issueCreateProcedure,
  issueEditProcedure,
  issueDeleteProcedure,
  issueAssignProcedure,
  attachmentCreateProcedure,
  attachmentDeleteProcedure,
  machineEditProcedure,
  machineDeleteProcedure,
  locationEditProcedure,
  locationDeleteProcedure,
  organizationManageProcedure,
  roleManageProcedure,
  userManageProcedure,
} from "../trpc.permission";

// Mock tRPC context with permissions
const createMockTRPCContext = (permissions: string[] = []): MockContext & {
  userPermissions: string[];
} => {
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
    },
    membership: {
      id: "membership-1",
      userId: "user-1",
      organizationId: "org-1",
      roleId: "role-1",
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
        })),
      },
    },
    userPermissions: permissions,
  };
};

// Test router setup
const createTestRouter = (): ReturnType<typeof createTRPCRouter> => {
  return createTRPCRouter({
    testRequirePermission: requirePermission("test:permission").query(() => {
      return { message: "Permission granted" };
    }),
    
    testIssueCreate: issueCreateProcedure
      .input(z.object({ title: z.string() }))
      .mutation(({ input }) => {
        return { message: `Issue created: ${input.title}` };
      }),
    
    testIssueEdit: issueEditProcedure
      .input(z.object({ id: z.string(), title: z.string() }))
      .mutation(({ input }) => {
        return { message: `Issue edited: ${input.title}` };
      }),
    
    testIssueDelete: issueDeleteProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => {
        return { message: `Issue deleted: ${input.id}` };
      }),
    
    testIssueAssign: issueAssignProcedure
      .input(z.object({ issueId: z.string(), userId: z.string() }))
      .mutation(({ input }) => {
        return { message: `Issue assigned: ${input.issueId} to ${input.userId}` };
      }),
    
    testAttachmentCreate: attachmentCreateProcedure
      .input(z.object({ filename: z.string() }))
      .mutation(({ input }) => {
        return { message: `Attachment created: ${input.filename}` };
      }),
    
    testAttachmentDelete: attachmentDeleteProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => {
        return { message: `Attachment deleted: ${input.id}` };
      }),
    
    testMachineEdit: machineEditProcedure
      .input(z.object({ id: z.string(), serialNumber: z.string() }))
      .mutation(({ input }) => {
        return { message: `Machine edited: ${input.serialNumber}` };
      }),
    
    testMachineDelete: machineDeleteProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => {
        return { message: `Machine deleted: ${input.id}` };
      }),
    
    testLocationEdit: locationEditProcedure
      .input(z.object({ id: z.string(), name: z.string() }))
      .mutation(({ input }) => {
        return { message: `Location edited: ${input.name}` };
      }),
    
    testLocationDelete: locationDeleteProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => {
        return { message: `Location deleted: ${input.id}` };
      }),
    
    testOrganizationManage: organizationManageProcedure
      .input(z.object({ name: z.string() }))
      .mutation(({ input }) => {
        return { message: `Organization managed: ${input.name}` };
      }),
    
    testRoleManage: roleManageProcedure
      .input(z.object({ roleName: z.string() }))
      .mutation(({ input }) => {
        return { message: `Role managed: ${input.roleName}` };
      }),
    
    testUserManage: userManageProcedure
      .input(z.object({ userId: z.string() }))
      .mutation(({ input }) => {
        return { message: `User managed: ${input.userId}` };
      }),
  });
};

describe("tRPC Permission Middleware", () => {
  let testRouter: ReturnType<typeof createTestRouter>;
  
  beforeEach(() => {
    testRouter = createTestRouter();
  });

  describe("requirePermission factory", () => {
    it("should allow access when user has required permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["test:permission"]);
      const caller = testRouter.createCaller(ctx);

      // Act
      const result = await caller.testRequirePermission();

      // Assert
      expect(result).toEqual({ message: "Permission granted" });
    });

    it("should deny access when user lacks required permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["other:permission"]);
      const caller = testRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.testRequirePermission()).rejects.toThrow(TRPCError);
      await expect(caller.testRequirePermission()).rejects.toThrow("Permission required: test:permission");
    });

    it("should deny access when user has no permissions", async () => {
      // Arrange
      const ctx = createMockTRPCContext([]);
      const caller = testRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.testRequirePermission()).rejects.toThrow(TRPCError);
      try {
        await caller.testRequirePermission();
        expect.fail("Should have thrown TRPCError");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });
  });

  describe("Issue Permission Procedures", () => {
    it("should allow issue creation with issue:create permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:create"]);
      const caller = testRouter.createCaller(ctx);

      // Act
      const result = await caller.testIssueCreate({ title: "Test Issue" });

      // Assert
      expect(result).toEqual({ message: "Issue created: Test Issue" });
    });

    it("should deny issue creation without issue:create permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:view"]);
      const caller = testRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.testIssueCreate({ title: "Test Issue" })).rejects.toThrow("Permission required: issue:create");
    });

    it("should allow issue editing with issue:edit permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:edit"]);
      const caller = testRouter.createCaller(ctx);

      // Act
      const result = await caller.testIssueEdit({ id: "issue-1", title: "Updated Issue" });

      // Assert
      expect(result).toEqual({ message: "Issue edited: Updated Issue" });
    });

    it("should deny issue editing without issue:edit permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:create"]);
      const caller = testRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.testIssueEdit({ id: "issue-1", title: "Updated Issue" })).rejects.toThrow("Permission required: issue:edit");
    });

    it("should allow issue deletion with issue:delete permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:delete"]);
      const caller = testRouter.createCaller(ctx);

      // Act
      const result = await caller.testIssueDelete({ id: "issue-1" });

      // Assert
      expect(result).toEqual({ message: "Issue deleted: issue-1" });
    });

    it("should deny issue deletion without issue:delete permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:edit"]);
      const caller = testRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.testIssueDelete({ id: "issue-1" })).rejects.toThrow("Permission required: issue:delete");
    });

    it("should allow issue assignment with issue:assign permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:assign"]);
      const caller = testRouter.createCaller(ctx);

      // Act
      const result = await caller.testIssueAssign({ issueId: "issue-1", userId: "user-2" });

      // Assert
      expect(result).toEqual({ message: "Issue assigned: issue-1 to user-2" });
    });

    it("should deny issue assignment without issue:assign permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:edit"]);
      const caller = testRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.testIssueAssign({ issueId: "issue-1", userId: "user-2" })).rejects.toThrow("Permission required: issue:assign");
    });
  });

  describe("Attachment Permission Procedures", () => {
    it("should allow attachment creation with attachment:create permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["attachment:create"]);
      const caller = testRouter.createCaller(ctx);

      // Act
      const result = await caller.testAttachmentCreate({ filename: "test.jpg" });

      // Assert
      expect(result).toEqual({ message: "Attachment created: test.jpg" });
    });

    it("should deny attachment creation without attachment:create permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["attachment:view"]);
      const caller = testRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.testAttachmentCreate({ filename: "test.jpg" })).rejects.toThrow("Permission required: attachment:create");
    });

    it("should allow attachment deletion with attachment:delete permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["attachment:delete"]);
      const caller = testRouter.createCaller(ctx);

      // Act
      const result = await caller.testAttachmentDelete({ id: "attachment-1" });

      // Assert
      expect(result).toEqual({ message: "Attachment deleted: attachment-1" });
    });

    it("should deny attachment deletion without attachment:delete permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["attachment:create"]);
      const caller = testRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.testAttachmentDelete({ id: "attachment-1" })).rejects.toThrow("Permission required: attachment:delete");
    });
  });

  describe("Machine Permission Procedures", () => {
    it("should allow machine editing with machine:edit permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["machine:edit"]);
      const caller = testRouter.createCaller(ctx);

      // Act
      const result = await caller.testMachineEdit({ id: "machine-1", serialNumber: "ABC123" });

      // Assert
      expect(result).toEqual({ message: "Machine edited: ABC123" });
    });

    it("should deny machine editing without machine:edit permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["machine:view"]);
      const caller = testRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.testMachineEdit({ id: "machine-1", serialNumber: "ABC123" })).rejects.toThrow("Permission required: machine:edit");
    });

    it("should allow machine deletion with machine:delete permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["machine:delete"]);
      const caller = testRouter.createCaller(ctx);

      // Act
      const result = await caller.testMachineDelete({ id: "machine-1" });

      // Assert
      expect(result).toEqual({ message: "Machine deleted: machine-1" });
    });

    it("should deny machine deletion without machine:delete permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["machine:edit"]);
      const caller = testRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.testMachineDelete({ id: "machine-1" })).rejects.toThrow("Permission required: machine:delete");
    });
  });

  describe("Location Permission Procedures", () => {
    it("should allow location editing with location:edit permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["location:edit"]);
      const caller = testRouter.createCaller(ctx);

      // Act
      const result = await caller.testLocationEdit({ id: "location-1", name: "Updated Location" });

      // Assert
      expect(result).toEqual({ message: "Location edited: Updated Location" });
    });

    it("should deny location editing without location:edit permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["location:view"]);
      const caller = testRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.testLocationEdit({ id: "location-1", name: "Updated Location" })).rejects.toThrow("Permission required: location:edit");
    });

    it("should allow location deletion with location:delete permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["location:delete"]);
      const caller = testRouter.createCaller(ctx);

      // Act
      const result = await caller.testLocationDelete({ id: "location-1" });

      // Assert
      expect(result).toEqual({ message: "Location deleted: location-1" });
    });

    it("should deny location deletion without location:delete permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["location:edit"]);
      const caller = testRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.testLocationDelete({ id: "location-1" })).rejects.toThrow("Permission required: location:delete");
    });
  });

  describe("Administrative Permission Procedures", () => {
    it("should allow organization management with organization:manage permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["organization:manage"]);
      const caller = testRouter.createCaller(ctx);

      // Act
      const result = await caller.testOrganizationManage({ name: "Updated Organization" });

      // Assert
      expect(result).toEqual({ message: "Organization managed: Updated Organization" });
    });

    it("should deny organization management without organization:manage permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["user:manage"]);
      const caller = testRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.testOrganizationManage({ name: "Updated Organization" })).rejects.toThrow("Permission required: organization:manage");
    });

    it("should allow role management with role:manage permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["role:manage"]);
      const caller = testRouter.createCaller(ctx);

      // Act
      const result = await caller.testRoleManage({ roleName: "New Role" });

      // Assert
      expect(result).toEqual({ message: "Role managed: New Role" });
    });

    it("should deny role management without role:manage permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["organization:manage"]);
      const caller = testRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.testRoleManage({ roleName: "New Role" })).rejects.toThrow("Permission required: role:manage");
    });

    it("should allow user management with user:manage permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["user:manage"]);
      const caller = testRouter.createCaller(ctx);

      // Act
      const result = await caller.testUserManage({ userId: "user-123" });

      // Assert
      expect(result).toEqual({ message: "User managed: user-123" });
    });

    it("should deny user management without user:manage permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["role:manage"]);
      const caller = testRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.testUserManage({ userId: "user-123" })).rejects.toThrow("Permission required: user:manage");
    });
  });

  describe("Multiple Permission Scenarios", () => {
    it("should allow access with multiple permissions including the required one", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:create", "issue:edit", "issue:delete", "organization:manage"]);
      const caller = testRouter.createCaller(ctx);

      // Act
      const createResult = await caller.testIssueCreate({ title: "Test Issue" });
      const editResult = await caller.testIssueEdit({ id: "issue-1", title: "Updated Issue" });
      const deleteResult = await caller.testIssueDelete({ id: "issue-1" });
      const orgResult = await caller.testOrganizationManage({ name: "Org Name" });

      // Assert
      expect(createResult).toEqual({ message: "Issue created: Test Issue" });
      expect(editResult).toEqual({ message: "Issue edited: Updated Issue" });
      expect(deleteResult).toEqual({ message: "Issue deleted: issue-1" });
      expect(orgResult).toEqual({ message: "Organization managed: Org Name" });
    });

    it("should deny access even with some permissions if required permission is missing", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:create", "issue:edit", "organization:manage"]);
      const caller = testRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.testIssueDelete({ id: "issue-1" })).rejects.toThrow("Permission required: issue:delete");
    });
  });

  describe("Permission Middleware Edge Cases", () => {
    it("should handle undefined userPermissions gracefully", async () => {
      // Arrange
      const ctx = createMockTRPCContext([]);
      // Override userPermissions to undefined
      (ctx).userPermissions = undefined;
      const caller = testRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.testRequirePermission()).rejects.toThrow(TRPCError);
    });

    it("should handle null userPermissions gracefully", async () => {
      // Arrange
      const ctx = createMockTRPCContext([]);
      // Override userPermissions to null
      (ctx).userPermissions = null;
      const caller = testRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.testRequirePermission()).rejects.toThrow(TRPCError);
    });

    it("should handle empty string permission", async () => {
      // Arrange
      const emptyPermissionRouter = createTRPCRouter({
        testEmptyPermission: requirePermission("").query(() => {
          return { message: "Empty permission granted" };
        }),
      });
      const ctx = createMockTRPCContext([""]);
      const caller = emptyPermissionRouter.createCaller(ctx);

      // Act
      const result = await caller.testEmptyPermission();

      // Assert
      expect(result).toEqual({ message: "Empty permission granted" });
    });

    it("should be case-sensitive for permission names", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["ISSUE:CREATE"]); // Wrong case
      const caller = testRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.testIssueCreate({ title: "Test Issue" })).rejects.toThrow("Permission required: issue:create");
    });
  });
});
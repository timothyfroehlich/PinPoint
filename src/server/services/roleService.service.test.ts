/**
 * RoleService Tests (Service Layer - Archetype 3)
 *
 * Tests the role management service business logic with:
 * - Security-critical operations (system roles, permissions)
 * - Multi-tenant organization scoping validation
 * - Business rule enforcement (admin constraints, templates)
 * - Database interaction patterns with mocked dependencies
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TRPCError } from "@trpc/server";

import { RoleService } from "./roleService";
import { SYSTEM_ROLES, ROLE_TEMPLATES } from "../auth/permissions.constants";
import { serviceTestUtils } from "~/test/helpers/service-test-helpers";
import type { ServiceTestContext } from "~/test/helpers/service-test-helpers";

describe("RoleService (Service Tests)", () => {
  let service: RoleService;
  let context: ServiceTestContext;

  beforeEach(() => {
    context = serviceTestUtils.createContext();
    service = new RoleService(context.mockDb, context.organizationId);
  });

  describe("createSystemRoles", () => {
    it("should create admin role with all permissions when none exists", async () => {
      // Arrange: Mock no existing admin role
      context.mockDb.query.roles.findFirst.mockResolvedValue(null);
      const mockInsertChain = context.mockDb.insert() as any;
      mockInsertChain.values.mockReturnValue({
        returning: vi
          .fn()
          .mockResolvedValue([serviceTestUtils.mockResponses.roles.adminRole]),
      });
      context.mockDb.query.permissions.findMany.mockResolvedValue([
        serviceTestUtils.mockResponses.roles.permission,
      ]);

      // Act
      await service.createSystemRoles();

      // Assert: Verify admin role creation with organization scoping
      expect(mockInsertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          name: SYSTEM_ROLES.ADMIN,
          organization_id: context.organizationId,
          is_system: true,
          is_default: false,
        }),
      );
    });

    it("should update existing admin role instead of creating duplicate", async () => {
      // Arrange: Mock existing admin role
      const existingAdminRole = {
        ...serviceTestUtils.mockResponses.roles.adminRole,
        is_system: false, // Will be updated
      };
      context.mockDb.query.roles.findFirst.mockResolvedValue(existingAdminRole);
      context.mockDb.update.mockResolvedValue([
        serviceTestUtils.mockResponses.roles.adminRole,
      ]);
      context.mockDb.query.permissions.findMany.mockResolvedValue([]);

      // Act
      await service.createSystemRoles();

      // Assert: Verify update, not insert
      expect(context.mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_system: true,
          is_default: false,
        }),
      );
      expect(context.mockDb.insert).not.toHaveBeenCalledWith(
        expect.objectContaining({
          name: SYSTEM_ROLES.ADMIN,
        }),
      );
    });

    it("should create unauthenticated role with limited permissions", async () => {
      // Arrange
      context.mockDb.query.roles.findFirst
        .mockResolvedValueOnce(null) // Admin role doesn't exist
        .mockResolvedValueOnce(null); // Unauthenticated role doesn't exist
      context.mockDb.insert
        .mockResolvedValueOnce([serviceTestUtils.mockResponses.roles.adminRole])
        .mockResolvedValueOnce([
          {
            ...serviceTestUtils.mockResponses.roles.memberRole,
            name: SYSTEM_ROLES.UNAUTHENTICATED,
            is_system: true,
          },
        ]);
      context.mockDb.query.permissions.findMany.mockResolvedValue([]);

      // Act
      await service.createSystemRoles();

      // Assert: Verify unauthenticated role creation
      expect(context.mockDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: SYSTEM_ROLES.UNAUTHENTICATED,
          organization_id: context.organizationId,
          is_system: true,
        }),
      );
    });

    it("should enforce organization scoping for all role creation", async () => {
      // Arrange
      context.mockDb.query.roles.findFirst.mockResolvedValue(null);
      context.mockDb.insert.mockResolvedValue([
        serviceTestUtils.mockResponses.roles.adminRole,
      ]);
      context.mockDb.query.permissions.findMany.mockResolvedValue([]);

      // Act
      await service.createSystemRoles();

      // Assert: Every role insert should include organization scoping
      const insertCalls = context.mockDb.insert.mock.calls;
      insertCalls.forEach((call) => {
        expect(call[1]).toEqual(
          expect.objectContaining({
            organization_id: context.organizationId,
          }),
        );
      });
    });
  });

  describe("createTemplateRole", () => {
    it("should create role from MEMBER template with correct permissions", async () => {
      // Arrange
      context.mockDb.query.roles.findFirst.mockResolvedValue(null);
      const mockInsertChain = context.mockDb.insert() as any;
      mockInsertChain.values.mockReturnValue({
        returning: vi
          .fn()
          .mockResolvedValue([serviceTestUtils.mockResponses.roles.memberRole]),
      });
      context.mockDb.query.permissions.findMany.mockResolvedValue([
        serviceTestUtils.mockResponses.roles.permission,
      ]);

      // Act
      const _role = await service.createTemplateRole("MEMBER");

      // Assert: Verify template role creation
      expect(mockInsertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          name: ROLE_TEMPLATES.MEMBER.name,
          organization_id: context.organizationId,
          is_system: false,
          is_default: true,
        }),
      );
      expect(role.name).toBe(ROLE_TEMPLATES.MEMBER.name);
    });

    it("should allow custom overrides for template roles", async () => {
      // Arrange
      const customName = "Custom Member Role";
      const customOverrides = { name: customName, is_default: false };

      context.mockDb.query.roles.findFirst.mockResolvedValue(null);
      const mockInsertChain = context.mockDb.insert() as any;
      mockInsertChain.values.mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            ...serviceTestUtils.mockResponses.roles.memberRole,
            name: customName,
            is_default: false,
          },
        ]),
      });
      context.mockDb.query.permissions.findMany.mockResolvedValue([]);

      // Act
      const _role = await service.createTemplateRole("MEMBER", customOverrides);

      // Assert: Verify custom overrides applied
      expect(mockInsertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          name: customName,
          is_default: false,
        }),
      );
    });

    it("should update existing role instead of creating duplicate", async () => {
      // Arrange: Mock existing role with same name
      const existingRole = {
        ...serviceTestUtils.mockResponses.roles.memberRole,
        name: ROLE_TEMPLATES.MEMBER.name,
      };
      context.mockDb.query.roles.findFirst.mockResolvedValue(existingRole);
      const mockUpdateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([existingRole]),
          }),
        }),
      };
      context.mockDb.update.mockReturnValue(mockUpdateChain);
      context.mockDb.query.permissions.findMany.mockResolvedValue([]);

      // Act
      const _role = await service.createTemplateRole("MEMBER");

      // Assert: Verify update, not insert
      expect(mockUpdateChain.set).toHaveBeenCalled();
    });
  });

  describe("deleteRole", () => {
    it("should prevent deletion of system roles", async () => {
      // Arrange: Mock system role
      const systemRole = {
        ...serviceTestUtils.mockResponses.roles.adminRole,
        is_system: true,
      };
      context.mockDb.query.roles.findFirst.mockResolvedValue(systemRole);

      // Act & Assert: Should throw error
      await expect(service.deleteRole(systemRole.id)).rejects.toThrow(
        TRPCError,
      );

      await expect(service.deleteRole(systemRole.id)).rejects.toThrow(
        "System roles cannot be deleted",
      );
    });

    it("should reassign members to default role before deletion", async () => {
      // Arrange: Mock non-system role with memberships
      const roleToDelete = {
        ...serviceTestUtils.mockResponses.roles.memberRole,
        id: "role-to-delete-001",
        name: "Temporary Role",
        is_system: false,
        memberships: [{ id: "membership-001", user_id: "user-001" }],
      };
      const defaultRole = serviceTestUtils.mockResponses.roles.memberRole;

      context.mockDb.query.roles.findFirst
        .mockResolvedValueOnce(roleToDelete) // Role to delete
        .mockResolvedValueOnce(defaultRole); // Default role for reassignment
      context.mockDb.update.mockResolvedValue([]);
      context.mockDb.delete.mockResolvedValue([]);

      // Act
      await service.deleteRole(roleToDelete.id);

      // Assert: Verify member reassignment to default role
      expect(context.mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          role_id: defaultRole.id,
        }),
      );
    });

    it("should require default role available for member reassignment", async () => {
      // Arrange: Mock role to delete but no default role available
      const roleToDelete = {
        ...serviceTestUtils.mockResponses.roles.memberRole,
        is_system: false,
        memberships: [{ id: "membership-001" }],
      };

      context.mockDb.query.roles.findFirst
        .mockResolvedValueOnce(roleToDelete) // Role to delete
        .mockResolvedValueOnce(null); // No default role available

      // Act & Assert: Should throw precondition error
      await expect(service.deleteRole(roleToDelete.id)).rejects.toThrow(
        "No default role available for member reassignment",
      );
    });
  });

  describe("getDefaultRole", () => {
    it("should return default non-system role", async () => {
      // Arrange
      const defaultRole = {
        ...serviceTestUtils.mockResponses.roles.memberRole,
        is_default: true,
        is_system: false,
      };
      context.mockDb.query.roles.findFirst.mockResolvedValue(defaultRole);

      // Act
      const result = await service.getDefaultRole();

      // Assert
      expect(result).toEqual(defaultRole);
      expect(context.mockDb.query.roles.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          is_default: true,
          is_system: false,
        }),
      });
    });

    it("should return null when no default role exists", async () => {
      // Arrange
      context.mockDb.query.roles.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.getDefaultRole();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("Multi-tenant Security", () => {
    it("should scope all operations to the service organization", async () => {
      // Arrange
      const competitorService = new RoleService(
        context.mockDb,
        context.competitorOrgId,
      );
      context.mockDb.query.roles.findFirst.mockResolvedValue(null);
      context.mockDb.insert.mockResolvedValue([
        {
          ...serviceTestUtils.mockResponses.roles.adminRole,
          organization_id: context.competitorOrgId,
        },
      ]);
      context.mockDb.query.permissions.findMany.mockResolvedValue([]);

      // Act
      await competitorService.createSystemRoles();

      // Assert: Verify competitor organization scoping
      expect(context.mockDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: context.competitorOrgId,
        }),
      );

      // Ensure not scoped to primary org
      expect(context.mockDb.insert).not.toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: context.organizationId,
        }),
      );
    });
  });
});

/**
 * DrizzleRoleService Unit Tests
 * 
 * Tests for the DrizzleRoleService class covering error scenarios,
 * edge cases, and business logic not covered by integration tests.
 * 
 * Focus areas:
 * - Error handling (NOT_FOUND, FORBIDDEN, PRECONDITION_FAILED)
 * - Admin protection logic
 * - Template creation edge cases
 * - Permission assignment validation
 * - Role deletion constraints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { eq, and, ne } from 'drizzle-orm';

import { DrizzleRoleService } from '../drizzleRoleService';
import { ROLE_TEMPLATES, SYSTEM_ROLES } from '../../auth/permissions.constants';
import { generatePrefixedId } from '~/lib/utils/id-generation';

// Mock dependencies
vi.mock('~/lib/utils/id-generation', () => ({
  generatePrefixedId: vi.fn(() => 'test-role-123'),
}));

vi.mock('../permissionService', () => ({
  PermissionService: vi.fn(() => ({
    getPermissions: vi.fn().mockResolvedValue([]),
  })),
}));

// Mock drizzle client
const createMockDrizzleClient = () => ({
  query: {
    roles: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    permissions: {
      findMany: vi.fn(),
    },
    memberships: {
      findMany: vi.fn(),
    },
    rolePermissions: {
      findMany: vi.fn(),
    },
  },
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
  })),
  delete: vi.fn(() => ({
    where: vi.fn(),
  })),
});

describe('DrizzleRoleService', () => {
  let service: DrizzleRoleService;
  let mockDrizzle: ReturnType<typeof createMockDrizzleClient>;
  const testOrgId = 'org-123';

  beforeEach(() => {
    vi.clearAllMocks();
    mockDrizzle = createMockDrizzleClient();
    service = new DrizzleRoleService(mockDrizzle as any, testOrgId);
  });

  describe('deleteRole', () => {
    it('should throw NOT_FOUND when role does not exist', async () => {
      mockDrizzle.query.roles.findFirst.mockResolvedValue(null);

      await expect(service.deleteRole('nonexistent-role')).rejects.toThrow(
        expect.objectContaining({
          code: 'NOT_FOUND',
          message: 'Role not found',
        })
      );
    });

    it('should throw FORBIDDEN when trying to delete system role', async () => {
      const systemRole = {
        id: 'role-admin',
        name: SYSTEM_ROLES.ADMIN,
        isSystem: true,
        memberships: [],
      };
      
      mockDrizzle.query.roles.findFirst.mockResolvedValue(systemRole);

      await expect(service.deleteRole('role-admin')).rejects.toThrow(
        expect.objectContaining({
          code: 'FORBIDDEN',
          message: 'System roles cannot be deleted',
        })
      );
    });

    it('should throw PRECONDITION_FAILED when no default role available for reassignment', async () => {
      const customRole = {
        id: 'role-custom',
        name: 'Custom Role',
        isSystem: false,
        memberships: [{ userId: 'user-123' }],
      };
      
      mockDrizzle.query.roles.findFirst
        .mockResolvedValueOnce(customRole) // First call: find role to delete
        .mockResolvedValueOnce(null); // Second call: find default role

      await expect(service.deleteRole('role-custom')).rejects.toThrow(
        expect.objectContaining({
          code: 'PRECONDITION_FAILED',
          message: 'No default role available for member reassignment',
        })
      );
    });
  });

  describe('createTemplateRole', () => {
    it('should create new role when template role does not exist', async () => {
      const templateName = 'MANAGER' as keyof typeof ROLE_TEMPLATES;
      const mockNewRole = {
        id: 'test-role-123',
        name: ROLE_TEMPLATES.MANAGER.name,
        organizationId: testOrgId,
        isSystem: false,
        isDefault: true,
      };

      // Role doesn't exist
      mockDrizzle.query.roles.findFirst.mockResolvedValue(null);
      
      // Mock insert chain
      const mockReturning = vi.fn().mockResolvedValue([mockNewRole]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockDrizzle.insert.mockReturnValue({ values: mockValues });

      // Mock permission queries for template setup
      mockDrizzle.query.permissions.findMany.mockResolvedValue([]);
      mockDrizzle.query.rolePermissions.findMany.mockResolvedValue([]);

      const result = await service.createTemplateRole(templateName);

      expect(result).toEqual(mockNewRole);
      expect(mockDrizzle.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith({
        id: 'test-role-123',
        name: ROLE_TEMPLATES.MANAGER.name,
        organizationId: testOrgId,
        isSystem: false,
        isDefault: true,
      });
    });

    it('should update existing role when template role already exists', async () => {
      const templateName = 'MANAGER' as keyof typeof ROLE_TEMPLATES;
      const existingRole = {
        id: 'existing-role-123',
        name: ROLE_TEMPLATES.MANAGER.name,
        organizationId: testOrgId,
        isSystem: true, // Will be updated to false
        isDefault: false, // Will be updated to true
      };

      const updatedRole = { ...existingRole, isSystem: false, isDefault: true };

      // Role exists
      mockDrizzle.query.roles.findFirst.mockResolvedValue(existingRole);
      
      // Mock update chain
      const mockReturning = vi.fn().mockResolvedValue([updatedRole]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      mockDrizzle.update.mockReturnValue({ set: mockSet });

      // Mock permission queries
      mockDrizzle.query.permissions.findMany.mockResolvedValue([]);
      mockDrizzle.query.rolePermissions.findMany.mockResolvedValue([]);

      const result = await service.createTemplateRole(templateName);

      expect(result).toEqual(updatedRole);
      expect(mockDrizzle.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isSystem: false,
          isDefault: true,
        })
      );
    });

    it('should apply name override when provided', async () => {
      const templateName = 'MANAGER' as keyof typeof ROLE_TEMPLATES;
      const customName = 'Custom Manager Role';
      const mockNewRole = {
        id: 'test-role-123',
        name: customName,
        organizationId: testOrgId,
        isSystem: false,
        isDefault: false,
      };

      mockDrizzle.query.roles.findFirst.mockResolvedValue(null);
      
      const mockReturning = vi.fn().mockResolvedValue([mockNewRole]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockDrizzle.insert.mockReturnValue({ values: mockValues });

      mockDrizzle.query.permissions.findMany.mockResolvedValue([]);
      mockDrizzle.query.rolePermissions.findMany.mockResolvedValue([]);

      const result = await service.createTemplateRole(templateName, {
        name: customName,
        isDefault: false,
      });

      expect(result.name).toBe(customName);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: customName,
          isDefault: false,
        })
      );
    });
  });

  describe('ensureAtLeastOneAdmin', () => {
    it('should throw error when no admin users exist', async () => {
      // No admin memberships found
      mockDrizzle.query.memberships.findMany.mockResolvedValue([]);

      await expect(service.ensureAtLeastOneAdmin()).rejects.toThrow(
        expect.objectContaining({
          code: 'PRECONDITION_FAILED',
          message: expect.stringContaining('At least one admin must remain'),
        })
      );
    });

    it('should pass when admin users exist', async () => {
      const adminMemberships = [
        {
          id: 'membership-123',
          userId: 'user-admin',
          role: { name: SYSTEM_ROLES.ADMIN },
        },
      ];
      
      mockDrizzle.query.memberships.findMany.mockResolvedValue(adminMemberships);

      await expect(service.ensureAtLeastOneAdmin()).resolves.not.toThrow();
    });
  });

  describe('getDefaultRole', () => {
    it('should return null when no default role exists', async () => {
      mockDrizzle.query.roles.findFirst.mockResolvedValue(null);

      const result = await service.getDefaultRole();

      expect(result).toBeNull();
      expect(mockDrizzle.query.roles.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object), // and(eq(organizationId), eq(isDefault, true))
      });
    });

    it('should return default role when it exists', async () => {
      const defaultRole = {
        id: 'role-default',
        name: 'Default Role',
        organizationId: testOrgId,
        isDefault: true,
      };

      mockDrizzle.query.roles.findFirst.mockResolvedValue(defaultRole);

      const result = await service.getDefaultRole();

      expect(result).toEqual(defaultRole);
    });
  });

  describe('getAdminRole', () => {
    it('should return null when admin role does not exist', async () => {
      mockDrizzle.query.roles.findFirst.mockResolvedValue(null);

      const result = await service.getAdminRole();

      expect(result).toBeNull();
    });

    it('should return admin role when it exists', async () => {
      const adminRole = {
        id: 'role-admin',
        name: SYSTEM_ROLES.ADMIN,
        organizationId: testOrgId,
        isSystem: true,
      };

      mockDrizzle.query.roles.findFirst.mockResolvedValue(adminRole);

      const result = await service.getAdminRole();

      expect(result).toEqual(adminRole);
    });
  });

  describe('updateRole', () => {
    it('should throw NOT_FOUND when role does not exist', async () => {
      mockDrizzle.query.roles.findFirst.mockResolvedValue(null);

      await expect(service.updateRole('nonexistent-role', { name: 'New Name' }))
        .rejects.toThrow(
          expect.objectContaining({
            code: 'NOT_FOUND',
            message: 'Role not found',
          })
        );
    });

    it('should throw FORBIDDEN when trying to update system role', async () => {
      const systemRole = {
        id: 'role-admin',
        name: SYSTEM_ROLES.ADMIN,
        isSystem: true,
        organizationId: testOrgId,
      };

      mockDrizzle.query.roles.findFirst.mockResolvedValue(systemRole);

      await expect(service.updateRole('role-admin', { name: 'New Admin' }))
        .rejects.toThrow(
          expect.objectContaining({
            code: 'FORBIDDEN',
            message: 'System roles cannot be modified',
          })
        );
    });
  });
});
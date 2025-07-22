import { trpcMsw } from './setup';

import type { User, Organization, Role, Permission } from '@prisma/client';

// Type for enhanced membership with role and permissions
interface MockMembership {
  id: string;
  userId: string;
  organizationId: string;
  roleId: string;
  role: Role & { permissions: Permission[] };
}

// Example handlers for common operations with the new architecture
export const handlers = {
  // User profile - basic authentication test
  userGetProfile: (user: Partial<User> = {}) =>
    trpcMsw.user.getProfile.query((req, res, ctx) => {
      return res(ctx.status(200), ctx.data({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        bio: null,
        profilePicture: null,
        emailVerified: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ownedMachines: [],
        memberships: [],
        _count: {
          issuesCreated: 0,
          comments: 0,
          ownedMachines: 0,
        },
        ...user,
      }));
    }),

  // Current membership - organization procedure test
  userGetCurrentMembership: (membership: Partial<{
    userId: string;
    role: string;
    organizationId: string;
    permissions: string[];
  }> = {}) =>
    trpcMsw.user.getCurrentMembership.query((req, res, ctx) => {
      return res(ctx.status(200), ctx.data({
        userId: membership.userId || 'user-1',
        role: membership.role || 'Member',
        organizationId: membership.organizationId || 'org-1',
        permissions: membership.permissions || ['issue:view'],
      }));
    }),

  // Organization data - for organization procedure tests (if this route exists)
  organizationGetCurrent: (org: Partial<Organization> = {}) =>
    trpcMsw.organization?.getCurrent?.query((req, res, ctx) => {
      return res(ctx.status(200), ctx.data({
        id: 'org-1',
        name: 'Test Organization',
        subdomain: 'test-org',
        logoUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...org,
      }));
    }),

  // Permission-based handlers for testing new permission procedures
  withPermission: (permission: string, mockResponse: any) =>
    trpcMsw.user.getCurrentMembership.query((req, res, ctx) => {
      return res(ctx.status(200), ctx.data(mockResponse));
    }),

  // Error handlers for permission testing
  errorUnauthorized: () =>
    trpcMsw.user.getProfile.query((req, res, ctx) => {
      return res(ctx.status(401), ctx.json({
        error: {
          message: 'UNAUTHORIZED',
          code: -32001,
          data: {
            code: 'UNAUTHORIZED',
            httpStatus: 401,
          }
        }
      }));
    }),

  errorForbidden: (permission: string) =>
    trpcMsw.user.getCurrentMembership.query((req, res, ctx) => {
      return res(ctx.status(403), ctx.json({
        error: {
          message: `Permission required: ${permission}`,
          code: -32003,
          data: {
            code: 'FORBIDDEN',
            httpStatus: 403,
          }
        }
      }));
    }),

  errorNotFound: (resource: string) =>
    trpcMsw.user.getCurrentMembership.query((req, res, ctx) => {
      return res(ctx.status(404), ctx.json({
        error: {
          message: `${resource} not found`,
          code: -32004,
          data: {
            code: 'NOT_FOUND',
            httpStatus: 404,
          }
        }
      }));
    }),

  // Helper for mocking successful permission checks
  mockUserWithPermissions: (permissions: string[] = []) =>
    trpcMsw.user.getCurrentMembership.query((req, res, ctx) => {
      return res(ctx.status(200), ctx.data({
        userId: 'user-1',
        role: 'Member',
        organizationId: 'org-1',
        permissions,
      }));
    }),

  // Helper for mocking admin user (gets all permissions)
  mockAdminUser: () =>
    trpcMsw.user.getCurrentMembership.query((req, res, ctx) => {
      return res(ctx.status(200), ctx.data({
        userId: 'admin-1',
        role: 'Admin',
        organizationId: 'org-1',
        permissions: [
          'issue:view', 'issue:create', 'issue:edit', 'issue:delete', 'issue:assign',
          'machine:edit', 'machine:delete',
          'location:edit', 'location:delete',
          'organization:manage', 'role:manage', 'user:manage',
          'attachment:create', 'attachment:delete'
        ],
      }));
    }),
};
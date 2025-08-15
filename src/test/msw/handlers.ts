/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { trpcMsw } from "./setup";

// Local User type to match application schema (replaces Prisma import)
interface User {
  id: string;
  email: string;
  name: string | null;
  bio: string | null;
  profilePicture: string | null;
  emailVerified: Date | null;
  image: string | null;
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  notificationFrequency: "IMMEDIATE" | "DAILY" | "WEEKLY";
  createdAt: Date;
  updatedAt: Date;
}

// Local Organization type that matches tRPC context expectations
interface Organization {
  id: string;
  name: string;
  subdomain: string; // Required for tRPC context
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Mock data factories for consistent test data
export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  bio: null,
  profilePicture: null,
  emailVerified: null,
  image: null,
  emailNotificationsEnabled: true,
  pushNotificationsEnabled: false,
  notificationFrequency: "IMMEDIATE" as const,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  ...overrides,
});

export const createMockOrganization = (
  overrides: Partial<Organization> = {},
): Organization => ({
  id: "org-1",
  name: "Test Organization",
  subdomain: "test-org",
  logoUrl: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  ...overrides,
});

export const createMockMembership = (
  overrides: {
    userId?: string;
    role?: string;
    organizationId?: string;
    permissions?: string[];
  } = {},
) => ({
  userId: overrides.userId ?? "user-1",
  role: overrides.role ?? "Member",
  organizationId: overrides.organizationId ?? "org-1",
  permissions: overrides.permissions ?? ["issue:view"],
});

// Individual handler functions for tRPC procedures
// These can be used directly with setupServer() or registered dynamically

// User profile handler - returns full user profile with relationships
export const mockUserProfile = (user: Partial<User> = {}) =>
  trpcMsw.user.getProfile.query(() => {
    const now = new Date();
    return {
      id: user.id ?? "user-1",
      name: user.name ?? "Test User",
      email: user.email ?? "user@example.com",
      emailVerified: user.emailVerified ?? null,
      image: user.image ?? null,
      createdAt: user.createdAt ?? now,
      updatedAt: user.updatedAt ?? now,
      bio: user.bio ?? null,
      profilePicture: user.profilePicture ?? null,
      emailNotificationsEnabled: user.emailNotificationsEnabled ?? true,
      pushNotificationsEnabled: user.pushNotificationsEnabled ?? false,
      notificationFrequency: user.notificationFrequency ?? "IMMEDIATE",
      ownedMachines: [],
      memberships: [],
      _count: {
        issuesCreated: 0,
        comments: 0,
        ownedMachines: 0,
      },
    };
  });

// Current membership handler - returns membership info for organization procedures
export const mockCurrentMembership = (
  membership: Parameters<typeof createMockMembership>[0] = {},
) =>
  trpcMsw.user.getCurrentMembership.query(() => {
    console.log(`[MSW Handler] mockCurrentMembership called with:`, membership);
    const result = createMockMembership(membership);
    console.log(`[MSW Handler] returning membership:`, result);
    return result;
  });

// Organization handler - returns current organization
export const mockCurrentOrganization = (org: Partial<Organization> = {}) =>
  trpcMsw.organization.getCurrent.query(() => createMockOrganization(org));

// Utility handlers for common testing scenarios

// Mock user with specific permissions
export const mockUserWithPermissions = (permissions: string[]) =>
  mockCurrentMembership({ permissions });

// Mock admin user with all permissions
export const mockAdminUser = () =>
  mockCurrentMembership({
    userId: "admin-1",
    role: "Admin",
    permissions: [
      "issue:view",
      "issue:create",
      "issue:edit",
      "issue:delete",
      "issue:assign",
      "machine:edit",
      "machine:delete",
      "location:edit",
      "location:delete",
      "organization:manage",
      "role:manage",
      "user:manage",
      "attachment:create",
      "attachment:delete",
    ],
  });

// Mock user with no permissions
export const mockUserWithoutPermissions = () =>
  mockCurrentMembership({ permissions: [] });

// Error handlers using MSW error response patterns
// Note: These use the full MSW pattern for proper error handling

// Unauthorized error (401)
export const mockUnauthorizedError = () =>
  trpcMsw.user.getProfile.query(() => {
    throw new Error("UNAUTHORIZED");
  });

// Forbidden error (403) - for permission violations
export const mockForbiddenError = (permission: string) =>
  trpcMsw.user.getCurrentMembership.query(() => {
    throw new Error(`Permission required: ${permission}`);
  });

// Not found error (404)
export const mockNotFoundError = (resource: string) =>
  trpcMsw.user.getCurrentMembership.query(() => {
    throw new Error(`${resource} not found`);
  });

// Common handler collections for easy test setup
export const defaultHandlers = [
  mockUserProfile(),
  mockCurrentMembership(),
  mockCurrentOrganization(),
];

export const adminUserHandlers = [
  mockUserProfile({ name: "Admin User" }),
  mockAdminUser(),
  mockCurrentOrganization(),
];

export const unauthorizedHandlers = [mockUnauthorizedError()];

// Export handlers object for compatibility with existing tests
export const handlers = {
  userGetProfile: mockUserProfile,
  userGetCurrentMembership: mockCurrentMembership,
  errorUnauthorized: mockUnauthorizedError,
  errorForbidden: mockForbiddenError,
  mockUserWithPermissions,
  mockAdminUser,
};

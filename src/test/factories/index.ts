/**
 * Test Data Factories
 *
 * Centralized exports for all test data factories used across the test suite.
 * These factories provide consistent, reusable test data for roles, permissions,
 * organizations, and related entities.
 */

export {
  type TestRole,
  type TestPermission,
  type TestMembership,
  type TestOrganization,
} from "./roleFactory";

import {
  PermissionFactory as PermissionFactoryNS,
  RoleFactory as RoleFactoryNS,
  MembershipFactory as MembershipFactoryNS,
  OrganizationFactory as OrganizationFactoryNS,
  PermissionMatrixFactory as PermissionMatrixFactoryNS,
  MockContextFactory as MockContextFactoryNS,
} from "./roleFactory";

export const PermissionFactory = PermissionFactoryNS;
export const RoleFactory = RoleFactoryNS;
export const MembershipFactory = MembershipFactoryNS;
export const OrganizationFactory = OrganizationFactoryNS;
export const PermissionMatrixFactory = PermissionMatrixFactoryNS;
export const MockContextFactory = MockContextFactoryNS;

// Re-export common factory instances for convenience
export const Factories = {
  Permission: PermissionFactory,
  Role: RoleFactory,
  Membership: MembershipFactory,
  Organization: OrganizationFactory,
  PermissionMatrix: PermissionMatrixFactory,
  MockContext: MockContextFactory,
} as const;

// Common permission sets for quick access
export const CommonPermissions = {
  ISSUE_ALL: [
    "issue:create",
    "issue:edit",
    "issue:delete",
    "issue:assign",
    "issue:view",
    "issue:confirm",
  ],
  MACHINE_ALL: [
    "machine:create",
    "machine:edit",
    "machine:delete",
    "machine:view",
  ],
  LOCATION_ALL: [
    "location:create",
    "location:edit",
    "location:delete",
    "location:view",
  ],
  ADMIN_ALL: ["organization:manage", "user:manage", "role:manage"],
  READ_ONLY: ["issue:view", "machine:view", "location:view", "attachment:view"],
} as const;

// Common role configurations for quick testing
export const CommonRoles = {
  UNAUTHENTICATED: "Unauthenticated" as const,
  MEMBER: "Member" as const,
  TECHNICIAN: "Technician" as const,
  ADMIN: "Admin" as const,
} as const;

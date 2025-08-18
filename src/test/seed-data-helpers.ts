/**
 * Seed Data Helpers - Access development seed data for testing
 *
 * These helpers provide access to the rich seed data created by scripts/seed/orchestrator.ts
 * for use in integration tests that need real auth context and relationships.
 *
 * Benefits over mocks:
 * - Real database constraints and relationships
 * - Proper Supabase user metadata structure
 * - Multi-tenant security boundaries
 * - Realistic data for integration testing
 */

/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { eq, desc, ilike } from "drizzle-orm";

import { createDrizzleClient } from "~/server/db/drizzle";
import {
  users,
  memberships,
  roles,
  permissions,
  rolePermissions,
  organizations,
  locations,
  machines,
  models,
  issues,
  issueStatuses,
  priorities,
} from "~/server/db/schema";

const db = createDrizzleClient();

// Type exports for compatibility
export type IssueStatus = typeof issueStatuses.$inferSelect;
export type Priority = typeof priorities.$inferSelect;

// User type with basic info (can be extended as needed)
export type SeededUser = typeof users.$inferSelect & {
  memberships?: (typeof memberships.$inferSelect & {
    role: typeof roles.$inferSelect & {
      permissions: (typeof permissions.$inferSelect)[];
    };
  })[];
};

// Cache for frequently accessed seed data to improve test performance
const seedDataCache = new Map<string, unknown>();

/**
 * Get cached seed data to avoid repeated database queries
 */
async function getCachedSeedData<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
): Promise<T> {
  if (seedDataCache.has(cacheKey)) {
    return seedDataCache.get(cacheKey) as T;
  }

  const data = await fetchFn();
  seedDataCache.set(cacheKey, data);
  return data;
}

/**
 * Clear seed data cache (call between test files to ensure isolation)
 */
export function clearSeedDataCache(): void {
  seedDataCache.clear();
}

// =============================================================================
// USER HELPERS - Access development test users with real roles
// =============================================================================

/**
 * Get a user by email with their membership, role, and permissions
 */
async function getUserWithRoles(email: string): Promise<SeededUser> {
  // First get the user
  const userResults = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (userResults.length === 0) {
    throw new Error(`User not found: ${email}`);
  }

  const user = userResults[0];
  // TypeScript knows this check is redundant, but it's for runtime safety
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  // Get memberships with roles and permissions
  const membershipResults = await db
    .select({
      membership: memberships,
      role: roles,
      permission: permissions,
    })
    .from(memberships)
    .leftJoin(roles, eq(memberships.roleId, roles.id))
    .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(memberships.userId, user.id));

  // Group permissions by membership
  type MembershipWithRole = NonNullable<SeededUser["memberships"]>[0];
  const membershipMap = new Map<string, MembershipWithRole>();

  for (const result of membershipResults) {
    const membershipId = result.membership.id;

    if (!membershipMap.has(membershipId)) {
      if (!result.role) {
        throw new Error(`Role not found for membership ${membershipId}`);
      }
      membershipMap.set(membershipId, {
        ...result.membership,
        role: {
          ...result.role,
          permissions: [],
        },
      });
    }

    if (result.permission) {
      const membership = membershipMap.get(membershipId);
      if (membership) {
        membership.role.permissions.push(result.permission);
      }
    }
  }

  return {
    ...user,
    memberships: Array.from(membershipMap.values()),
  };
}

/**
 * Get the seeded admin user (admin@dev.local)
 * Has full admin permissions for Austin Pinball Collective
 */
export async function getSeededAdmin(): Promise<SeededUser> {
  return getCachedSeedData("admin-user", async () => {
    return await getUserWithRoles("admin@dev.local");
  });
}

/**
 * Get the seeded member user (member@dev.local)
 * Has standard member permissions for Austin Pinball Collective
 */
export async function getSeededMember(): Promise<SeededUser> {
  return getCachedSeedData("member-user", async () => {
    return await getUserWithRoles("member@dev.local");
  });
}

/**
 * Get a seeded player user (player@dev.local)
 * Has minimal permissions for Austin Pinball Collective
 */
export async function getSeededPlayer(): Promise<SeededUser> {
  return getCachedSeedData("player-user", async () => {
    return await getUserWithRoles("player@dev.local");
  });
}

/**
 * Get a user by email (for legacy test users)
 */
export async function getSeededUserByEmail(email: string): Promise<SeededUser> {
  return getCachedSeedData(`user-${email}`, async () => {
    return await getUserWithRoles(email);
  });
}

// =============================================================================
// ORGANIZATION HELPERS - Access development organization
// =============================================================================

export type SeededOrganization = typeof organizations.$inferSelect & {
  locations?: (typeof locations.$inferSelect & {
    machines?: (typeof machines.$inferSelect & {
      model: typeof models.$inferSelect;
      issues?: (typeof issues.$inferSelect & {
        status: typeof issueStatuses.$inferSelect;
        priority: typeof priorities.$inferSelect;
        createdBy: typeof users.$inferSelect;
      })[];
    })[];
  })[];
};

/**
 * Get the seeded Austin Pinball Collective organization
 * Subdomain: "apc", with full location/machine/issue hierarchy
 */
export async function getSeededOrganization(): Promise<SeededOrganization> {
  return getCachedSeedData("apc-organization", async () => {
    // Get organization
    const orgResults = await db
      .select()
      .from(organizations)
      .where(eq(organizations.subdomain, "apc"))
      .limit(1);

    if (orgResults.length === 0) {
      throw new Error("Austin Pinball Collective organization not found");
    }

    const org = orgResults[0];
    // TypeScript knows this check is redundant, but it's for runtime safety
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!org) {
      throw new Error("Austin Pinball Collective organization not found");
    }

    // Get locations with machines and issues (simplified for now)
    const locationResults = await db
      .select()
      .from(locations)
      .where(eq(locations.organizationId, org.id));

    return {
      ...org,
      locations: locationResults,
    };
  });
}

// =============================================================================
// ISSUE HELPERS - Access realistic seeded issues (simplified for now)
// =============================================================================

export type SeededIssue = typeof issues.$inferSelect & {
  machine: typeof machines.$inferSelect & {
    model: typeof models.$inferSelect;
    location: typeof locations.$inferSelect;
  };
  status: typeof issueStatuses.$inferSelect;
  priority: typeof priorities.$inferSelect;
  createdBy: typeof users.$inferSelect;
  assignedTo?: typeof users.$inferSelect;
};

/**
 * Get a seeded issue by title (partial match)
 * Useful for testing specific issue scenarios from sample-issues.json
 */
export async function getSeededIssue(
  titleContains: string,
): Promise<SeededIssue> {
  return getCachedSeedData(`issue-${titleContains}`, async () => {
    const results = await db
      .select({
        issue: issues,
        machine: machines,
        model: models,
        location: locations,
        status: issueStatuses,
        priority: priorities,
        createdBy: users,
      })
      .from(issues)
      .leftJoin(machines, eq(issues.machineId, machines.id))
      .leftJoin(models, eq(machines.modelId, models.id))
      .leftJoin(locations, eq(machines.locationId, locations.id))
      .leftJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
      .leftJoin(priorities, eq(issues.priorityId, priorities.id))
      .leftJoin(users, eq(issues.createdById, users.id))
      .where(ilike(issues.title, `%${titleContains}%`))
      .limit(1);

    if (results.length === 0) {
      throw new Error(
        `Issue not found with title containing: ${titleContains}`,
      );
    }

    const result = results[0];
    // TypeScript knows this check is redundant, but it's for runtime safety
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!result) {
      throw new Error(
        `Issue not found with title containing: ${titleContains}`,
      );
    }

    if (
      !result.machine ||
      !result.model ||
      !result.location ||
      !result.status ||
      !result.priority ||
      !result.createdBy
    ) {
      throw new Error(
        `Incomplete issue data for title containing: ${titleContains}`,
      );
    }

    return {
      ...result.issue,
      machine: {
        ...result.machine,
        model: result.model,
        location: result.location,
      },
      status: result.status,
      priority: result.priority,
      createdBy: result.createdBy,
    };
  });
}

/**
 * Get multiple seeded issues for list testing
 */
export async function getSeededIssues(limit = 10): Promise<SeededIssue[]> {
  return getCachedSeedData(`issues-${String(limit)}`, async () => {
    const results = await db
      .select({
        issue: issues,
        machine: machines,
        model: models,
        location: locations,
        status: issueStatuses,
        priority: priorities,
        createdBy: users,
      })
      .from(issues)
      .leftJoin(machines, eq(issues.machineId, machines.id))
      .leftJoin(models, eq(machines.modelId, models.id))
      .leftJoin(locations, eq(machines.locationId, locations.id))
      .leftJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
      .leftJoin(priorities, eq(issues.priorityId, priorities.id))
      .leftJoin(users, eq(issues.createdById, users.id))
      .orderBy(desc(issues.createdAt))
      .limit(limit);

    return results
      .filter(
        (
          result,
        ): result is typeof result & {
          machine: NonNullable<typeof result.machine>;
          model: NonNullable<typeof result.model>;
          location: NonNullable<typeof result.location>;
          status: NonNullable<typeof result.status>;
          priority: NonNullable<typeof result.priority>;
          createdBy: NonNullable<typeof result.createdBy>;
        } =>
          !!result.machine &&
          !!result.model &&
          !!result.location &&
          !!result.status &&
          !!result.priority &&
          !!result.createdBy,
      )
      .map((result) => ({
        ...result.issue,
        machine: {
          ...result.machine,
          model: result.model,
          location: result.location,
        },
        status: result.status,
        priority: result.priority,
        createdBy: result.createdBy,
      }));
  });
}

// =============================================================================
// UTILITY HELPERS - Support functions for testing
// =============================================================================

/**
 * Get the organization ID for Austin Pinball Collective
 * Useful for scoping queries in multi-tenant tests
 */
export async function getSeededOrganizationId(): Promise<string> {
  const org = await getSeededOrganization();
  return org.id;
}

/**
 * Get issue statuses for Austin Pinball Collective
 */
export async function getSeededIssueStatuses(): Promise<IssueStatus[]> {
  return getCachedSeedData("issue-statuses", async () => {
    const orgId = await getSeededOrganizationId();
    return await db
      .select()
      .from(issueStatuses)
      .where(eq(issueStatuses.organizationId, orgId));
  });
}

/**
 * Get priorities for Austin Pinball Collective
 */
export async function getSeededPriorities(): Promise<Priority[]> {
  return getCachedSeedData("priorities", async () => {
    const orgId = await getSeededOrganizationId();
    return await db
      .select()
      .from(priorities)
      .where(eq(priorities.organizationId, orgId))
      .orderBy(priorities.order);
  });
}

// =============================================================================
// SUPABASE USER CONVERSION - Convert Drizzle users to Supabase format
// =============================================================================

interface SupabaseUser {
  id: string;
  email: string | undefined;
  email_confirmed_at?: string;
  phone: string | null;
  phone_confirmed_at: string | null;
  confirmed_at?: string;
  last_sign_in_at: string;
  app_metadata: {
    organizationId?: string | undefined;
    role?: string | undefined;
    permissions: string[];
  };
  user_metadata: {
    name: string | null;
    bio: string | null;
    profilePicture: string | null;
  };
  aud: string;
  role: string;
  created_at: string;
  updated_at: string;
}

/**
 * Convert a seeded user to Supabase user format for VitestTestWrapper
 * Handles the proper app_metadata structure that Supabase expects
 */
export function createSupabaseUserFromSeeded(user: SeededUser): SupabaseUser {
  const membership = user.memberships?.[0];
  const permissions = membership?.role.permissions.map((p) => p.name) ?? [];

  const result: SupabaseUser = {
    id: user.id,
    email: user.email ?? undefined,
    phone: null,
    phone_confirmed_at: null,
    last_sign_in_at: new Date().toISOString(),
    app_metadata: {
      permissions,
    },
    user_metadata: {
      name: user.name,
      bio: user.bio,
      profilePicture: user.profilePicture,
    },
    aud: "authenticated",
    role: "authenticated",
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  };

  // Only add optional properties if they have values
  if (user.emailVerified) {
    result.email_confirmed_at = user.emailVerified.toISOString();
    result.confirmed_at = user.emailVerified.toISOString();
  }

  if (membership?.organizationId) {
    result.app_metadata.organizationId = membership.organizationId;
  }

  if (membership?.role.name) {
    result.app_metadata.role = membership.role.name;
  }

  return result;
}

/**
 * Get admin user in Supabase format for VitestTestWrapper
 */
export async function getSeededAdminSupabaseUser(): Promise<SupabaseUser> {
  const adminUser = await getSeededAdmin();
  return createSupabaseUserFromSeeded(adminUser);
}

/**
 * Get member user in Supabase format for VitestTestWrapper
 */
export async function getSeededMemberSupabaseUser(): Promise<SupabaseUser> {
  const memberUser = await getSeededMember();
  return createSupabaseUserFromSeeded(memberUser);
}

/**
 * Get player user in Supabase format for VitestTestWrapper
 */
export async function getSeededPlayerSupabaseUser(): Promise<SupabaseUser> {
  const playerUser = await getSeededPlayer();
  return createSupabaseUserFromSeeded(playerUser);
}

// =============================================================================
// TESTING UTILITIES - Helper functions for test setup
// =============================================================================

/**
 * Setup common test data for auth integration tests
 * Returns users in both Drizzle and Supabase formats + organization data
 */
export async function setupAuthTestData() {
  const [organization, adminUser, memberUser, playerUser] = await Promise.all([
    getSeededOrganization(),
    getSeededAdmin(),
    getSeededMember(),
    getSeededPlayer(),
  ]);

  return {
    organization,
    users: {
      admin: {
        drizzle: adminUser,
        supabase: createSupabaseUserFromSeeded(adminUser),
      },
      member: {
        drizzle: memberUser,
        supabase: createSupabaseUserFromSeeded(memberUser),
      },
      player: {
        drizzle: playerUser,
        supabase: createSupabaseUserFromSeeded(playerUser),
      },
    },
  };
}

/**
 * Clean up function to call between test files
 * Clears cache - database connection is managed by Drizzle
 */
export function cleanupSeedDataHelpers(): void {
  clearSeedDataCache();
  // Note: Drizzle doesn't require explicit disconnect
}

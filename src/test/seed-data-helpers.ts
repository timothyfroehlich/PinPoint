/**
 * Seed Data Helpers - Access development seed data for testing
 *
 * These helpers provide access to the rich seed data created by prisma/seed-development.ts
 * for use in integration tests that need real auth context and relationships.
 *
 * Benefits over mocks:
 * - Real database constraints and relationships
 * - Proper Supabase user metadata structure
 * - Multi-tenant security boundaries
 * - Realistic data for integration testing
 */

/* eslint-disable @typescript-eslint/explicit-function-return-type */

import type { IssueStatus, Priority } from "@prisma/client";

import { createPrismaClient } from "~/server/db";

const testDb = createPrismaClient();

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
 * Get the seeded admin user (admin@dev.local)
 * Has full admin permissions for Austin Pinball Collective
 */
export async function getSeededAdmin() {
  return getCachedSeedData("admin-user", async () => {
    return await testDb.user.findFirstOrThrow({
      where: { email: "admin@dev.local" },
      include: {
        memberships: {
          include: {
            role: {
              include: {
                permissions: true,
              },
            },
          },
        },
      },
    });
  });
}

/**
 * Get the seeded member user (member@dev.local)
 * Has standard member permissions for Austin Pinball Collective
 */
export async function getSeededMember() {
  return getCachedSeedData("member-user", async () => {
    return await testDb.user.findFirstOrThrow({
      where: { email: "member@dev.local" },
      include: {
        memberships: {
          include: {
            role: {
              include: {
                permissions: true,
              },
            },
          },
        },
      },
    });
  });
}

/**
 * Get a seeded player user (player@dev.local)
 * Has minimal permissions for Austin Pinball Collective
 */
export async function getSeededPlayer() {
  return getCachedSeedData("player-user", async () => {
    return await testDb.user.findFirstOrThrow({
      where: { email: "player@dev.local" },
      include: {
        memberships: {
          include: {
            role: {
              include: {
                permissions: true,
              },
            },
          },
        },
      },
    });
  });
}

/**
 * Get a user by email (for legacy test users)
 */
export async function getSeededUserByEmail(email: string) {
  return getCachedSeedData(`user-${email}`, async () => {
    return await testDb.user.findFirstOrThrow({
      where: { email },
      include: {
        memberships: {
          include: {
            role: {
              include: {
                permissions: true,
              },
            },
          },
        },
      },
    });
  });
}

// =============================================================================
// ORGANIZATION HELPERS - Access development organization
// =============================================================================

/**
 * Get the seeded Austin Pinball Collective organization
 * Subdomain: "apc", with full location/machine/issue hierarchy
 */
export async function getSeededOrganization() {
  return getCachedSeedData("apc-organization", async () => {
    return await testDb.organization.findFirstOrThrow({
      where: { subdomain: "apc" },
      include: {
        locations: {
          include: {
            machines: {
              include: {
                model: true,
                issues: {
                  include: {
                    status: true,
                    priority: true,
                    createdBy: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  });
}

// =============================================================================
// ISSUE HELPERS - Access realistic seeded issues
// =============================================================================

/**
 * Get a seeded issue by title (partial match)
 * Useful for testing specific issue scenarios from sample-issues.json
 */
export async function getSeededIssue(titleContains: string) {
  return getCachedSeedData(`issue-${titleContains}`, async () => {
    return await testDb.issue.findFirstOrThrow({
      where: {
        title: { contains: titleContains, mode: "insensitive" },
      },
      include: {
        machine: {
          include: {
            model: true,
            location: true,
          },
        },
        status: true,
        priority: true,
        createdBy: true,
        assignedTo: true,
        comments: {
          include: {
            author: true,
          },
        },
        attachments: true,
      },
    });
  });
}

/**
 * Get multiple seeded issues for list testing
 */
export async function getSeededIssues(limit = 10) {
  return getCachedSeedData(`issues-${String(limit)}`, async () => {
    return await testDb.issue.findMany({
      take: limit,
      include: {
        machine: {
          include: {
            model: true,
            location: true,
          },
        },
        status: true,
        priority: true,
        createdBy: true,
        assignedTo: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  });
}

/**
 * Get issues by status for filtering tests
 */
export async function getSeededIssuesByStatus(statusName: string) {
  return getCachedSeedData(`issues-status-${statusName}`, async () => {
    return await testDb.issue.findMany({
      where: {
        status: {
          name: statusName,
        },
      },
      include: {
        machine: {
          include: {
            model: true,
            location: true,
          },
        },
        status: true,
        priority: true,
        createdBy: true,
        assignedTo: true,
      },
    });
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
    return await testDb.issueStatus.findMany({
      where: { organizationId: orgId },
    });
  });
}

/**
 * Get priorities for Austin Pinball Collective
 */
export async function getSeededPriorities(): Promise<Priority[]> {
  return getCachedSeedData("priorities", async () => {
    const orgId = await getSeededOrganizationId();
    return await testDb.priority.findMany({
      where: { organizationId: orgId },
      orderBy: { order: "asc" },
    });
  });
}

// =============================================================================
// SUPABASE USER CONVERSION - Convert Prisma users to Supabase format
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
 * Convert a seeded Prisma user to Supabase user format for VitestTestWrapper
 * Handles the proper app_metadata structure that Supabase expects
 */
export function createSupabaseUserFromSeeded(prismaUser: {
  id: string;
  email: string | null;
  emailVerified: Date | null;
  name: string | null;
  bio: string | null;
  profilePicture: string | null;
  createdAt: Date;
  updatedAt: Date;
  memberships?: {
    organizationId: string;
    role: {
      name: string;
      permissions: { name: string }[];
    };
  }[];
}): SupabaseUser {
  const membership = prismaUser.memberships?.[0];
  const permissions = membership?.role.permissions.map((p) => p.name) ?? [];

  const result: SupabaseUser = {
    id: prismaUser.id,
    email: prismaUser.email ?? undefined,
    phone: null,
    phone_confirmed_at: null,
    last_sign_in_at: new Date().toISOString(),
    app_metadata: {
      permissions,
    },
    user_metadata: {
      name: prismaUser.name,
      bio: prismaUser.bio,
      profilePicture: prismaUser.profilePicture,
    },
    aud: "authenticated",
    role: "authenticated",
    created_at: prismaUser.createdAt.toISOString(),
    updated_at: prismaUser.updatedAt.toISOString(),
  };

  // Only add optional properties if they have values
  if (prismaUser.emailVerified) {
    result.email_confirmed_at = prismaUser.emailVerified.toISOString();
    result.confirmed_at = prismaUser.emailVerified.toISOString();
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
 * Returns users in both Prisma and Supabase formats + organization data
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
        prisma: adminUser,
        supabase: createSupabaseUserFromSeeded(adminUser),
      },
      member: {
        prisma: memberUser,
        supabase: createSupabaseUserFromSeeded(memberUser),
      },
      player: {
        prisma: playerUser,
        supabase: createSupabaseUserFromSeeded(playerUser),
      },
    },
  };
}

/**
 * Clean up function to call between test files
 * Clears cache and closes database connection
 */
export async function cleanupSeedDataHelpers(): Promise<void> {
  clearSeedDataCache();
  await testDb.$disconnect();
}

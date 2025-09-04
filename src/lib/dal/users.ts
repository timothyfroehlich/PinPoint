/**
 * Users Data Access Layer
 * Direct database queries for Server Components
 * Includes user profiles, membership, and role queries
 */

import { cache } from "react";
import { and, eq, desc, or } from "drizzle-orm";
import { users, memberships, issues } from "~/server/db/schema";
import { withOrgRLS } from "~/server/db/utils/rls";
import { db } from "./shared";

/**
 * Get current authenticated user profile
 * Uses authenticated context with automatic organization scoping
 * Uses React 19 cache() for request-level memoization
 */
export const getCurrentUserProfile = cache(async (userId: string, organizationId: string) => {
  return withOrgRLS(db, organizationId, async tx => {
    if (!userId) {
      throw new Error("User ID required");
    }
    const userProfile = await tx.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        name: true,
        email: true,
        profile_picture: true,
        bio: true,
        email_notifications_enabled: true,
        push_notifications_enabled: true,
        notification_frequency: true,
        created_at: true,
        updated_at: true,
      },
    });
    if (!userProfile) {
      throw new Error("User profile not found");
    }
    return userProfile;
  });
});

/**
 * Get user by ID with organization scoping validation
 * Ensures user access is limited to organization members
 * Uses React 19 cache() for request-level memoization per userId
 */
export const getUserById = cache(async (userId: string, organizationId: string) => {
  return withOrgRLS(db, organizationId, async tx => {
    const membership = await tx.query.memberships.findFirst({
      where: and(
        eq(memberships.user_id, userId),
        eq(memberships.organization_id, organizationId),
      ),
    });
    if (!membership) {
      throw new Error("User not found or access denied");
    }
    const userRow = await tx.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        name: true,
        email: true,
        profile_picture: true,
        bio: true,
        created_at: true,
      },
    });
    if (!userRow) {
      throw new Error("User not found");
    }
    return userRow;
  });
});

/**
 * Get current user's membership and role information
 * Includes role permissions and organization context
 * Uses React 19 cache() for request-level memoization
 */
export const getCurrentUserMembership = cache(async (userId: string, organizationId: string) => {
  return withOrgRLS(db, organizationId, async tx => {
    if (!userId) {
      throw new Error("User ID required");
    }
    const membership = await tx.query.memberships.findFirst({
      where: and(
        eq(memberships.user_id, userId),
        eq(memberships.organization_id, organizationId),
      ),
      with: {
        role: {
          columns: {
            id: true,
            name: true,
            is_system: true,
            is_default: true,
          },
          with: {
            rolePermissions: {
              with: {
                permission: {
                  columns: {
                    id: true,
                    name: true,
                    description: true,
                  },
                },
              },
            },
          },
        },
        organization: {
          columns: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
      },
    });
    if (!membership) {
      throw new Error("User membership not found");
    }
    return membership;
  });
});

/**
 * Get user's permissions flattened for easy checking
 * Extracts permissions from role for authorization logic
 * Uses React 19 cache() for request-level memoization
 */
export const getCurrentUserPermissions = cache(async (userId: string, organizationId: string) => {
  const membership = await getCurrentUserMembership(userId, organizationId);

  const permissions = membership.role.rolePermissions.map(
    (rp) => rp.permission.name,
  );

  return permissions;
});

/**
 * Get user's activity statistics
 * Includes issue creation, assignment, and comment counts
 * Uses React 19 cache() for request-level memoization per userId
 */
export const getUserActivityStats = cache(async (currentUserId: string, organizationId: string, userId?: string) => {
  return withOrgRLS(db, organizationId, async tx => {
    if (!currentUserId) {
      throw new Error("Current user ID required");
    }
    const targetUserId = userId ?? currentUserId;

    const membership = await tx.query.memberships.findFirst({
      where: and(
        eq(memberships.user_id, targetUserId),
        eq(memberships.organization_id, organizationId),
      ),
    });
    if (!membership) {
      throw new Error("User not found or access denied");
    }

    const [issuesCreated, issuesAssigned] = await Promise.all([
      tx.query.issues.findMany({
        where: and(
          eq(issues.created_by_id, targetUserId),
          eq(issues.organization_id, organizationId),
        ),
        columns: { id: true },
      }),
      tx.query.issues.findMany({
        where: and(
          eq(issues.assigned_to_id, targetUserId),
          eq(issues.organization_id, organizationId),
        ),
        columns: { id: true },
      }),
    ]);

    return {
      issuesCreated: issuesCreated.length,
      issuesAssigned: issuesAssigned.length,
    };
  });
});

/**
 * Get users available for assignment within organization
 * Returns organization members suitable for issue assignment
 * Uses React 19 cache() for request-level memoization
 */
export const getAssignableUsers = cache(async (organizationId: string) => {
  return withOrgRLS(db, organizationId, async tx => {
    const assignableUsers = await tx.query.memberships.findMany({
      where: eq(memberships.organization_id, organizationId),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            profile_picture: true,
          },
        },
        role: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });
    return assignableUsers.map((membership) => ({
      ...membership.user,
      role: membership.role,
    }));
  });
});

/**
 * Get user's recent activity for dashboard/profile
 * Includes recently created and assigned issues
 * Uses React 19 cache() for request-level memoization per limit
 */
export const getUserRecentActivity = cache(
  async (currentUserId: string, organizationId: string, limit = 10, userId?: string) => {
    return withOrgRLS(db, organizationId, async tx => {
      if (!currentUserId) {
        throw new Error("Current user ID required");
      }
      const targetUserId = userId ?? currentUserId;
      const membership = await tx.query.memberships.findFirst({
        where: and(
          eq(memberships.user_id, targetUserId),
          eq(memberships.organization_id, organizationId),
        ),
      });
      if (!membership) {
        throw new Error("User not found or access denied");
      }
      const recentIssues = await tx.query.issues.findMany({
        where: and(
          eq(issues.organization_id, organizationId),
          or(
            eq(issues.created_by_id, targetUserId),
            eq(issues.assigned_to_id, targetUserId),
          ),
        ),
        with: {
          machine: {
            columns: { id: true, name: true },
            with: {
              model: {
                columns: { name: true },
              },
            },
          },
          status: {
            columns: { name: true },
          },
          priority: {
            columns: { name: true },
          },
        },
        orderBy: [desc(issues.updated_at)],
        limit,
      });
      return recentIssues;
    });
  },
);

/**
 * Check if current user has specific permission
 * Convenience function for authorization checks
 * Uses React 19 cache() for request-level memoization per permission
 */
export const userHasPermission = cache(async (userId: string, organizationId: string, permission: string) => {
  try {
    const permissions = await getCurrentUserPermissions(userId, organizationId);
    return permissions.includes(permission);
  } catch {
    return false;
  }
});

/**
 * Get user profile for display with safe public information
 * Includes organization context and basic statistics
 * Uses React 19 cache() for request-level memoization per userId
 */
export const getUserPublicProfile = cache(async (userId: string, organizationId: string) => {
  return withOrgRLS(db, organizationId, async tx => {
    const membership = await tx.query.memberships.findFirst({
      where: and(
        eq(memberships.user_id, userId),
        eq(memberships.organization_id, organizationId),
      ),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            profile_picture: true,
            bio: true,
            created_at: true,
          },
        },
        role: {
          columns: {
            name: true,
          },
        },
      },
    });
    if (!membership) {
      throw new Error("User not found or access denied");
    }
    const activityStats = await getUserActivityStats(userId, organizationId, userId);
    return { ...membership.user, role: membership.role, activityStats };
  });
});

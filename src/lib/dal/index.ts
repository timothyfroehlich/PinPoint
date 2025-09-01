/**
 * Data Access Layer (DAL) - Central exports
 * Direct database queries for Server Components
 * All functions use React 19 cache() for request-level memoization
 */

// =================================
// SHARED UTILITIES AND AUTH CONTEXT
// =================================
export {
  getServerAuthContext,
  requireAuthContext,
  getServerAuthContextWithRole,
  requireAuthContextWithRole,
  getPaginationParams,
  db,
  type PaginationOptions,
} from "./shared";

// =================================
// ORGANIZATIONS - Stats & Management
// =================================
export {
  getOrganizationById,
  getCurrentOrganization,
  getOrganizationStats,
  getOrganizationMembers,
  getOrganizationMemberCount,
  getOrganizationRoles,
  validateUserMembership,
  getOrganizationDashboardData,
} from "./organizations";

// =================================
// USERS - Profiles & Membership
// =================================
export {
  getCurrentUserProfile,
  getUserById,
  getCurrentUserMembership,
  getCurrentUserPermissions,
  getUserActivityStats,
  getAssignableUsers,
  getUserRecentActivity,
  userHasPermission,
  getUserPublicProfile,
} from "./users";

// =================================
// ISSUES - Core Business Logic
// =================================
export {
  getIssuesForOrg,
  getIssueById,
  getIssueStatusCounts,
  getRecentIssues,
  getIssueDashboardStats,
  getCurrentUserAssignedIssues,
  getCurrentUserCreatedIssues,
  getHighPriorityUnassignedIssues,
  getIssueTrendData,
} from "./issues";

// =================================
// MACHINES - Equipment Management
// =================================
export {
  getMachinesForOrg,
  getMachineById,
  getMachinesWithIssueCounts,
} from "./machines";

// =================================
// COMMON PATTERNS FOR SERVER COMPONENTS
// =================================

/**
 * Common dashboard data aggregation
 * Combines organization, user, and issue data for dashboard pages
 * Uses parallel queries for optimal performance
 */
export async function getDashboardData(): Promise<{
  organization: Awaited<ReturnType<typeof (await import("./organizations")).getCurrentOrganization>>;
  user: Awaited<ReturnType<typeof (await import("./users")).getCurrentUserProfile>>;
  issueStats: Awaited<ReturnType<typeof (await import("./issues")).getIssueDashboardStats>>;
  recentIssues: Awaited<ReturnType<typeof (await import("./issues")).getRecentIssues>>;
}> {
  const { getCurrentOrganization } = await import("./organizations");
  const { getCurrentUserProfile } = await import("./users");
  const { getIssueDashboardStats, getRecentIssues } = await import("./issues");

  const [orgData, userProfile, issueStats, recentIssues] = await Promise.all([
    getCurrentOrganization(),
    getCurrentUserProfile(),
    getIssueDashboardStats(),
    getRecentIssues(5),
  ]);

  return {
    organization: orgData,
    user: userProfile,
    issueStats,
    recentIssues,
  };
}

/**
 * Common user context data for layouts
 * Gets authentication context with role and organization info
 * Optimized for layout components needing user state
 */
export async function getUserContextData(): Promise<
  (Awaited<ReturnType<typeof (await import("./shared")).getServerAuthContextWithRole>> & {
    profile: Awaited<ReturnType<typeof (await import("./users")).getCurrentUserProfile>> | null;
  })
> {
  const { getServerAuthContextWithRole } = await import("./shared");
  const { getCurrentUserProfile } = await import("./users");

  const [authContext, userProfile] = await Promise.all([
    getServerAuthContextWithRole(),
    getCurrentUserProfile().catch(() => null), // Handle unauthenticated case
  ]);

  return {
    ...authContext,
    profile: userProfile,
  };
}

/**
 * Common organization overview data
 * Combines organization info with key statistics
 * Useful for admin pages and organization management
 */
export async function getOrganizationOverviewData(): Promise<{
  organization: Awaited<ReturnType<typeof (await import("./organizations")).getCurrentOrganization>>;
  stats: Awaited<ReturnType<typeof (await import("./organizations")).getOrganizationStats>>;
  memberCount: Awaited<ReturnType<typeof (await import("./organizations")).getOrganizationMemberCount>>;
  recentIssues: Awaited<ReturnType<typeof (await import("./issues")).getRecentIssues>>;
}> {
  const {
    getCurrentOrganization,
    getOrganizationStats,
    getOrganizationMemberCount,
  } = await import("./organizations");
  const { getRecentIssues } = await import("./issues");

  const [organization, stats, memberCount, recentIssues] = await Promise.all([
    getCurrentOrganization(),
    getOrganizationStats(),
    getOrganizationMemberCount(),
    getRecentIssues(10),
  ]);

  return {
    organization,
    stats,
    memberCount,
    recentIssues,
  };
}

// Utility type for DAL function return types
export type DALFunction<T extends (...args: unknown[]) => unknown> = T extends (
  ...args: unknown[]
) => Promise<infer R>
  ? R
  : never;

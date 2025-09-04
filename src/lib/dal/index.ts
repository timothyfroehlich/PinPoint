/**
 * Data Access Layer (DAL) - Central exports
 * Direct database queries for Server Components
 * All functions use React 19 cache() for request-level memoization
 */

// Static type imports for function signatures
import type {
  OrganizationResponse,
  UserProfileResponse,
  IssueWithRelationsResponse,
} from "~/lib/types";
import { transformKeysToCamelCase } from "~/lib/utils/case-transformers";

// Issue stats and dashboard types
interface IssueStats {
  totalCount: number;
  openCount: number;
  closedCount: number;
  urgentCount: number;
}



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
  organization: OrganizationResponse;
  user: UserProfileResponse;
  issueStats: IssueStats;
  recentIssues: IssueWithRelationsResponse[];
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
    organization: transformKeysToCamelCase(orgData) as OrganizationResponse,
    user: transformKeysToCamelCase(userProfile) as UserProfileResponse,
    issueStats: transformKeysToCamelCase(issueStats) as IssueStats,
    recentIssues: transformKeysToCamelCase(
      recentIssues,
    ) as IssueWithRelationsResponse[],
  };
}



/**
 * Common organization overview data
 * Combines organization info with key statistics
 * Useful for admin pages and organization management
 */
export async function getOrganizationOverviewData(): Promise<{
  organization: OrganizationResponse;
  stats: IssueStats;
  memberCount: number;
  recentIssues: IssueWithRelationsResponse[];
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
    organization: transformKeysToCamelCase(
      organization,
    ) as OrganizationResponse,
    stats: transformKeysToCamelCase(stats) as IssueStats,
    memberCount,
    recentIssues: transformKeysToCamelCase(
      recentIssues,
    ) as IssueWithRelationsResponse[],
  };
}

// Utility type for DAL function return types
export type DALFunction<T extends (...args: unknown[]) => unknown> = T extends (
  ...args: unknown[]
) => Promise<infer R>
  ? R
  : never;

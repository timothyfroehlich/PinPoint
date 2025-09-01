/**
 * Development Users Data Access Layer
 * Dev-only queries for test user management
 * Only available when dev features are enabled
 */

import "server-only";

import { cache } from "react";
import { eq, like } from "drizzle-orm";
import { getGlobalDatabaseProvider } from "~/server/db/provider";
import { users, memberships, roles, organizations } from "~/server/db/schema";
import { transformKeysToCamelCase } from "~/lib/utils/case-transformers";
import type { DevUserResponse } from "~/lib/types";

// Internal type for query result transformation
type DevUserRaw = {
  id: string;
  name: string | null;
  email: string;
  email_verified: boolean | null;
  image: string | null;
  bio: string | null;
  notification_frequency: "IMMEDIATE" | "DAILY" | "WEEKLY" | "NEVER";
  email_notifications_enabled: boolean;
  push_notifications_enabled: boolean;
  created_at: Date;
  updated_at: Date;
  roles: string[];
};

/**
 * Get development users for testing login
 * Only returns users with @example.com emails
 * Transforms to camelCase for API consumption
 */
export const getDevUsers = cache(async (): Promise<DevUserResponse[]> => {
  const db = getGlobalDatabaseProvider().getClient();

  // Query dev users using Drizzle with snake_case field access
  const devUsersRaw = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      email_verified: users.email_verified,
      image: users.image,
      bio: users.bio,
      notification_frequency: users.notification_frequency,
      email_notifications_enabled: users.email_notifications_enabled,
      push_notifications_enabled: users.push_notifications_enabled,
      created_at: users.created_at,
      updated_at: users.updated_at,
      // Join role data
      role_name: roles.name,
    })
    .from(users)
    .leftJoin(memberships, eq(memberships.user_id, users.id))
    .leftJoin(roles, eq(roles.id, memberships.role_id))
    .where(like(users.email, "%@example.com"));

  // Transform results to group by user and include role information
  const userMap = new Map<string, DevUserRaw>();
  for (const row of devUsersRaw) {
    const userId = row.id;
    if (!userMap.has(userId)) {
      userMap.set(userId, {
        id: row.id,
        name: row.name,
        email: row.email,
        email_verified: row.email_verified,
        image: row.image,
        bio: row.bio,
        notification_frequency: row.notification_frequency,
        email_notifications_enabled: row.email_notifications_enabled,
        push_notifications_enabled: row.push_notifications_enabled,
        created_at: row.created_at,
        updated_at: row.updated_at,
        roles: [],
      });
    }
    
    // Add role if it exists
    if (row.role_name) {
      const user = userMap.get(userId)!;
      user.roles.push(row.role_name);
    }
  }

  // Transform to camelCase for API response
  const devUsers = Array.from(userMap.values());
  return transformKeysToCamelCase(devUsers) as DevUserResponse[];
});

/**
 * Get organization for dev context
 * Returns first available organization for dev operations
 */
export const getDevOrganization = cache(async () => {
  const db = getGlobalDatabaseProvider().getClient();

  const organizationResults = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      subdomain: organizations.subdomain,
    })
    .from(organizations)
    .limit(1);

  return organizationResults[0] ?? null;
});
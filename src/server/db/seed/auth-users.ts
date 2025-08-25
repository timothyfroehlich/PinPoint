/**
 * Auth Users Seeding - Unified with Shared Utilities
 *
 * Supabase auth user creation with proper metadata.
 * Uses SeedMapper to eliminate switch statements and standardize patterns.
 */

// Node modules
import {
  createClient,
  type User,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { nanoid } from "nanoid";

// Internal utilities
import { createDrizzleClient } from "~/server/db/drizzle";
import { env } from "~/env.js";
import { SEED_TEST_IDS } from "./constants";
import {
  SeedLogger,
  SeedMapper,
  withErrorContext,
  createSeedResult,
  createFailedSeedResult,
  type SeedTarget,
  type SeedResult,
} from "./seed-utilities";

// Supabase error handling
import {
  safeSupabaseOperation,
  SupabaseErrorHandler,
  logSupabaseError,
  type SupabaseOperationContext,
} from "~/lib/supabase/error-handler";

// Schema imports
import { users, roles, memberships } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";

const db = createDrizzleClient();

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface UserData {
  name: string;
  email: string;
  role: string;
  bio: string;
}

interface CreateUserParams {
  email: string;
  organization_id: string;
  role: string;
  profile: {
    name: string;
    bio: string;
  };
}

interface BatchProcessResult {
  successCount: number;
  createdCount: number;
  existedCount: number;
  errorCount: number;
  errors: string[];
}

// ============================================================================
// Standard User Data
// ============================================================================

/**
 * Primary organization users - for multi-tenant isolation testing
 */
const PRIMARY_ORG_USERS: UserData[] = [
  {
    name: "Tim Froehlich",
    email: "tim.froehlich@example.com",
    role: "Admin",
    bio: "Admin user for primary org testing.",
  },
  {
    name: "Harry Williams",
    email: "harry.williams@example.com",
    role: "Member",
    bio: "Member user for primary org testing.",
  },
];

/**
 * Competitor organization users - separate set for isolation testing
 */
const COMPETITOR_ORG_USERS: UserData[] = [
  {
    name: "Escher Lefkoff",
    email: "escher.lefkoff@example.com",
    role: "Member",
    bio: "Member user for competitor org testing.",
  },
];

/**
 * Combined user set for backwards compatibility
 * All users from both organizations
 */
const STANDARD_USERS: UserData[] = [
  ...PRIMARY_ORG_USERS,
  ...COMPETITOR_ORG_USERS,
];

// ============================================================================
// User ID Mapping Utilities
// ============================================================================

/**
 * Get organization-specific user list for multi-tenant isolation
 */
function getUsersForOrganization(organizationId: string): UserData[] {
  if (organizationId === SEED_TEST_IDS.ORGANIZATIONS.primary) {
    return PRIMARY_ORG_USERS;
  } else if (organizationId === SEED_TEST_IDS.ORGANIZATIONS.competitor) {
    return COMPETITOR_ORG_USERS;
  } else {
    // For non-test orgs, use all users for backwards compatibility
    return STANDARD_USERS;
  }
}

/**
 * Get user ID for email using mapping object instead of switch statement
 */
function getUserIdForEmail(email: string): string {
  const mapping: Record<string, string> = {
    "tim.froehlich@example.com": SEED_TEST_IDS.USERS.ADMIN,
    "harry.williams@example.com": SEED_TEST_IDS.USERS.MEMBER1,
    "escher.lefkoff@example.com": SEED_TEST_IDS.USERS.MEMBER2,
  };

  // eslint-disable-next-line security/detect-object-injection
  return mapping[email] ?? nanoid();
}

// ============================================================================
// Supabase Auth Utilities
// ============================================================================

/**
 * Create Supabase service role client for admin operations
 */
function createServiceRoleClient(): SupabaseClient {
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing required Supabase environment variables: SUPABASE_URL and SUPABASE_SECRET_KEY",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

/**
 * Get existing Supabase auth users by email with proper error handling
 */
async function getExistingAuthUsers(): Promise<Map<string, User>> {
  const supabase = createServiceRoleClient();

  const context: SupabaseOperationContext = {
    operation: "listUsers",
    metadata: { purpose: "seed_data_validation" },
  };

  const result = await safeSupabaseOperation(
    () => supabase.auth.admin.listUsers(),
    context,
    (data): data is { users: User[] } =>
      typeof data === "object" &&
      data !== null &&
      "users" in data &&
      Array.isArray((data as any).users),
  );

  if (!result.success) {
    logSupabaseError(result.error, SeedLogger);
    SupabaseErrorHandler.throwStructuredError(result);
  }

  const userMap = new Map<string, User>();
  for (const user of result.data.users) {
    if (user.email) {
      userMap.set(user.email, user);
    }
  }

  return userMap;
}

/**
 * Create Supabase auth user using idempotent approach
 */
async function upsertSupabaseAuthUser(
  params: CreateUserParams,
  existingUsers: Map<string, User>,
): Promise<{ success: boolean; user_id: string; wasCreated: boolean }> {
  const supabase = createServiceRoleClient();

  // Get the predetermined static ID for this user
  const staticUserId = getUserIdForEmail(params.email);

  // Check if user already exists
  const existingUser = existingUsers.get(params.email);
  if (existingUser) {
    return {
      success: true,
      user_id: existingUser.id,
      wasCreated: false,
    };
  }

  // Create new user with predetermined static ID
  const context: SupabaseOperationContext = {
    operation: "createUser",
    email: params.email,
    organizationId: params.organization_id,
    metadata: {
      staticUserId,
      role: params.role,
      purpose: "seed_user_creation",
    },
  };

  const result = await safeSupabaseOperation(
    () =>
      supabase.auth.admin.createUser({
        id: staticUserId, // Specify the static ID we want
        email: params.email,
        password: "dev-login-123",
        email_confirm: true,
        user_metadata: {
          name: params.profile.name,
          bio: params.profile.bio,
          dev_user: true,
          environment: "development",
        },
        app_metadata: {
          organization_id: params.organization_id,
          role: params.role,
          dev_created: true,
          created_via: "seeding",
        },
      }),
    context,
    (data): data is { user: User } =>
      typeof data === "object" &&
      data !== null &&
      "user" in data &&
      typeof (data as { user: unknown }).user === "object" &&
      (data as { user: unknown }).user !== null,
  );

  if (!result.success) {
    logSupabaseError(result.error, SeedLogger);
    SupabaseErrorHandler.throwStructuredError(result);
  }

  return {
    success: true,
    user_id: result.data.user.id, // Should now be the static ID we specified
    wasCreated: true,
  };
}

// ============================================================================
// User Record Validation
// ============================================================================

/**
 * Wait for database User record to exist (created by auth trigger)
 */
async function waitForUserRecord(
  user_id: string,
  email: string,
): Promise<boolean> {
  const MAX_ATTEMPTS = 100; // 5 seconds @ 50ms intervals
  const POLL_INTERVAL = 50;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, user_id))
        .limit(1);

      if (existingUser.length > 0) {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    } catch (error) {
      // Log query errors but continue trying
      SeedLogger.warn(
        `AUTH: Query error while waiting for user record ${user_id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  SeedLogger.error(
    "AUTH",
    `Auth trigger failed for ${email} - User record not created`,
  );
  return false;
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Process batch of users with unified error handling
 */
async function processBatchUsers(
  userList: UserData[],
  organization_id: string,
): Promise<BatchProcessResult> {
  let successCount = 0;
  let createdCount = 0;
  let existedCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // Get existing auth users
  const existingUsers = await getExistingAuthUsers();

  // Get existing database users and memberships
  const existingDbUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users);
  const dbUsersMap = new Map(existingDbUsers.map((u) => [u.email ?? "", u.id]));

  const existingMemberships = await db
    .select({ user_id: memberships.user_id })
    .from(memberships)
    .where(eq(memberships.organization_id, organization_id));
  const membershipSet = new Set(existingMemberships.map((m) => m.user_id));

  const membershipsToCreate: {
    id: string;
    user_id: string;
    role_id: string;
    organization_id: string;
  }[] = [];

  for (const userData of userList) {
    try {
      // Upsert Supabase auth user
      const authResult = await upsertSupabaseAuthUser(
        {
          email: userData.email,
          organization_id,
          role: userData.role,
          profile: {
            name: userData.name,
            bio: userData.bio,
          },
        },
        existingUsers,
      );

      // Track creation vs existing
      if (authResult.wasCreated) {
        createdCount++;
        const userRecordExists = await waitForUserRecord(
          authResult.user_id,
          userData.email,
        );

        if (!userRecordExists) {
          const error = `Auth trigger failed for ${userData.email}`;
          errorCount++;
          errors.push(error);
          continue;
        }

        dbUsersMap.set(userData.email, authResult.user_id);
      } else {
        existedCount++;
        if (!dbUsersMap.has(userData.email)) {
          const userRecordExists = await waitForUserRecord(
            authResult.user_id,
            userData.email,
          );
          if (!userRecordExists) {
            const error = `Existing auth user ${userData.email} missing User record`;
            errorCount++;
            errors.push(error);
            continue;
          }
          dbUsersMap.set(userData.email, authResult.user_id);
        }
      }

      // Check if membership needs to be created
      if (!membershipSet.has(authResult.user_id)) {
        const roleResults = await db
          .select({ id: roles.id })
          .from(roles)
          .where(
            and(
              eq(roles.name, userData.role),
              eq(roles.organization_id, organization_id),
            ),
          )
          .limit(1);

        if (roleResults.length > 0 && roleResults[0]) {
          membershipsToCreate.push({
            id: SeedMapper.getMembershipId(userData.email, organization_id),
            user_id: authResult.user_id,
            organization_id,
            role_id: roleResults[0].id,
          });
          membershipSet.add(authResult.user_id);
        }
      }

      successCount++;
    } catch (error) {
      errorCount++;

      // Use structured error handling instead of generic string conversion
      const context: SupabaseOperationContext = {
        operation: "processBatchUser",
        email: userData.email,
        organizationId: organization_id,
        metadata: { role: userData.role },
      };

      const structuredError = SupabaseErrorHandler.createStructuredError(
        error,
        context,
      );
      logSupabaseError(structuredError, SeedLogger);
      errors.push(
        `${userData.email}: ${structuredError.type} - ${structuredError.message}`,
      );
    }
  }

  // Batch create memberships
  if (membershipsToCreate.length > 0) {
    try {
      await db
        .insert(memberships)
        .values(membershipsToCreate)
        .onConflictDoNothing();
    } catch (error) {
      errorCount += membershipsToCreate.length;

      // Use structured error handling for membership creation
      const context: SupabaseOperationContext = {
        operation: "batchCreateMemberships",
        organizationId: organization_id,
        metadata: {
          membershipCount: membershipsToCreate.length,
          emails: membershipsToCreate
            .map((_, i) => userList[i]?.email)
            .filter(Boolean),
        },
      };

      const structuredError = SupabaseErrorHandler.createStructuredError(
        error,
        context,
      );
      logSupabaseError(structuredError, SeedLogger);
      errors.push(
        `Batch membership creation: ${structuredError.type} - ${structuredError.message}`,
      );
    }
  }

  return { successCount, createdCount, existedCount, errorCount, errors };
}

// ============================================================================
// User Management
// ============================================================================

/**
 * Delete existing dev users for clean preview environment resets
 */
async function deleteExistingDevUsers(userList: UserData[]): Promise<void> {
  const supabase = createServiceRoleClient();

  for (const userData of userList) {
    const userContext: SupabaseOperationContext = {
      operation: "deleteDevUser",
      email: userData.email,
      metadata: { purpose: "preview_environment_cleanup" },
    };

    try {
      // List users with proper error handling
      const listResult = await safeSupabaseOperation(
        () => supabase.auth.admin.listUsers(),
        userContext,
      );

      if (!listResult.success) {
        logSupabaseError(listResult.error, SeedLogger);
        continue; // Continue with next user
      }

      const listData = listResult.data as { users?: User[] };
      const existingUser = listData.users?.find(
        (u: User) => u.email === userData.email,
      );

      if (existingUser) {
        // Delete from database first (cascades to memberships)
        try {
          await db.delete(users).where(eq(users.id, existingUser.id));
        } catch (error) {
          // Log database deletion error but continue
          SeedLogger.warn(
            `AUTH: Database deletion failed for user ${userData.email}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        // Delete from Supabase auth with proper error handling
        const deleteResult = await safeSupabaseOperation(
          () => supabase.auth.admin.deleteUser(existingUser.id),
          { ...userContext, userId: existingUser.id },
        );

        if (!deleteResult.success) {
          logSupabaseError(deleteResult.error, SeedLogger);
        }
      }
    } catch (error) {
      // Log unexpected errors but continue with other users
      const structuredError = SupabaseErrorHandler.createStructuredError(
        error,
        userContext,
      );
      logSupabaseError(structuredError, SeedLogger);
    }
  }
}

/**
 * Create users directly in database for PostgreSQL-only mode
 */
async function createUsersDirectly(
  userList: UserData[],
  organization_id: string,
): Promise<void> {
  // Create users directly in the users table
  const usersToCreate = userList.map((userData) => ({
    id: getUserIdForEmail(userData.email),
    email: userData.email,
    name: userData.name,
    bio: userData.bio,
    created_at: new Date(),
    updated_at: new Date(),
  }));

  await db.insert(users).values(usersToCreate).onConflictDoNothing();

  // Create memberships
  const membershipsToCreate: {
    id: string;
    user_id: string;
    organization_id: string;
    role_id: string;
  }[] = [];

  for (const userData of userList) {
    const roleResults = await db
      .select({ id: roles.id })
      .from(roles)
      .where(
        and(
          eq(roles.name, userData.role),
          eq(roles.organization_id, organization_id),
        ),
      )
      .limit(1);

    if (roleResults.length > 0 && roleResults[0]) {
      membershipsToCreate.push({
        id: SeedMapper.getMembershipId(userData.email, organization_id),
        user_id: getUserIdForEmail(userData.email),
        organization_id,
        role_id: roleResults[0].id,
      });
    }
  }

  if (membershipsToCreate.length > 0) {
    await db
      .insert(memberships)
      .values(membershipsToCreate)
      .onConflictDoNothing();
  }
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Main auth users seeding function with unified patterns
 */
export async function seedAuthUsers(
  organization_id: string,
  target: SeedTarget,
): Promise<SeedResult<UserData[]>> {
  const startTime = Date.now();
  const users = getUsersForOrganization(organization_id);

  try {
    if (target === "local:pg") {
      // PostgreSQL-only mode
      await withErrorContext(
        "AUTH_USERS",
        "create users directly in database",
        () => createUsersDirectly(users, organization_id),
      );

      SeedLogger.success(
        `Created ${String(users.length)} users directly in database`,
      );
      return createSeedResult(users, users.length, startTime);
    }

    // Supabase modes
    if (target === "preview") {
      await withErrorContext(
        "AUTH_USERS",
        "delete existing dev users for preview reset",
        () => deleteExistingDevUsers(users),
      );
    }

    // Process users in batch
    const results = await withErrorContext(
      "AUTH_USERS",
      "process batch users with Supabase auth",
      () => processBatchUsers(users, organization_id),
    );

    if (results.errorCount > 0) {
      SeedLogger.error(
        "AUTH",
        `${String(results.errorCount)} users failed: ${results.errors.join(", ")},`,
      );
      return createFailedSeedResult(
        new Error(`${String(results.errorCount)} auth failures`),
        startTime,
      );
    }

    SeedLogger.success(
      `Processed ${String(results.successCount)} users (${String(results.createdCount)} created, ${String(results.existedCount)} existed)`,
    );
    return createSeedResult(users, results.createdCount, startTime);
  } catch (error) {
    SeedLogger.error("AUTH_USERS", error);
    return createFailedSeedResult(error, startTime);
  }
}

/**
 * Auth Users Seeding
 *
 * Supabase auth user creation with proper metadata.
 * Database profiles are created automatically by auth trigger.
 *
 * Compatible with existing dev login system - preserves one-click login experience.
 */

import { createClient, type User } from "@supabase/supabase-js";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

import { createDrizzleClient } from "~/server/db/drizzle";
import { users, roles, memberships } from "~/server/db/schema";

const db = createDrizzleClient();

export interface UserData {
  name: string;
  email: string;
  role: string;
  bio: string;
}

type SeedTarget = "local:pg" | "local:sb" | "preview";

/**
 * Standard user set for all environments
 * Consistent across development, preview, and production
 */
const STANDARD_USERS: UserData[] = [
  // Dev Users (3) - for development and testing
  {
    name: "Dev Admin",
    email: "admin@dev.local",
    role: "Admin",
    bio: "Development admin test account.",
  },
  {
    name: "Dev Member",
    email: "member@dev.local",
    role: "Member",
    bio: "Development member test account.",
  },
  {
    name: "Dev Player",
    email: "player@dev.local",
    role: "Member",
    bio: "Development player test account.",
  },

  // Pinball Personalities (4) - industry figures for realistic data
  {
    name: "Roger Sharpe",
    email: "roger.sharpe@pinpoint.dev",
    role: "Admin",
    bio: "Pinball ambassador and historian.",
  },
  {
    name: "Gary Stern",
    email: "gary.stern@pinpoint.dev",
    role: "Member",
    bio: "Founder of Stern Pinball.",
  },
  {
    name: "Steve Ritchie",
    email: "steve.ritchie@pinpoint.dev",
    role: "Member",
    bio: "Legendary pinball designer.",
  },
  {
    name: "Keith Elwin",
    email: "keith.elwin@pinpoint.dev",
    role: "Member",
    bio: "Modern pinball design innovator.",
  },
];

interface CreateUserParams {
  email: string;
  organizationId: string;
  role: string;
  profile: {
    name: string;
    bio: string;
  };
}

/**
 * Create Supabase service role client for admin operations
 */
function createServiceRoleClient() {
  const supabaseUrl = process.env["SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SECRET_KEY"];

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing required Supabase environment variables: SUPABASE_URL and SUPABASE_SECRET_KEY",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

/**
 * Get existing Supabase auth users by email
 * Returns a map of email -> user for efficient lookups
 */
async function getExistingAuthUsers(): Promise<Map<string, User>> {
  const supabase = createServiceRoleClient();
  const { data: userList, error } = await supabase.auth.admin.listUsers();

  if (error) {
    throw new Error(`Failed to list existing users: ${error.message}`);
  }

  const userMap = new Map();
  for (const user of userList.users) {
    if (user.email) {
      userMap.set(user.email, user);
    }
  }

  return userMap;
}

/**
 * Create Supabase auth user using idempotent approach
 * Check first, create only if missing
 */
async function upsertSupabaseAuthUser(
  params: CreateUserParams,
  existingUsers: Map<string, User>,
): Promise<{ success: boolean; userId: string; wasCreated: boolean }> {
  const supabase = createServiceRoleClient();

  // Check if user already exists
  const existingUser = existingUsers.get(params.email);
  if (existingUser) {
    console.log(
      `[AUTH] ✓ User ${params.email} already exists: ${existingUser.id}`,
    );

    // TODO: Could update metadata here if needed
    // await supabase.auth.admin.updateUserById(existingUser.id, { ... })

    return {
      success: true,
      userId: existingUser.id,
      wasCreated: false,
    };
  }

  // User doesn't exist, create new one
  console.log(`[AUTH] Creating new user: ${params.email}`);
  const { data, error } = await supabase.auth.admin.createUser({
    email: params.email,
    password: "dev-login-123", // Matches existing DEV_PASSWORD for dev login compatibility
    email_confirm: true, // Skip email verification for development
    user_metadata: {
      name: params.profile.name,
      bio: params.profile.bio,
      dev_user: true, // Compatible with dev detection
      environment: "development",
    },
    app_metadata: {
      organization_id: params.organizationId, // Critical for multi-tenancy and RLS
      role: params.role, // For dev panel display
      dev_created: true, // Mark as dev user
      created_via: "seeding", // Audit trail
    },
  });

  if (error || !data.user) {
    throw new Error(
      `Failed to create user ${params.email}: ${error?.message || "No user data returned"}`,
    );
  }

  console.log(`[AUTH] ✓ Created new user: ${params.email} (${data.user.id})`);
  return {
    success: true,
    userId: data.user.id,
    wasCreated: true,
  };
}

// Constants for polling configuration (configurable via environment variables)
const USER_RECORD_POLL_TIMEOUT_MS = process.env.USER_RECORD_POLL_TIMEOUT_MS
  ? parseInt(process.env.USER_RECORD_POLL_TIMEOUT_MS, 10)
  : 5000; // 5 seconds max wait for auth trigger (configurable via env)
const USER_RECORD_POLL_INTERVAL_MS = 50; // Check every 50ms (20 times per second)
const MAX_POLL_ATTEMPTS = Math.floor(
  USER_RECORD_POLL_TIMEOUT_MS / USER_RECORD_POLL_INTERVAL_MS,
);

/**
 * Wait for database User record to exist (created by auth trigger)
 * This validates that the auth trigger is working correctly
 */
async function waitForUserRecord(
  userId: string,
  email: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    try {
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (existingUser.length > 0) {
        return true;
      }

      // Wait before next attempt
      await new Promise((resolve) =>
        setTimeout(resolve, USER_RECORD_POLL_INTERVAL_MS),
      );
    } catch (error) {
      console.warn(`[AUTH] Error checking for user record ${email}:`, error);
      // Continue trying despite query errors
    }
  }

  console.error(
    `[AUTH] ❌ CRITICAL: Auth trigger failed - User record not created after ${USER_RECORD_POLL_TIMEOUT_MS}ms for ${email}. Please check if the database trigger 'handle_new_user()' is properly configured and verify database connectivity. Refer to the documentation for troubleshooting steps.`,
  );
  return false;
}

/**
 * Process batch of users with idempotent upsert approach and optimized database operations
 */
async function processBatchUsers(
  userList: UserData[],
  organizationId: string,
): Promise<{
  successCount: number;
  createdCount: number;
  existedCount: number;
  errorCount: number;
  errors: string[];
}> {
  let successCount = 0;
  let createdCount = 0;
  let existedCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // Get all existing auth users once upfront (efficient)
  console.log("[AUTH] Checking existing auth users...");
  let existingUsers: Map<string, User>;
  try {
    existingUsers = await getExistingAuthUsers();
    console.log(`[AUTH] Found ${existingUsers.size} existing auth users`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[AUTH] Failed to get existing users: ${errorMessage}`);
    return {
      successCount: 0,
      createdCount: 0,
      existedCount: 0,
      errorCount: userList.length,
      errors: [errorMessage],
    };
  }

  // Get existing database users and memberships in batch
  const existingDbUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users);
  const dbUsersMap = new Map(existingDbUsers.map((u) => [u.email ?? "", u.id]));

  const existingMemberships = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.organizationId, organizationId));
  const membershipSet = new Set(existingMemberships.map((m) => m.userId));

  // Process each user with optimized database operations
  const membershipsToCreate: {
    id: string;
    userId: string;
    roleId: string;
    organizationId: string;
  }[] = [];
  const usersToCreateInDb: string[] = [];

  for (const userData of userList) {
    try {
      // Upsert Supabase auth user (idempotent)
      const authResult = await upsertSupabaseAuthUser(
        {
          email: userData.email,
          organizationId,
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
        // Wait for auth trigger to create User record - this MUST work
        const userRecordExists = await waitForUserRecord(
          authResult.userId,
          userData.email,
        );

        if (!userRecordExists) {
          // Auth trigger failed - this is a critical infrastructure problem
          const error = `Auth trigger failed to create User record for ${userData.email}. This indicates a problem with the database trigger 'handle_new_user()'. Check: 1) Trigger exists and is enabled, 2) Database connectivity, 3) Trigger function permissions.`;
          console.error(`[AUTH] ❌ CRITICAL: ${error}`);
          errorCount++;
          errors.push(error);
          continue; // Skip this user and continue with others
        }

        dbUsersMap.set(userData.email, authResult.userId); // Update map
      } else {
        existedCount++;
        // Existing user should already have a User record
        if (!dbUsersMap.has(userData.email)) {
          // Verify existing auth user has corresponding User record
          const userRecordExists = await waitForUserRecord(
            authResult.userId,
            userData.email,
          );
          if (!userRecordExists) {
            const error = `Existing auth user ${userData.email} missing User record. Database inconsistency detected.`;
            console.error(`[AUTH] ❌ CRITICAL: ${error}`);
            errorCount++;
            errors.push(error);
            continue; // Skip this user and continue with others
          }
          dbUsersMap.set(userData.email, authResult.userId); // Update map
        }
      }

      // Check if membership needs to be created
      if (!membershipSet.has(authResult.userId)) {
        // Find the role for membership
        const roleResults = await db
          .select({ id: roles.id })
          .from(roles)
          .where(
            and(
              eq(roles.name, userData.role),
              eq(roles.organizationId, organizationId),
            ),
          )
          .limit(1);

        if (roleResults.length > 0 && roleResults[0]) {
          membershipsToCreate.push({
            id: nanoid(),
            userId: authResult.userId,
            organizationId,
            roleId: roleResults[0].id,
          });
          membershipSet.add(authResult.userId); // Update set
        }
      }

      successCount++;
      console.log(
        `[AUTH] ✅ Successfully processed user: ${userData.name} (${userData.email})`,
      );
    } catch (error) {
      errorCount++;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const fullError = `Error processing ${userData.email}: ${errorMessage}`;
      errors.push(fullError);
      console.error(`[AUTH] ❌ ${fullError}`);
    }
  }

  // No manual User record creation - auth trigger must handle this
  // If we reach this point with usersToCreateInDb having entries,
  // it means auth triggers are not working correctly
  if (usersToCreateInDb.length > 0) {
    const error = `CRITICAL: Auth triggers failed for ${usersToCreateInDb.length} users. Database infrastructure needs fixing. Run: 1) Check 'SELECT * FROM information_schema.triggers WHERE trigger_name = \\'on_auth_user_created\\';', 2) Verify 'handle_new_user()' function exists, 3) Test database connectivity.`;
    console.error(`[AUTH] ❌ ${error}`);
    errorCount += usersToCreateInDb.length;
    errors.push(error);
  }

  // Batch create memberships
  if (membershipsToCreate.length > 0) {
    try {
      await db
        .insert(memberships)
        .values(membershipsToCreate)
        .onConflictDoNothing();
      console.log(
        `[AUTH] ✅ Created ${membershipsToCreate.length.toString()} memberships via batch insert`,
      );
    } catch (error) {
      console.error(`[AUTH] ❌ Failed to batch create memberships:`, error);
      errorCount += membershipsToCreate.length;
      errors.push(
        `Batch membership creation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { successCount, createdCount, existedCount, errorCount, errors };
}

/**
 * Delete existing dev users from both Supabase auth and database (DEV + PREVIEW)
 * This aggressive reset is enabled in development and preview environments for clean demos.
 * Production environments preserve existing users for safety.
 */
async function deleteExistingDevUsers(userList: UserData[]): Promise<void> {
  const supabase = createServiceRoleClient();

  console.log(
    "[AUTH] 🗑️  DEV/PREVIEW: Deleting existing dev users for clean reset...",
  );

  for (const userData of userList) {
    try {
      // Get user by email first
      const { data: userList, error: listError } =
        await supabase.auth.admin.listUsers();

      if (listError) {
        console.warn(
          `[AUTH] Could not list users to find ${userData.email}:`,
          listError.message,
        );
        continue;
      }

      const existingUser = userList.users.find(
        (u) => u.email === userData.email,
      );

      if (existingUser) {
        // Delete from database first (cascades to memberships)
        try {
          await db.delete(users).where(eq(users.id, existingUser.id));
          console.log(`[AUTH] 🗑️  Deleted database user: ${userData.email}`);
        } catch (dbError) {
          console.warn(
            `[AUTH] Could not delete database user ${userData.email}:`,
            dbError,
          );
        }

        // Delete from Supabase auth
        const { error: deleteError } = await supabase.auth.admin.deleteUser(
          existingUser.id,
        );

        if (deleteError) {
          console.warn(
            `[AUTH] Could not delete auth user ${userData.email}:`,
            deleteError.message,
          );
        } else {
          console.log(`[AUTH] 🗑️  Deleted auth user: ${userData.email}`);
        }
      }
    } catch (error) {
      console.warn(`[AUTH] Error during cleanup of ${userData.email}:`, error);
      // Continue with other users even if one fails
    }
  }

  console.log("[AUTH] ✅ User cleanup complete");
}

/**
 * Main auth users seeding function
 */
export async function seedAuthUsers(
  organizationId: string,
  target: SeedTarget,
): Promise<void> {
  const startTime = Date.now();
  const users = STANDARD_USERS;
  console.log(
    `[AUTH] Creating ${users.length.toString()} auth users for organization ${organizationId}...`,
  );

  try {
    // PREVIEW: Aggressive reset for clean demos
    // LOCAL/OTHER: Preserve existing users for safety
    if (target === "preview") {
      console.log(
        "[AUTH] 🔄 PREVIEW ENVIRONMENT: Performing aggressive user reset for clean demos",
      );
      await deleteExistingDevUsers(users);
    } else {
      console.log(
        "[AUTH] 🔒 LOCAL/PRODUCTION MODE: Preserving existing users, creating only missing ones",
      );
    }

    // Process users in batch
    const results = await processBatchUsers(users, organizationId);

    // Report results with detailed breakdown
    const duration = Date.now() - startTime;
    console.log(
      `[AUTH] ✅ Auth user seeding complete: ${results.successCount.toString()} total processed in ${duration}ms`,
    );
    console.log(
      `[AUTH]   📊 Created: ${results.createdCount.toString()}, Already existed: ${results.existedCount.toString()}, Errors: ${results.errorCount.toString()}`,
    );

    if (results.errors.length > 0) {
      console.error("[AUTH] Errors:");
      results.errors.forEach((error) => console.error(`[AUTH]   ${error}`));

      if (results.errorCount > 0) {
        throw new Error(
          `Auth trigger failures: ${results.errorCount}/${users.length} users failed`,
        );
      }
    }

    console.log("[AUTH] 🔑 Development Login Credentials:");
    console.log("[AUTH]   Password: dev-login-123 (for all dev users)");
    console.log(
      "[AUTH]   Compatible with existing dev login panel - one-click login preserved",
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[AUTH] ❌ Auth user seeding failed: ${errorMessage}`);
    throw error;
  }
}

/**
 * Auth Users Seeding
 *
 * Supabase auth user creation with proper metadata.
 * Database profiles are created automatically by auth trigger.
 *
 * Compatible with existing dev login system - preserves one-click login experience.
 */

import { createClient } from "@supabase/supabase-js";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

import { createDrizzleClient } from "~/server/db/drizzle";
import { users, roles, memberships } from "~/server/db/schema";
import { isProduction } from "~/lib/environment";

const db = createDrizzleClient();

export interface UserData {
  name: string;
  email: string;
  role: string;
  bio: string;
}

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
 * Create database membership linking user to organization role
 */
async function createUserMembership(
  userId: string,
  organizationId: string,
  roleName: string,
): Promise<void> {
  // Find the role created by infrastructure.ts
  const roleResults = await db
    .select()
    .from(roles)
    .where(
      and(eq(roles.name, roleName), eq(roles.organizationId, organizationId)),
    )
    .limit(1);

  if (roleResults.length === 0) {
    throw new Error(
      `Role ${roleName} not found for organization ${organizationId}`,
    );
  }

  const role =
    roleResults[0] ??
    (() => {
      throw new Error(
        `Role ${roleName} not found for organization ${organizationId}`,
      );
    })();

  // Check if membership exists
  const existingMembership = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (existingMembership.length > 0) {
    // Update existing membership
    await db
      .update(memberships)
      .set({ roleId: role.id })
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.organizationId, organizationId),
        ),
      );
  } else {
    // Create new membership
    await db.insert(memberships).values({
      id: nanoid(),
      userId,
      organizationId,
      roleId: role.id,
    });
  }

  console.log(
    `[AUTH] Created membership: ${userId} → ${roleName} in ${organizationId}`,
  );
}

/**
 * Create Supabase auth user with dev login compatibility
 */
async function createSupabaseAuthUser(
  params: CreateUserParams,
): Promise<{ success: boolean; userId?: string; error?: string }> {
  const supabase = createServiceRoleClient();

  try {
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

    if (error) {
      // Handle "user already exists" gracefully (expected in re-seeding)
      if (error.message.includes("User already registered")) {
        console.log(`[AUTH] User ${params.email} already exists, skipping...`);
        return { success: true }; // Treat as success for idempotent seeding
      }

      console.error(`[AUTH] Failed to create user ${params.email}:`, error);
      return {
        success: false,
        error: `Failed to create user ${params.email}: ${error.message}`,
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: `User creation succeeded but no user data returned for ${params.email}`,
      };
    }

    console.log(`[AUTH] Created Supabase auth user: ${params.email}`);
    return { success: true, userId: data.user.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[AUTH] Error creating user ${params.email}:`, errorMessage);
    return {
      success: false,
      error: `User creation failed: ${errorMessage}`,
    };
  }
}

/**
 * Process batch of users with error handling
 */
async function processBatchUsers(
  userList: UserData[],
  organizationId: string,
): Promise<{ successCount: number; errorCount: number; errors: string[] }> {
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (const userData of userList) {
    try {
      // Create Supabase auth user
      const authResult = await createSupabaseAuthUser({
        email: userData.email,
        organizationId,
        role: userData.role,
        profile: {
          name: userData.name,
          bio: userData.bio,
        },
      });

      if (!authResult.success) {
        errorCount++;
        errors.push(authResult.error || `Unknown error for ${userData.email}`);
        continue;
      }

      // If we got a userId, ensure User record exists and create membership
      if (authResult.userId) {
        // Wait a moment for auth trigger to create User record
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Ensure User record exists (auth trigger should create it, but verify)
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.id, authResult.userId))
          .limit(1);

        if (existingUser.length === 0) {
          // Create new user record
          await db.insert(users).values({
            id: authResult.userId,
            name: userData.name,
            email: userData.email,
            emailVerified: new Date(),
            image: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        // If user exists, no updates needed

        await createUserMembership(
          authResult.userId,
          organizationId,
          userData.role,
        );
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

  return { successCount, errorCount, errors };
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
  users: UserData[],
  organizationId: string,
): Promise<void> {
  console.log(
    `[AUTH] Creating ${users.length.toString()} auth users for organization ${organizationId}...`,
  );

  try {
    // DEV + PREVIEW: Delete existing users for clean reset
    if (!isProduction()) {
      console.log(
        "[AUTH] 🔄 DEV/PREVIEW ENVIRONMENT: Performing aggressive user reset for clean demos",
      );
      await deleteExistingDevUsers(users);
    } else {
      console.log(
        "[AUTH] 🔒 PRODUCTION ENVIRONMENT: Preserving existing users, creating only missing ones",
      );
    }

    // Process users in batch
    const results = await processBatchUsers(users, organizationId);

    // Report results
    console.log(
      `[AUTH] ✅ Auth user seeding complete: ${results.successCount.toString()} successful, ${results.errorCount.toString()} failed`,
    );

    if (results.errors.length > 0) {
      console.error("[AUTH] Errors encountered:");
      for (const error of results.errors) {
        console.error(`[AUTH]   - ${error}`);
      }

      // Fail if more than half the users failed (indicates systemic issue)
      if (results.errorCount > results.successCount) {
        throw new Error(
          `Auth user seeding failed: ${results.errorCount.toString()} errors out of ${users.length.toString()} users`,
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

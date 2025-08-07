/**
 * Server-side Development Authentication Utilities
 *
 * Contains server actions for creating dev users with admin privileges.
 * This module runs server-side only and handles user creation via Supabase admin API.
 */

"use server";

import { shouldEnableDevFeatures } from "~/lib/environment";
import { createAdminClient } from "~/lib/supabase/server";

export interface DevUserData {
  email: string;
  name?: string;
  role?: string;
  organizationId?: string;
}

export interface DevUserCreationResult {
  success: boolean;
  error?: string;
  userId?: string;
}

// Fixed development password for all dev users
const DEV_PASSWORD = "dev-login-123";

// Allowed email domains for dev users
const ALLOWED_DEV_DOMAINS = ["dev.local", "pinpoint.dev"];

/**
 * Validates if an email is allowed for dev user creation
 */
function isValidDevEmail(email: string): boolean {
  const domain = email.split("@")[1];
  return domain ? ALLOWED_DEV_DOMAINS.includes(domain) : false;
}

/**
 * Server action to create a dev user with admin privileges
 */
export async function createDevUserAction(
  userData: DevUserData,
): Promise<DevUserCreationResult> {
  // Environment safety check
  if (!shouldEnableDevFeatures()) {
    return {
      success: false,
      error:
        "Dev user creation is only available in development and preview environments",
    };
  }

  // Email domain validation
  if (!isValidDevEmail(userData.email)) {
    return {
      success: false,
      error: `Email domain not allowed for dev users. Allowed domains: ${ALLOWED_DEV_DOMAINS.join(", ")}`,
    };
  }

  try {
    const adminClient = await createAdminClient();

    const { data, error } = await adminClient.auth.admin.createUser({
      email: userData.email,
      password: DEV_PASSWORD,
      email_confirm: true, // Pre-confirm email to skip verification
      user_metadata: {
        name: userData.name ?? userData.email.split("@")[0],
        dev_user: true, // Mark as development user
        environment: shouldEnableDevFeatures() ? "development" : "production",
      },
      app_metadata: {
        role: userData.role ?? "member",
        organization_id: userData.organizationId,
        dev_created: true,
        created_at: new Date().toISOString(),
      },
    });

    if (error) {
      console.error("Failed to create dev user:", error.message);
      return {
        success: false,
        error: `Failed to create user: ${error.message}`,
      };
    }

    console.log(
      `Dev user created: ${userData.email.replace(/\n|\r/g, "")} (${(userData.role ?? "member").replace(/\n|\r/g, "")})`,
    );
    return {
      success: true,
      userId: data.user.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Dev user creation error:", errorMessage);
    return {
      success: false,
      error: `User creation failed: ${errorMessage}`,
    };
  }
}

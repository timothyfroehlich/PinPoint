/**
 * Authentication Server Actions - Modern Supabase OAuth & Magic Link
 * Implements Google OAuth and Magic Link authentication with Server Actions
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "~/lib/supabase/server";
import { validateOrganizationExists, getOrganizationSubdomainById } from "~/lib/dal/public-organizations";
import { isDevelopment } from "~/lib/environment";
import { extractFormFields } from "~/lib/utils/form-data";
import { actionError, type ActionResult } from "./shared";

// Re-export ActionResult for compatibility with existing components
export type { ActionResult };

// Validation schemas
const magicLinkSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  organizationId: z.string().min(1, "Organization is required"),
});

const oauthProviderSchema = z.object({
  provider: z.enum(["google"]),
  organizationId: z.string().min(1, "Organization is required"),
  redirectTo: z.string().url().optional(),
});

/**
 * Send Magic Link for passwordless authentication
 */
export async function sendMagicLink(
  _prevState: ActionResult<{ message: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ message: string }>> {
  try {
    // Validate form data with type safety
    let data: { email: string; organizationId: string };
    try {
      data = extractFormFields(formData, magicLinkSchema);
    } catch (error) {
      return actionError(error instanceof Error ? error.message : "Form validation failed");
    }

    const { email, organizationId } = data;
    
    // Validate organization exists
    const organizationValid = await validateOrganizationExists(organizationId);
    if (!organizationValid) {
      return actionError("Invalid organization selected", {
        organizationId: ["Selected organization is not valid"],
      });
    }
    const supabase = await createClient();
    
    // Get organization subdomain for redirect URL
    const subdomain = await getOrganizationSubdomainById(organizationId);
    if (!subdomain) {
      return actionError("Organization configuration error");
    }

    // Build callback URL with organization subdomain
    const baseUrl = process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000";
    const callbackUrl = isDevelopment() 
      ? `https://${subdomain}.localhost:3000/auth/callback`
      : `https://${subdomain}.${baseUrl.replace(/^https?:\/\//, '')}/auth/callback`;

    // Send magic link with organization metadata
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${callbackUrl}?organizationId=${organizationId}`,
        data: {
          organizationId,
        },
      },
    });

    if (error) {
      console.error("Magic link error:", error);
      return actionError("Failed to send magic link. Please try again.");
    }

    return {
      success: true,
      data: {
        message: `Magic link sent to ${email}! Check your inbox and click the link to sign in.`,
      },
    };
  } catch (error) {
    console.error("Magic link action error:", error);
    return actionError("An unexpected error occurred. Please try again.");
  }
}

/**
 * Initiate OAuth authentication flow
 */
export async function signInWithOAuth(
  provider: "google",
  organizationId: string,
  redirectTo?: string,
): Promise<never> {
  try {
    // Validate inputs
    const validation = oauthProviderSchema.safeParse({ provider, organizationId, redirectTo });
    if (!validation.success) {
      redirect("/auth/auth-code-error?error=invalid_input");
    }
    
    // Validate organization exists
    const organizationValid = await validateOrganizationExists(organizationId);
    if (!organizationValid) {
      redirect("/auth/auth-code-error?error=invalid_organization");
    }

    const supabase = await createClient();
    
    // Get organization subdomain for redirect URL
    const subdomain = await getOrganizationSubdomainById(organizationId);
    if (!subdomain) {
      redirect("/auth/auth-code-error?error=organization_config");
    }

    // Build callback URL with organization subdomain
    const baseUrl = process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000";
    const callbackUrl = isDevelopment() 
      ? `https://${subdomain}.localhost:3000/auth/callback`
      : `https://${subdomain}.${baseUrl.replace(/^https?:\/\//, '')}/auth/callback`;

    // Build query params for callback
    const queryParams = new URLSearchParams({ organizationId });
    if (redirectTo) {
      queryParams.set('next', redirectTo);
    }

    // Initiate OAuth flow
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${callbackUrl}?${queryParams.toString()}`,
      },
    });

    if (error) {
      console.error("OAuth initiation error:", error);
      redirect("/auth/auth-code-error?error=oauth_failed");
    }

    if (data.url) {
      redirect(data.url);
    }

    redirect("/auth/auth-code-error?error=no_redirect_url");
  } catch (error) {
    console.error("OAuth action error:", error);
    redirect("/auth/auth-code-error?error=unexpected");
  }
}

/**
 * Dev authentication for testing (development only)
 */
export async function devSignIn(
  email: string,
  _userData?: { name?: string; role?: string },
): Promise<ActionResult<{ message: string }>> {
  if (process.env.NODE_ENV !== "development") {
    return actionError("Dev authentication only available in development");
  }

  try {
    const supabase = await createClient();

    // Use Supabase's development-friendly authentication
    // This would typically integrate with your existing dev auth system
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      return actionError("Dev authentication failed");
    }

    revalidatePath("/", "layout");

    return {
      success: true,
      data: {
        message: `Development authentication successful for ${email}`,
      },
    };
  } catch (error) {
    console.error("Dev auth error:", error);
    return actionError("Development authentication failed");
  }
}

/**
 * Sign out action
 */
export async function signOut(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    revalidatePath("/", "layout");
  } catch (error) {
    console.error("Sign out error:", error);
  }
  redirect("/auth/sign-in");
}

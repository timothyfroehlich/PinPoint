/**
 * Authentication Server Actions - Alpha Single-Org Mode
 * Simplified magic link and OAuth authentication without org selection
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "~/lib/supabase/server";
import { emailSchema } from "~/lib/validation/schemas";
import { extractFormFields } from "~/lib/utils/form-data";
import { actionError } from "./shared";
import { isError, getErrorMessage } from "~/lib/utils/type-guards";
import { env } from "~/env";

import type { ActionResult } from "./shared";

// Validation schemas
const magicLinkSchema = z.object({
  email: emailSchema,
});

const oauthProviderSchema = z.object({
  provider: z.enum(["google"]),
  redirectTo: z.url().optional(),
});

/**
 * Get callback URL for authentication flows
 * Alpha: Simple URL without subdomain routing
 */
function getCallbackUrl(): string {
  const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/auth/callback`;
}

/**
 * Send Magic Link for passwordless authentication
 * Alpha: Always assigns user to ALPHA_ORG_ID
 */
export async function sendMagicLink(
  _prevState: ActionResult<{ message: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ message: string }>> {
  try {
    // Validate form data
    let data: { email: string };
    try {
      data = extractFormFields(formData, magicLinkSchema);
    } catch (error) {
      return actionError(
        isError(error) ? error.message : "Form validation failed",
      );
    }

    const { email } = data;
    const supabase = await createClient();

    // Send magic link with ALPHA_ORG_ID in metadata
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: getCallbackUrl(),
        data: {
          organizationId: env.ALPHA_ORG_ID,
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
    console.error("Magic link action error:", getErrorMessage(error));
    return actionError("An unexpected error occurred. Please try again.");
  }
}

/**
 * Initiate OAuth authentication flow
 * Alpha: Always assigns user to ALPHA_ORG_ID
 */
export async function signInWithOAuth(
  provider: "google",
  redirectTo?: string,
): Promise<never> {
  try {
    // Validate inputs
    const validation = oauthProviderSchema.safeParse({
      provider,
      redirectTo,
    });
    if (!validation.success) {
      redirect("/auth/auth-code-error?error=invalid_input");
    }

    const supabase = await createClient();

    // Build callback URL with optional redirect
    const callbackUrl = getCallbackUrl();
    const queryParams = new URLSearchParams();
    if (redirectTo) {
      queryParams.set("next", redirectTo);
    }

    const finalCallbackUrl =
      queryParams.toString() !== ""
        ? `${callbackUrl}?${queryParams.toString()}`
        : callbackUrl;

    // Initiate OAuth flow with ALPHA_ORG_ID in metadata
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: finalCallbackUrl,
        data: {
          organizationId: env.ALPHA_ORG_ID,
        },
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
    console.error("OAuth action error:", getErrorMessage(error));
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
  if (env.NODE_ENV !== "development") {
    return actionError("Dev authentication only available in development");
  }

  try {
    const supabase = await createClient();

    // Dev auth with ALPHA_ORG_ID
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: {
          organizationId: env.ALPHA_ORG_ID,
        },
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
    console.error("Dev auth error:", getErrorMessage(error));
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
    console.error("Sign out error:", getErrorMessage(error));
  }
  redirect("/auth/sign-in");
}

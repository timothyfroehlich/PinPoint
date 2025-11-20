"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "~/lib/supabase/server";
import { type Result, ok, err } from "~/lib/result";
import { setFlash } from "~/lib/flash";
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./schemas";
import { log } from "~/lib/logger";

/**
 * Result Types
 */

export type LoginResult = Result<
  { userId: string },
  "VALIDATION" | "AUTH" | "SERVER"
>;

export type SignupResult = Result<
  { userId: string },
  "VALIDATION" | "EMAIL_TAKEN" | "SERVER"
>;

export type LogoutResult = Result<void, "SERVER">;

export type ForgotPasswordResult = Result<void, "VALIDATION" | "SERVER">;

export type ResetPasswordResult = Result<void, "VALIDATION" | "SERVER">;

/**
 * Login Action
 *
 * Authenticates user with email and password.
 * Supports "Remember Me" for persistent sessions.
 *
 * @param formData - Form data containing email, password, and optional rememberMe
 * @returns LoginResult with user ID or error
 */
export async function loginAction(formData: FormData): Promise<LoginResult> {
  // Validate input
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    rememberMe: formData.get("rememberMe") === "on",
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    log.warn(
      { errors: parsed.error.issues, action: "login" },
      "Login validation failed"
    );
    await setFlash({
      type: "error",
      message: firstError?.message ?? "Invalid input",
    });
    return err("VALIDATION", "Invalid input");
  }

  const { email, password } = parsed.data;
  // Note: rememberMe is validated but not used currently
  // SSR sessions persist via cookies regardless of this setting

  try {
    const supabase = await createClient();

    // Sign in with Supabase Auth
    // Note: Remember Me is for UX only - SSR sessions persist via cookies
    // The rememberMe value could be used to adjust cookie expiry if needed
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Defensive check - Supabase types guarantee user exists if no error,
    // but we check both for safety
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (error || !data.user) {
      log.warn(
        { action: "login", error: error?.message },
        "Login authentication failed"
      );
      await setFlash({
        type: "error",
        message: "Invalid email or password",
      });
      return err("AUTH", error?.message ?? "Authentication failed");
    }

    log.info(
      { userId: data.user.id, action: "login" },
      "User logged in successfully"
    );

    await setFlash({
      type: "success",
      message: "Welcome back!",
    });

    // Return success (redirect happens in page component)
    return ok({ userId: data.user.id });
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        stack: error instanceof Error ? error.stack : undefined,
        action: "login",
      },
      "Login server error"
    );
    await setFlash({
      type: "error",
      message: "Something went wrong. Please try again.",
    });
    return err("SERVER", error instanceof Error ? error.message : "Unknown");
  }
}

/**
 * Signup Action
 *
 * Creates a new user account with email and password.
 * User profile is auto-created via database trigger (see supabase/seed.sql).
 *
 * @param formData - Form data containing name, email, and password
 * @returns SignupResult with user ID or error
 */
export async function signupAction(formData: FormData): Promise<SignupResult> {
  // Validate input
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    log.warn(
      { errors: parsed.error.issues, action: "signup" },
      "Signup validation failed"
    );
    await setFlash({
      type: "error",
      message: firstError?.message ?? "Please check your input",
    });
    return err("VALIDATION", "Invalid input");
  }

  const { name, email, password } = parsed.data;

  try {
    const supabase = await createClient();

    // Create user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name, // Passed to trigger for user_profiles.name
        },
      },
    });

    if (error) {
      // Check for duplicate email
      if (error.message.includes("already registered")) {
        log.warn(
          { action: "signup", error: error.message },
          "Signup failed: email already registered"
        );
        await setFlash({
          type: "error",
          message: "An account with this email already exists",
        });
        return err("EMAIL_TAKEN", error.message);
      }

      log.error(
        { action: "signup", error: error.message },
        "Signup failed: Supabase error"
      );
      await setFlash({
        type: "error",
        message: error.message,
      });
      return err("SERVER", error.message);
    }

    if (!data.user) {
      log.error({ action: "signup" }, "Signup failed: no user returned");
      await setFlash({
        type: "error",
        message: "Failed to create account",
      });
      return err("SERVER", "No user returned");
    }

    log.info(
      { userId: data.user.id, action: "signup" },
      "User signed up successfully"
    );

    await setFlash({
      type: "success",
      message: "Account created successfully!",
    });

    // Return success (redirect happens in page component)
    return ok({ userId: data.user.id });
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        stack: error instanceof Error ? error.stack : undefined,
        action: "signup",
      },
      "Signup server error"
    );
    await setFlash({
      type: "error",
      message: "Something went wrong. Please try again.",
    });
    return err("SERVER", error instanceof Error ? error.message : "Unknown");
  }
}

/**
 * Logout Action
 *
 * Signs out the current user and clears their session.
 */
export async function logoutAction(): Promise<void> {
  try {
    const supabase = await createClient();

    // Get user before signing out for logging
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.auth.signOut();

    if (error) {
      log.error(
        { userId: user?.id, error: error.message, action: "logout" },
        "Logout failed"
      );
      await setFlash({
        type: "error",
        message: "Failed to sign out",
      });
      return; // Early exit without redirect
    }

    log.info(
      { userId: user?.id, action: "logout" },
      "User logged out successfully"
    );

    await setFlash({
      type: "success",
      message: "Signed out successfully",
    });
  } catch (cause) {
    log.error(
      {
        error: cause instanceof Error ? cause.message : "Unknown",
        stack: cause instanceof Error ? cause.stack : undefined,
        action: "logout",
      },
      "Logout server error"
    );
    await setFlash({
      type: "error",
      message: "Something went wrong",
    });
  } finally {
    // Always redirect to home after logout attempt
    redirect("/");
  }
}

/**
 * Forgot Password Action
 *
 * Sends a password reset email to the user.
 * The email contains a link to reset the password.
 *
 * @param formData - Form data containing email
 * @returns ForgotPasswordResult
 */
export async function forgotPasswordAction(
  formData: FormData
): Promise<ForgotPasswordResult> {
  // Validate input
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    log.warn(
      { errors: parsed.error.issues, action: "forgot-password" },
      "Forgot password validation failed"
    );
    await setFlash({
      type: "error",
      message: firstError?.message ?? "Invalid email address",
    });
    return err("VALIDATION", "Invalid input");
  }

  const { email } = parsed.data;

  try {
    const supabase = await createClient();

    // Get origin dynamically (dev server can run on 3000 or 3100)
    const headersList = await headers();
    const protocol =
      headersList.get("x-forwarded-proto") ??
      headersList.get("origin")?.split("://")[0] ??
      "http";
    const host =
      headersList.get("x-forwarded-host") ?? headersList.get("host");
    const fallback =
      headersList.get("referer")?.split("/").slice(0, 3).join("/") ??
      `http://127.0.0.1:${process.env["PORT"] ?? "3000"}`;
    const origin =
      process.env["NEXT_PUBLIC_SITE_URL"] ??
      (host ? `${protocol}://${host}` : fallback);
    log.info(
      { action: "forgot-password", origin },
      "Resolved password reset redirect origin"
    );
    const callbackUrl = new URL("/auth/callback", origin);
    callbackUrl.searchParams.set("next", "/reset-password");
    const redirectTo = callbackUrl.toString();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      log.error(
        { action: "forgot-password", error: error.message },
        "Password reset email failed"
      );
      await setFlash({
        type: "error",
        message: "Failed to send reset email. Please try again.",
      });
      return err("SERVER", error.message);
    }

    log.info(
      { email, action: "forgot-password" },
      "Password reset email sent successfully"
    );

    // Always show success message even if email doesn't exist
    // This prevents email enumeration attacks
    await setFlash({
      type: "success",
      message:
        "If an account exists with that email, you will receive a password reset link shortly.",
    });

    return ok(undefined);
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        stack: error instanceof Error ? error.stack : undefined,
        action: "forgot-password",
      },
      "Forgot password server error"
    );
    await setFlash({
      type: "error",
      message: "Something went wrong. Please try again.",
    });
    return err("SERVER", error instanceof Error ? error.message : "Unknown");
  }
}

/**
 * Reset Password Action
 *
 * Updates the user's password after they click the reset link.
 * User must be authenticated via the reset link token.
 *
 * @param formData - Form data containing new password and confirmation
 * @returns ResetPasswordResult
 */
export async function resetPasswordAction(
  formData: FormData
): Promise<ResetPasswordResult> {
  // Validate input
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    log.warn(
      { errors: parsed.error.issues, action: "reset-password" },
      "Reset password validation failed"
    );
    await setFlash({
      type: "error",
      message: firstError?.message ?? "Invalid input",
    });
    return err("VALIDATION", "Invalid input");
  }

  const { password } = parsed.data;

  try {
    const supabase = await createClient();

    // Verify user is authenticated (should be authenticated via reset link)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      log.warn({ action: "reset-password" }, "User not authenticated");
      await setFlash({
        type: "error",
        message:
          "Invalid or expired reset link. Please request a new password reset.",
      });
      return err("SERVER", "Not authenticated");
    }

    // Update password
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      log.error(
        { userId: user.id, action: "reset-password", error: error.message },
        "Password update failed"
      );
      await setFlash({
        type: "error",
        message: "Failed to update password. Please try again.",
      });
      return err("SERVER", error.message);
    }

    log.info(
      { userId: user.id, action: "reset-password" },
      "Password updated successfully"
    );

    await setFlash({
      type: "success",
      message: "Password updated successfully! You can now sign in.",
    });

    return ok(undefined);
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        stack: error instanceof Error ? error.stack : undefined,
        action: "reset-password",
      },
      "Reset password server error"
    );
    await setFlash({
      type: "error",
      message: "Something went wrong. Please try again.",
    });
    return err("SERVER", error instanceof Error ? error.message : "Unknown");
  }
}

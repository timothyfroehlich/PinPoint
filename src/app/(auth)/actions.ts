"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "~/lib/supabase/server";
import { type Result, ok, err } from "~/lib/result";
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./schemas";
import { log } from "~/lib/logger";
import {
  checkLoginIpLimit,
  checkLoginAccountLimit,
  checkSignupLimit,
  checkForgotPasswordLimit,
  getClientIp,
  formatResetTime,
} from "~/lib/rate-limit";

/**
 * Result Types
 */

export type LoginResult = Result<
  { userId: string },
  "VALIDATION" | "AUTH" | "SERVER" | "RATE_LIMIT"
>;

export type SignupResult = Result<
  { userId: string },
  | "VALIDATION"
  | "EMAIL_TAKEN"
  | "SERVER"
  | "CONFIRMATION_REQUIRED"
  | "RATE_LIMIT"
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
 * @param _prevState - The previous state of the form
 * @param formData - Form data containing email, password, and optional rememberMe
 * @returns LoginResult with user ID or error
 */
export async function loginAction(
  _prevState: LoginResult | undefined,
  formData: FormData
): Promise<LoginResult> {
  // Validate input
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    rememberMe: formData.get("rememberMe") === "on",
  });

  if (!parsed.success) {
    log.warn(
      { errors: parsed.error.issues, action: "login" },
      "Login validation failed"
    );

    return err("VALIDATION", "Invalid input");
  }

  const { email, password } = parsed.data;
  // Note: rememberMe is validated but not used currently
  // SSR sessions persist via cookies regardless of this setting

  try {
    // Rate limiting: Check IP-based limit first
    const ip = await getClientIp();
    const ipLimit = await checkLoginIpLimit(ip);

    if (!ipLimit.success) {
      log.warn(
        { ip, action: "login", resetIn: formatResetTime(ipLimit.reset) },
        "Login IP rate limit exceeded"
      );
      return err(
        "RATE_LIMIT",
        `Too many login attempts. Please try again in ${formatResetTime(ipLimit.reset)}.`
      );
    }

    // Rate limiting: Check account-based limit
    const accountLimit = await checkLoginAccountLimit(email);

    if (!accountLimit.success) {
      log.warn(
        {
          email: email.substring(0, 3) + "***",
          action: "login",
          resetIn: formatResetTime(accountLimit.reset),
        },
        "Login account rate limit exceeded"
      );
      return err(
        "RATE_LIMIT",
        `Too many login attempts for this account. Please try again in ${formatResetTime(accountLimit.reset)}.`
      );
    }

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

      return err("AUTH", error?.message ?? "Authentication failed");
    }

    log.info(
      { userId: data.user.id, action: "login" },
      "User logged in successfully"
    );
    redirect("/dashboard");
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        stack: error instanceof Error ? error.stack : undefined,
        action: "login",
      },
      "Login server error"
    );

    return err("SERVER", error instanceof Error ? error.message : "Unknown");
  }
}

/**
 * Signup Action
 *
 * Creates a new user account with email and password.
 * User profile is auto-created via database trigger (see supabase/seed.sql).
 *
 * @param _prevState - The previous state of the form
 * @param formData - Form data containing name, email, and password
 * @returns SignupResult with user ID or error
 */
export async function signupAction(
  _prevState: SignupResult | undefined,
  formData: FormData
): Promise<SignupResult> {
  // Validate input
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    log.warn(
      { errors: parsed.error.issues, action: "signup" },
      "Signup validation failed"
    );

    return err("VALIDATION", "Invalid input");
  }

  const { name, email, password } = parsed.data;

  try {
    // Rate limiting: Check IP-based limit
    const ip = await getClientIp();
    const ipLimit = await checkSignupLimit(ip);

    if (!ipLimit.success) {
      log.warn(
        { ip, action: "signup", resetIn: formatResetTime(ipLimit.reset) },
        "Signup rate limit exceeded"
      );
      return err(
        "RATE_LIMIT",
        `Too many signup attempts. Please try again in ${formatResetTime(ipLimit.reset)}.`
      );
    }

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

        return err("EMAIL_TAKEN", error.message);
      }

      log.error(
        { action: "signup", error: error.message },
        "Signup failed: Supabase error"
      );

      return err("SERVER", error.message);
    }

    if (!data.user) {
      log.error({ action: "signup" }, "Signup failed: no user returned");

      return err("SERVER", "No user returned");
    }

    // Check if email confirmation is required (user created but no session)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (data.user && !data.session) {
      log.info(
        { userId: data.user.id, action: "signup" },
        "User signed up, confirmation required"
      );

      redirect("/login");
    }

    log.info(
      { userId: data.user.id, action: "signup" },
      "User signed up successfully"
    );
    redirect("/dashboard");
  } catch (error) {
    // If redirect was thrown, re-throw it
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }
    // Also check for digest property which Next.js uses
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      String(error.digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }

    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        stack: error instanceof Error ? error.stack : undefined,
        action: "signup",
      },
      "Signup server error"
    );

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

      return; // Early exit without redirect
    }

    log.info(
      { userId: user?.id, action: "logout" },
      "User logged out successfully"
    );
  } catch (cause) {
    log.error(
      {
        error: cause instanceof Error ? cause.message : "Unknown",
        stack: cause instanceof Error ? cause.stack : undefined,
        action: "logout",
      },
      "Logout server error"
    );
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
  _prevState: ForgotPasswordResult | undefined,
  formData: FormData
): Promise<ForgotPasswordResult> {
  // Validate input
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    log.warn(
      { errors: parsed.error.issues, action: "forgot-password" },
      "Forgot password validation failed"
    );

    return err("VALIDATION", "Invalid input");
  }

  const { email } = parsed.data;

  try {
    // Rate limiting: Check email-based limit
    // Note: We check rate limit AFTER validation but BEFORE sending email
    // We still return success to prevent email enumeration
    const emailLimit = await checkForgotPasswordLimit(email);

    if (!emailLimit.success) {
      log.warn(
        {
          email: email.substring(0, 3) + "***",
          action: "forgot-password",
          resetIn: formatResetTime(emailLimit.reset),
        },
        "Forgot password rate limit exceeded"
      );
      // Return success to prevent email enumeration
      // The rate limit is enforced but not revealed to the user
      return ok(undefined);
    }

    const supabase = await createClient();

    // Get origin dynamically (dev server can run on 3000 or 3100)
    const headersList = await headers();
    const protocol =
      headersList.get("x-forwarded-proto") ??
      headersList.get("origin")?.split("://")[0] ??
      "http";
    const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
    const fallback =
      headersList.get("referer")?.split("/").slice(0, 3).join("/") ??
      `http://localhost:${process.env["PORT"] ?? "3000"}`;
    const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"];
    const origin =
      (typeof siteUrl === "string" && siteUrl.length > 0
        ? siteUrl
        : undefined) ?? (host ? `${protocol}://${host}` : fallback);

    // Validate origin against allowlist to prevent host header injection
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:3100",
      "http://localhost:3200",
      "http://localhost:3300",
      siteUrl,
    ].filter((url): url is string => typeof url === "string" && url.length > 0);

    if (!allowedOrigins.some((allowed) => origin.startsWith(allowed))) {
      log.warn(
        { origin, action: "forgot-password" },
        "Invalid origin detected for password reset"
      );
      return err("SERVER", "Invalid origin for password reset");
    }

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
      return err("SERVER", error.message);
    }

    log.info(
      { email, action: "forgot-password" },
      "Password reset email sent successfully"
    );

    // Always show success message even if email doesn't exist
    // This prevents email enumeration attacks
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
    return err("SERVER", error instanceof Error ? error.message : "Unknown");
  }
}

/**
 * Reset Password Action
 *
 * Updates the user's password after they click the reset link.
 * User must be authenticated via the reset link token.
 *
 * @param _prevState - The previous state of the form
 * @param formData - Form data containing new password and confirmation
 * @returns ResetPasswordResult
 */
export async function resetPasswordAction(
  _prevState: ResetPasswordResult | undefined,
  formData: FormData
): Promise<ResetPasswordResult> {
  // Validate input
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    log.warn(
      { errors: parsed.error.issues, action: "reset-password" },
      "Reset password validation failed"
    );

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

      return err("SERVER", error.message);
    }

    log.info(
      { userId: user.id, action: "reset-password" },
      "Password updated successfully"
    );
    await supabase.auth.signOut();
    redirect("/login");
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        stack: error instanceof Error ? error.stack : undefined,
        action: "reset-password",
      },
      "Reset password server error"
    );

    return err("SERVER", error instanceof Error ? error.message : "Unknown");
  }
}

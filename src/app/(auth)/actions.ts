"use server";

import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { type Result, ok, err } from "~/lib/result";
import { setFlash } from "~/lib/flash";
import { loginSchema, signupSchema } from "./schemas";

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
      await setFlash({
        type: "error",
        message: "Invalid email or password",
      });
      return err("AUTH", error?.message ?? "Authentication failed");
    }

    await setFlash({
      type: "success",
      message: "Welcome back!",
    });

    // Return success (redirect happens in page component)
    return ok({ userId: data.user.id });
  } catch (error) {
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
        await setFlash({
          type: "error",
          message: "An account with this email already exists",
        });
        return err("EMAIL_TAKEN", error.message);
      }

      await setFlash({
        type: "error",
        message: error.message,
      });
      return err("SERVER", error.message);
    }

    if (!data.user) {
      await setFlash({
        type: "error",
        message: "Failed to create account",
      });
      return err("SERVER", "No user returned");
    }

    await setFlash({
      type: "success",
      message: "Account created successfully!",
    });

    // Return success (redirect happens in page component)
    return ok({ userId: data.user.id });
  } catch (error) {
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
export async function logoutAction(): Promise<LogoutResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      await setFlash({
        type: "error",
        message: "Failed to sign out",
      });
      return err("SERVER", error.message);
    }

    await setFlash({
      type: "success",
      message: "Signed out successfully",
    });

    return ok(undefined);
  } catch (error) {
    await setFlash({
      type: "error",
      message: "Something went wrong",
    });
    return err("SERVER", error instanceof Error ? error.message : "Unknown");
  } finally {
    // Always redirect to home after logout attempt
    redirect("/");
  }
}

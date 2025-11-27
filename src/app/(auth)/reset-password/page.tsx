import type React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { resetPasswordAction } from "~/app/(auth)/actions";
import { cn } from "~/lib/utils";
import { readFlash } from "~/lib/flash";
import { createClient } from "~/lib/supabase/server";

/**
 * Reset Password Page
 *
 * Set a new password after clicking the reset link from email.
 * User must be authenticated via the reset link token.
 * Progressive enhancement - works without JavaScript.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ retry?: string }>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;

  // Verify user is authenticated via reset link
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If not authenticated, redirect to forgot password page
  if (!user) {
    const cookieStore = await cookies();
    const hasAuthCookie = cookieStore
      .getAll()
      .some(
        (cookie) =>
          cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")
      );

    const hasRetried = params.retry === "1";

    if (hasAuthCookie && !hasRetried) {
      redirect("/auth/loading?next=/reset-password?retry=1");
    }

    redirect("/forgot-password");
  }

  // Read flash message (if any)
  const flash = await readFlash();

  /**
   * Server action wrapper for progressive enhancement
   */
  async function handleResetPassword(formData: FormData): Promise<void> {
    "use server";

    const result = await resetPasswordAction(formData);

    if (result.ok) {
      // Sign out the user so they can log in with their new password
      const supabase = await createClient();
      await supabase.auth.signOut();

      // Success - redirect to login
      redirect("/login");
    }

    // Error - flash message was already set
    redirect("/reset-password");
  }

  return (
    <Card className="border-outline-variant bg-surface shadow-xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-on-surface">
          Set New Password
        </CardTitle>
        <p className="text-sm text-on-surface-variant">
          Enter your new password below
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Flash message */}
        {flash && (
          <div
            className={cn(
              "rounded-lg px-4 py-3 text-sm",
              flash.type === "error"
                ? "bg-error-container text-on-error-container"
                : "bg-success-container text-on-success-container"
            )}
            role="alert"
          >
            {flash.message}
          </div>
        )}

        {/* Reset password form */}
        <form action={handleResetPassword} className="space-y-4">
          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              className="bg-surface-variant"
            />
            <p className="text-xs text-on-surface-variant">
              Must be at least 8 characters
            </p>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              className="bg-surface-variant"
            />
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            className="w-full bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container"
            size="lg"
          >
            Update Password
          </Button>
        </form>

        {/* Back to login link */}
        <div className="text-center text-sm text-on-surface-variant">
          Remember your password?{" "}
          <Link
            href="/login"
            className="text-sm text-link flex items-center justify-center gap-2"
          >
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

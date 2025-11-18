import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { forgotPasswordAction } from "~/app/(auth)/actions";
import { readFlash } from "~/lib/flash";
import { createClient } from "~/lib/supabase/server";

/**
 * Forgot Password Page
 *
 * Request a password reset email.
 * Progressive enhancement - works without JavaScript.
 */
export default async function ForgotPasswordPage(): Promise<React.JSX.Element> {
  // Check if already logged in
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  // Read flash message (if any)
  const flash = await readFlash();

  /**
   * Server action wrapper for progressive enhancement
   */
  async function handleForgotPassword(formData: FormData): Promise<void> {
    "use server";

    const result = await forgotPasswordAction(formData);

    if (result.ok) {
      // Success - show message and stay on page
      redirect("/forgot-password");
    }

    // Error - flash message was already set
    redirect("/forgot-password");
  }

  return (
    <Card className="border-outline-variant bg-surface shadow-xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-on-surface">
          Reset Password
        </CardTitle>
        <p className="text-sm text-on-surface-variant">
          Enter your email address and we'll send you a link to reset your
          password
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Flash message */}
        {flash && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${
              flash.type === "error"
                ? "bg-error-container text-on-error-container"
                : "bg-primary-container text-on-primary-container"
            }`}
            role="alert"
          >
            {flash.message}
          </div>
        )}

        {/* Forgot password form */}
        <form action={handleForgotPassword} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              className="bg-surface-variant"
            />
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            className="w-full bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container"
            size="lg"
          >
            Send Reset Link
          </Button>
        </form>

        {/* Back to login link */}
        <div className="text-center text-sm text-on-surface-variant">
          Remember your password?{" "}
          <Link
            href="/login"
            className="text-primary hover:underline font-medium"
          >
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

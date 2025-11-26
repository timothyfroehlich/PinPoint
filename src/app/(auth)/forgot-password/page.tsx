import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { readFlash } from "~/lib/flash";
import { createClient } from "~/lib/supabase/server";
import { ForgotPasswordForm } from "./forgot-password-form";

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

        {/* Forgot password form */}
        <ForgotPasswordForm />

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

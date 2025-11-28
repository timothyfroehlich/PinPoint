import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
        {/* Forgot password form */}
        <ForgotPasswordForm />

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

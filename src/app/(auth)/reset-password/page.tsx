import type React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { createClient } from "~/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

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
        <ResetPasswordForm />

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

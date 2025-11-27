import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { createClient } from "~/lib/supabase/server";
import { SignupForm } from "./signup-form";

/**
 * Signup Page
 *
 * User registration with email, password, and name.
 * Progressive enhancement - works without JavaScript.
 * Password strength indicator (client-side enhancement).
 */
export default async function SignupPage(): Promise<React.JSX.Element> {
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
          Create Account
        </CardTitle>
        <p className="text-sm text-on-surface-variant">
          Join PinPoint to report and track issues
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Signup form - Client Component for password strength */}
        <SignupForm />

        {/* Login link */}
        <div className="text-center text-sm text-on-surface-variant">
          Already have an account?{" "}
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

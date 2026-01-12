import type React from "react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { createClient } from "~/lib/supabase/server";
import { getSafeRedirect } from "~/lib/url";
import { LoginForm } from "./login-form";

/**
 * Login Page
 *
 * Email/password authentication with "Remember Me" option.
 * Progressive enhancement - works without JavaScript.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}): Promise<React.JSX.Element> {
  // Check if already logged in
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { next } = await searchParams;

  if (user) {
    redirect(getSafeRedirect(next));
  }

  return (
    <Card className="border-border/70 bg-card/90 shadow-lg">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl font-bold text-foreground">
          Sign In
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter your credentials to access your account
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Only enable test admin button in non-production environments */}
        <LoginForm
          enableTestAdmin={process.env["VERCEL_ENV"] !== "production"}
          next={next}
        />
      </CardContent>
    </Card>
  );
}

import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { createClient } from "~/lib/supabase/server";
import { LoginForm } from "./login-form";

/**
 * Login Page
 *
 * Email/password authentication with "Remember Me" option.
 * Progressive enhancement - works without JavaScript.
 */
export default async function LoginPage(): Promise<React.JSX.Element> {
  // Check if already logged in
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
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
        <LoginForm />
      </CardContent>
    </Card>
  );
}

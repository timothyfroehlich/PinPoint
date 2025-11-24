import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { loginAction } from "~/app/(auth)/actions";
import { readFlash } from "~/lib/flash";
import { createClient } from "~/lib/supabase/server";
import { TestAdminButton } from "./TestAdminButton";

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

  // Read flash message (if any)
  const flash = await readFlash();

  /**
   * Client action wrapper for progressive enhancement
   * Handles redirect after successful login
   */
  async function handleLogin(formData: FormData): Promise<void> {
    "use server";

    const result = await loginAction(formData);

    if (result.ok) {
      redirect("/dashboard");
    }

    // If not ok, flash message was already set
    // Redirect back to login to show the error
    redirect("/login");
  }

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader className="space-y-2 !p-6 !pb-2">
        <CardTitle className="text-2xl font-bold text-foreground">
          Sign In
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter your credentials to access your account
        </p>
      </CardHeader>

      <CardContent className="space-y-6 !p-6 !pt-2">
        {/* Flash message */}
        {flash && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${
              flash.type === "error"
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-primary/10 text-primary border border-primary/20"
            }`}
            role="alert"
          >
            {flash.message}
          </div>
        )}

        {/* Login form */}
        <form action={handleLogin} className="space-y-6">
          {/* Email */}
          <div className="space-y-3">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              className="bg-input border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Password */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="bg-input border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Remember Me */}
          <div className="flex items-center space-x-2">
            <input
              id="rememberMe"
              name="rememberMe"
              type="checkbox"
              className="size-4 rounded border-border text-primary focus:ring-2 focus:ring-ring bg-input"
              defaultChecked
            />
            <Label
              htmlFor="rememberMe"
              className="text-sm font-normal cursor-pointer"
            >
              Remember me for 60 days
            </Label>
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            size="lg"
          >
            Sign In
          </Button>
        </form>

        {/* Test Admin Login Button */}
        <TestAdminButton />

        {/* Signup link */}
        <div className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link
            href="/signup"
            className="text-primary hover:underline font-medium"
          >
            Sign up
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

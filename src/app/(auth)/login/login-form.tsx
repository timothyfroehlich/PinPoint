"use client";

import type React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { loginAction, type LoginResult } from "~/app/(auth)/actions";
import { cn } from "~/lib/utils";
import { TestAdminButton } from "./TestAdminButton";

interface LoginFormProps {
  enableTestAdmin?: boolean;
}

export function LoginForm({
  enableTestAdmin = false,
}: LoginFormProps): React.JSX.Element {
  const [state, formAction] = useActionState<LoginResult | undefined, FormData>(
    loginAction,
    undefined
  );

  return (
    <>
      {/* Flash message */}
      {state && !state.ok && (
        <div
          className={cn(
            "rounded-lg px-4 py-3 text-sm",
            "border border-destructive/30 bg-destructive/10 text-destructive"
          )}
          role="alert"
        >
          {state.message}
        </div>
      )}

      {/* Login form */}
      <form action={formAction} className="space-y-6">
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
            defaultValue={
              !state?.ok && state?.meta?.submittedEmail
                ? state.meta.submittedEmail
                : ""
            }
            className="bg-input border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Password */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-sm text-link hover:underline"
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

      {/* Test Admin Login Button (Dev/Preview only) */}
      {enableTestAdmin && (
        <div className="space-y-2">
          <TestAdminButton />
        </div>
      )}

      {/* Signup link */}
      <div className="text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Link href="/signup" className="text-link hover:underline font-medium">
          Sign up
        </Link>
      </div>
    </>
  );
}

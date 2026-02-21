"use client";

import type React from "react";
import Link from "next/link";
import { useActionState, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { PasswordInput } from "~/components/ui/password-input";
import { Label } from "~/components/ui/label";
import { loginAction, type LoginResult } from "~/app/(auth)/actions";
import { cn } from "~/lib/utils";
import { TurnstileWidget } from "~/components/security/TurnstileWidget";

// Lazily load TestAdminButton to prevent including test credentials in the production bundle
const TestAdminButton = dynamic(() =>
  import("./TestAdminButton").then((mod) => mod.TestAdminButton)
);

interface LoginFormProps {
  enableTestAdmin?: boolean;
  next?: string | undefined;
}

export function LoginForm({
  enableTestAdmin = false,
  next,
}: LoginFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    LoginResult | undefined,
    FormData
  >(loginAction, undefined);
  const [turnstileToken, setTurnstileToken] = useState("");

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

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
        {/* Hidden field for redirect destination */}
        {next && <input type="hidden" name="next" value={next} />}

        {/* Email */}
        <div className="space-y-3">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="text"
            placeholder="you@example.com"
            autoComplete="username"
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
            <Link href="/forgot-password" className="text-sm text-link">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
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

        <input type="hidden" name="captchaToken" value={turnstileToken} />
        <TurnstileWidget
          onVerify={handleTurnstileVerify}
          onExpire={() => setTurnstileToken("")}
        />

        {/* Submit button */}
        <Button
          type="submit"
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          size="lg"
          loading={isPending}
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
        <Link href="/signup" className="text-link font-medium">
          Sign up
        </Link>
      </div>
    </>
  );
}

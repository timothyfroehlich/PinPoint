"use client";

import type React from "react";
import Link from "next/link";
import { useActionState, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { PasswordInput } from "~/components/ui/password-input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { loginAction, type LoginResult } from "~/app/(auth)/actions";
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
  const [rememberMe, setRememberMe] = useState(true);
  const hasTurnstile = Boolean(process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"]);
  const enforceCaptcha = hasTurnstile && process.env.NODE_ENV !== "test";

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  return (
    <>
      {/* Flash message */}
      {state && !state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
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
          <Checkbox
            id="rememberMe"
            name="rememberMe"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked === true)}
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
          className="w-full"
          size="lg"
          loading={isPending}
          disabled={isPending || (enforceCaptcha && !turnstileToken)}
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

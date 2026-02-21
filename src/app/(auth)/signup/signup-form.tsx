"use client";

import React, { useState, useActionState, useCallback } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { PasswordInput } from "~/components/ui/password-input";
import { PasswordMismatch } from "~/components/password-mismatch";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { PasswordStrength } from "~/components/password-strength";
import { signupAction, type SignupResult } from "~/app/(auth)/actions";
import { TurnstileWidget } from "~/components/security/TurnstileWidget";

interface SignupFormProps {
  initialData?:
    | {
        email?: string;
        firstName?: string;
        lastName?: string;
      }
    | undefined;
}

export function SignupForm({
  initialData,
}: SignupFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    SignupResult | undefined,
    FormData
  >(signupAction, undefined);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  if (state && !state.ok && state.code === "CONFIRMATION_REQUIRED") {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-6 text-center">
        <div className="rounded-full bg-primary/10 p-3 text-primary">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-8 w-8"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-on-surface">
            Check your email
          </h3>
          <p className="text-on-surface-variant text-sm text-balance">
            We sent a confirmation link to your email address. Please click the
            link to verify your account.
          </p>
        </div>
        <Button variant="outline" className="mt-4 w-full" asChild>
          <a href="/login">Go to Login</a>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* Error Message */}
      {state && !state.ok && (
        <div
          className="rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container"
          role="alert"
        >
          {state.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* First Name */}
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            required
            maxLength={50}
            className="bg-surface-variant"
            defaultValue={initialData?.firstName}
          />
        </div>

        {/* Last Name */}
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            required
            maxLength={50}
            className="bg-surface-variant"
            defaultValue={initialData?.lastName}
          />
        </div>
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="bg-surface-variant"
          defaultValue={initialData?.email}
          readOnly={!!initialData?.email}
        />
      </div>

      {/* Password */}
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          className="bg-surface-variant"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-on-surface-variant">Minimum 8 characters</p>

        {/* Password strength indicator */}
        <PasswordStrength password={password} />
      </div>

      {/* Confirm Password */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          className="bg-surface-variant"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <PasswordMismatch
          password={password}
          confirmPassword={confirmPassword}
        />
      </div>

      {/* Terms Agreement */}
      <div className="flex items-start space-x-3">
        <Checkbox
          id="termsAccepted"
          name="termsAccepted"
          required
          className="mt-1"
        />
        <Label
          htmlFor="termsAccepted"
          className="text-sm text-on-surface-variant leading-relaxed cursor-pointer"
        >
          I agree to the{" "}
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-link"
          >
            Terms of Service
          </Link>
        </Label>
      </div>

      <input type="hidden" name="captchaToken" value={turnstileToken} />
      <TurnstileWidget
        onVerify={handleTurnstileVerify}
        onExpire={() => setTurnstileToken("")}
      />

      <Button
        type="submit"
        className="w-full bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container"
        size="lg"
        loading={isPending}
      >
        Create Account
      </Button>
    </form>
  );
}

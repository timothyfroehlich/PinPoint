"use client";

import React, { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PasswordStrength } from "~/components/password-strength";
import { signupAction, type SignupResult } from "~/app/(auth)/actions";

function SubmitButton(): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="w-full bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container"
      size="lg"
      disabled={pending}
    >
      {pending ? "Creating Account..." : "Create Account"}
    </Button>
  );
}

export function SignupForm(): React.JSX.Element {
  const [state, formAction] = useActionState<
    SignupResult | undefined,
    FormData
  >(signupAction, undefined);
  const [password, setPassword] = useState("");

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
            placeholder="Jane"
            autoComplete="given-name"
            required
            maxLength={50}
            className="bg-surface-variant"
          />
        </div>

        {/* Last Name */}
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            name="lastName"
            type="text"
            placeholder="Doe"
            autoComplete="family-name"
            required
            maxLength={50}
            className="bg-surface-variant"
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
          placeholder="you@example.com"
          autoComplete="email"
          required
          className="bg-surface-variant"
        />
      </div>

      {/* Password */}
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
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

      <SubmitButton />
    </form>
  );
}

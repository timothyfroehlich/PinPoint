"use client";

import React, { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PasswordStrength } from "~/components/password-strength";
import { signupAction, type SignupResult } from "~/app/(auth)/actions";
import { useActionState } from "react";

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

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="Your name"
          autoComplete="name"
          required
          maxLength={100}
          className="bg-surface-variant"
        />
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

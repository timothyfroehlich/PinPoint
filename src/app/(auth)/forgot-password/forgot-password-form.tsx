"use client";

import React, { useActionState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { forgotPasswordAction } from "~/app/(auth)/actions";

export function ForgotPasswordForm(): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(
    forgotPasswordAction,
    undefined
  );

  return (
    <form action={formAction} className="space-y-4">
      {/* Message */}
      {state && !state.ok && (
        <div
          className="rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container"
          role="alert"
        >
          {state.message}
        </div>
      )}
      {state && state.ok && (
        <div
          className="rounded-lg px-4 py-3 text-sm bg-primary-container text-on-primary-container"
          role="alert"
        >
          If an account exists with that email, you will receive a password
          reset link shortly.
        </div>
      )}

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

      <Button
        type="submit"
        className="w-full bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container"
        size="lg"
        loading={isPending}
      >
        Send Reset Link
      </Button>
    </form>
  );
}

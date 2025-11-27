"use client";

import type React from "react";
import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  resetPasswordAction,
  type ResetPasswordResult,
} from "~/app/(auth)/actions";

export function ResetPasswordForm(): React.JSX.Element {
  const [state, formAction] = useActionState<
    ResetPasswordResult | undefined,
    FormData
  >(resetPasswordAction, undefined);

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

      {/* New Password */}
      <div className="space-y-2">
        <Label htmlFor="password">New Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          className="bg-surface-variant"
        />
        <p className="text-xs text-on-surface-variant">
          Must be at least 8 characters
        </p>
      </div>

      {/* Confirm Password */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          className="bg-surface-variant"
        />
      </div>

      {/* Submit button */}
      <Button
        type="submit"
        className="w-full bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container"
        size="lg"
      >
        Update Password
      </Button>
    </form>
  );
}

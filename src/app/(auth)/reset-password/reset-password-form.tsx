"use client";

import type React from "react";
import { useActionState, useState } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { PasswordInput } from "~/components/ui/password-input";
import { PasswordMismatch } from "~/components/password-mismatch";
import { PasswordStrength } from "~/components/password-strength";
import {
  resetPasswordAction,
  type ResetPasswordResult,
} from "~/app/(auth)/actions";

export function ResetPasswordForm(): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    ResetPasswordResult | undefined,
    FormData
  >(resetPasswordAction, undefined);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
        <p className="text-xs text-on-surface-variant">
          Must be at least 8 characters
        </p>
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
          minLength={8}
          maxLength={128}
          className="bg-surface-variant"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <PasswordMismatch
          password={password}
          confirmPassword={confirmPassword}
        />
      </div>

      {/* Submit button */}
      <Button
        type="submit"
        className="w-full bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container"
        size="lg"
        loading={isPending}
      >
        Update Password
      </Button>
    </form>
  );
}

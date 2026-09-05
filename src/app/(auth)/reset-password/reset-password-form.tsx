"use client";

import type React from "react";
import { useActionState, useState } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { PasswordInput } from "~/components/ui/password-input";
import { Alert, AlertDescription } from "~/components/ui/alert";
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
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {/* New Password */}
      <div className="space-y-2">
        <Label htmlFor="password">
          New Password{" "}
          <span aria-hidden="true" className="text-destructive-text">
            *
          </span>
        </Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          enterKeyHint="next"
          minLength={8}
          maxLength={128}
          className="bg-surface-variant"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Must be at least 8 characters
        </p>
        <PasswordStrength password={password} />
      </div>

      {/* Confirm Password */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">
          Confirm Password{" "}
          <span aria-hidden="true" className="text-destructive-text">
            *
          </span>
        </Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="off"
          required
          enterKeyHint="done"
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
        className="w-full"
        size="lg"
        loading={isPending}
        disabled={isPending}
      >
        Update Password
      </Button>
    </form>
  );
}

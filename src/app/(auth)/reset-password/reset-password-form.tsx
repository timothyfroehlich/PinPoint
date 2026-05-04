"use client";

import type React from "react";
import { useActionState, useCallback, useState } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { PasswordInput } from "~/components/ui/password-input";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { PasswordMismatch } from "~/components/password-mismatch";
import { PasswordStrength } from "~/components/password-strength";
import { TurnstileWidget } from "~/components/security/TurnstileWidget";
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
  const [turnstileToken, setTurnstileToken] = useState("");
  const hasTurnstile = Boolean(process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"]);
  const enforceCaptcha = hasTurnstile && process.env.NODE_ENV !== "test";

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

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
        <p className="text-xs text-muted-foreground">
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
        Update Password
      </Button>
    </form>
  );
}

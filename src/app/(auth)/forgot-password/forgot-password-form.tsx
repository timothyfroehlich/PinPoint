"use client";

import React, { useActionState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { forgotPasswordAction } from "~/app/(auth)/actions";
import { TurnstileWidget } from "~/components/security/TurnstileWidget";
import { useTurnstileGate } from "~/components/security/useTurnstileGate";

export function ForgotPasswordForm(): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(
    forgotPasswordAction,
    undefined
  );
  const turnstile = useTurnstileGate();

  return (
    <form action={formAction} className="space-y-4">
      {/* Message */}
      {state && !state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {state && state.ok && (
        // Success alert: migrated from bg-primary-container (deprecated MD token)
        // to default Alert variant. Original used primary-container colors, not
        // destructive — default variant is closest semantic match in the shadcn
        // Alert component (no dedicated success variant exists).
        <Alert>
          <AlertDescription>
            If an account exists with that email, you will receive a password
            reset link shortly.
          </AlertDescription>
        </Alert>
      )}

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">
          Email{" "}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </Label>
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

      <input type="hidden" name="captchaToken" value={turnstile.token} />
      <TurnstileWidget
        onVerify={turnstile.onVerify}
        onExpire={turnstile.onExpire}
        onError={turnstile.onError}
      />
      {turnstile.statusMessage && (
        <p
          aria-live="polite"
          className="text-sm text-muted-foreground text-center"
        >
          {turnstile.statusMessage}
        </p>
      )}

      <Button
        type="submit"
        className="w-full bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container"
        size="lg"
        loading={isPending}
        disabled={isPending || turnstile.submitDisabled}
      >
        Send Reset Link
      </Button>
    </form>
  );
}

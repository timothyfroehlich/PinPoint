"use client";

import React, { useState, useEffect } from "react";
import { useActionState } from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SaveCancelButtons } from "~/components/save-cancel-buttons";
import { changePasswordAction, type ChangePasswordResult } from "./actions";
import { cn } from "~/lib/utils";

export function ChangePasswordSection(): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    ChangePasswordResult | undefined,
    FormData
  >(changePasswordAction, undefined);

  // Control visibility of feedback (flash message and button state)
  const [showFeedback, setShowFeedback] = useState(false);

  // Show feedback when state updates
  useEffect(() => {
    if (state) {
      setShowFeedback(true);
    }
  }, [state]);

  // Reset key to force re-render on cancel
  const [resetKey, setResetKey] = useState(0);

  return (
    <form
      key={resetKey}
      action={formAction}
      className="space-y-6"
      data-testid="change-password-form"
    >
      {/* Flash message */}
      {state && !state.ok && showFeedback && (
        <div
          className={cn(
            "rounded-md border p-4 border-destructive/20 bg-destructive/10 text-destructive"
          )}
        >
          <p className="text-sm font-medium">{state.message}</p>
        </div>
      )}

      <div className="space-y-4 max-w-[320px]">
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current Password</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
          <Input
            id="confirmNewPassword"
            name="confirmNewPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
          />
        </div>
      </div>

      <div className="pt-2">
        <SaveCancelButtons
          isPending={isPending}
          isSuccess={!!state?.ok && showFeedback}
          onCancel={() => {
            setResetKey((k) => k + 1);
            setShowFeedback(false);
          }}
          saveLabel="Change Password"
        />
      </div>
    </form>
  );
}

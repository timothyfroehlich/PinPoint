"use client";

import React, { useState, useEffect } from "react";
import { useActionState } from "react";
import { SaveCancelButtons } from "~/components/save-cancel-buttons";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { updateProfileAction, type UpdateProfileResult } from "./actions";
import { cn } from "~/lib/utils";

interface ProfileFormProps {
  firstName: string;
  lastName: string;
  role: string;
}

export function ProfileForm({
  firstName,
  lastName,
  role,
}: ProfileFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    UpdateProfileResult | undefined,
    FormData
  >(updateProfileAction, undefined);

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
      data-testid="profile-form"
    >
      {/* Flash message */}
      {state && showFeedback && (
        <div
          className={cn(
            "rounded-md border p-4",
            state.ok
              ? "border-primary/20 bg-primary/10 text-primary"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          )}
        >
          <p className="text-sm font-medium">
            {state.ok ? "Profile updated successfully." : state.message}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={firstName}
            placeholder="Jane"
            required
            className="max-w-[240px]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={lastName}
            placeholder="Doe"
            required
            className="max-w-[240px]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Input
            id="role"
            name="role"
            value={role.charAt(0).toUpperCase() + role.slice(1)}
            disabled
            className="max-w-[240px] bg-muted"
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
          saveLabel="Update Profile"
        />
      </div>
    </form>
  );
}

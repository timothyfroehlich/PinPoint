"use client";

import type React from "react";
import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { updateProfileAction, type UpdateProfileResult } from "./actions";
import { cn } from "~/lib/utils";

interface ProfileFormProps {
  firstName: string;
  lastName: string;
}

export function ProfileForm({
  firstName,
  lastName,
}: ProfileFormProps): React.JSX.Element {
  const [state, formAction] = useActionState<
    UpdateProfileResult | undefined,
    FormData
  >(updateProfileAction, undefined);

  return (
    <form action={formAction} className="space-y-6">
      {/* Flash message */}
      {state && (
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
      </div>

      <Button type="submit">Update Profile</Button>
    </form>
  );
}

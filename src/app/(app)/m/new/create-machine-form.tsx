"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  createMachineAction,
  type CreateMachineResult,
} from "~/app/(app)/m/actions";
import { cn } from "~/lib/utils";
import {
  OwnerSelect,
  type OwnerSelectUser,
} from "~/components/machines/OwnerSelect";

interface CreateMachineFormProps {
  allUsers: OwnerSelectUser[];
  canSelectOwner: boolean;
}

export function CreateMachineForm({
  allUsers,
  canSelectOwner,
}: CreateMachineFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    CreateMachineResult | undefined,
    FormData
  >(createMachineAction, undefined);

  // Lift users state to client so we can append new users without full refresh
  const [users, setUsers] = useState<OwnerSelectUser[]>(allUsers);

  return (
    <>
      {/* Flash message */}
      {state && !state.ok && (
        <div
          className={cn(
            "mb-6 rounded-md border p-4",
            "border-destructive/20 bg-destructive/10 text-destructive"
          )}
        >
          <p className="text-sm font-medium">{state.message}</p>
        </div>
      )}

      <form action={formAction} className="space-y-6">
        {/* Machine Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-foreground">
            Machine Name *
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            required
            placeholder="e.g., Medieval Madness"
            className="border-outline bg-surface text-foreground placeholder:text-muted-foreground"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Enter the full name of the pinball machine
          </p>
        </div>

        {/* Machine Initials */}
        <div className="space-y-2">
          <Label htmlFor="initials" className="text-foreground">
            Initials *
          </Label>
          <Input
            id="initials"
            name="initials"
            type="text"
            required
            minLength={2}
            maxLength={6}
            placeholder="e.g., MM"
            className="border-outline bg-surface text-foreground placeholder:text-muted-foreground uppercase"
            onChange={(e) => {
              e.target.value = e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "");
            }}
          />
          <p className="text-xs text-muted-foreground">
            2-6 characters. Permanent unique identifier.
          </p>
        </div>

        {/* Owner Select (Admin/Technician Only) */}
        {canSelectOwner && (
          <OwnerSelect users={users} onUsersChange={setUsers} />
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            className="flex-1 bg-primary text-on-primary hover:bg-primary/90"
            loading={isPending}
          >
            Create Machine
          </Button>
          <Link href="/m" className="flex-1">
            <Button
              type="button"
              variant="outline"
              className="w-full border-outline text-foreground hover:bg-surface-variant"
            >
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </>
  );
}

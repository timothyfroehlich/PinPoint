"use client";

import type React from "react";
import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  updateMachineAction,
  type UpdateMachineResult,
} from "~/app/(app)/m/actions";
import { cn } from "~/lib/utils";
import { OwnerSelect } from "~/components/machines/OwnerSelect";
import { type machines } from "~/server/db/schema";

interface UpdateMachineFormProps {
  machine: typeof machines.$inferSelect & { owner?: { id: string } | null };
  allUsers: { id: string; name: string }[];
  isAdmin: boolean;
}

export function UpdateMachineForm({
  machine,
  allUsers,
  isAdmin,
}: UpdateMachineFormProps): React.JSX.Element {
  const [state, formAction] = useActionState<
    UpdateMachineResult | undefined,
    FormData
  >(updateMachineAction, undefined);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="id" value={machine.id} />
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
      {state && state.ok && (
        <div
          className={cn(
            "mb-6 rounded-md border p-4",
            "border-green-200 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300"
          )}
        >
          <p className="text-sm font-medium">Machine updated successfully!</p>
        </div>
      )}

      {/* Machine Initials (Read Only) */}
      <div className="space-y-2">
        <Label htmlFor="initials" className="text-on-surface">
          Initials
        </Label>
        <Input
          id="initials"
          value={machine.initials}
          disabled
          className="border-outline bg-surface-variant text-on-surface-variant"
        />
        <p className="text-xs text-on-surface-variant">
          Machine initials cannot be changed
        </p>
      </div>

      {/* Machine Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-on-surface">
          Machine Name *
        </Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={machine.name}
          placeholder="e.g., Medieval Madness"
          className="border-outline bg-surface text-on-surface placeholder:text-on-surface-variant"
          autoFocus
        />
        <p className="text-xs text-on-surface-variant">
          Enter the full name of the pinball machine
        </p>
      </div>

      {/* Owner Select (Admin Only) */}
      {isAdmin && (
        <OwnerSelect
          users={allUsers}
          defaultValue={machine.owner?.id ?? null}
        />
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          className="flex-1 bg-primary text-on-primary hover:bg-primary/90"
        >
          Update Machine
        </Button>
      </div>
    </form>
  );
}

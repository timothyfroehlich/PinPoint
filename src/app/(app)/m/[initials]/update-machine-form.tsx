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

import type { UnifiedUser } from "~/lib/types";

interface UpdateMachineFormProps {
  machine: {
    id: string;
    name: string;
    initials: string;
    ownerId: string | null;
    invitedOwnerId: string | null;
    owner?: {
      id: string;
      name: string;
      avatarUrl?: string | null;
      email?: string;
    } | null;
    invitedOwner?: {
      id: string;
      name: string;
      email?: string;
    } | null;
  };
  allUsers: UnifiedUser[];
  canUpdate: boolean;
}

export function UpdateMachineForm({
  machine,
  allUsers,
  canUpdate,
}: UpdateMachineFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
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
            "border-green-900/50 bg-green-900/20 text-green-300"
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
          readOnly={!canUpdate}
          autoFocus
        />
        <p className="text-xs text-on-surface-variant">
          Enter the full name of the pinball machine
        </p>
      </div>

      {/* Machine Owner */}
      {canUpdate ? (
        <OwnerSelect
          users={allUsers}
          defaultValue={machine.ownerId ?? machine.invitedOwnerId ?? null}
        />
      ) : (
        <div className="space-y-2" data-testid="owner-display">
          <span className="text-sm font-semibold text-on-surface">
            Machine Owner
          </span>
          <div className="rounded-md border border-outline bg-surface px-3 py-2">
            {machine.owner || machine.invitedOwner ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-on-surface">
                  {machine.owner?.name ?? machine.invitedOwner?.name}
                </span>
                {/* Show invited badge only for truly invited owners (not yet accepted) */}
                {machine.invitedOwner && !machine.owner && (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant/70">
                    (Invited)
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-on-surface-variant">
                No owner assigned
              </span>
            )}
          </div>
          <p className="text-xs text-on-surface-variant">
            The owner receives notifications for new issues on this machine.
          </p>
        </div>
      )}

      {/* Actions */}
      {canUpdate && (
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            className="flex-1 bg-primary text-on-primary hover:bg-primary/90"
            loading={isPending}
          >
            Update Machine
          </Button>
        </div>
      )}
    </form>
  );
}

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
import { OpdbModelSelect } from "~/components/machines/OpdbModelSelect";
import type { OpdbModelSelection } from "~/lib/opdb/types";

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
  const [selectedModel, setSelectedModel] = useState<OpdbModelSelection | null>(
    null
  );
  const [machineName, setMachineName] = useState("");

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
        <OpdbModelSelect
          selectedModel={selectedModel}
          onSelect={(selection) => {
            setSelectedModel(selection);
            if (selection) {
              setMachineName(selection.title);
            }
          }}
          allowClear
        />

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
            value={machineName}
            onChange={(event) => setMachineName(event.target.value)}
            readOnly={selectedModel !== null}
            placeholder="e.g., Medieval Madness"
            className="border-outline bg-surface text-on-surface placeholder:text-on-surface-variant"
          />
          <p className="text-xs text-on-surface-variant">
            {selectedModel
              ? "Machine name is locked to the selected OPDB model."
              : "Enter the full name of the pinball machine"}
          </p>
        </div>

        {/* Machine Initials */}
        <div className="space-y-2">
          <Label htmlFor="initials" className="text-on-surface">
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
            className="border-outline bg-surface text-on-surface placeholder:text-on-surface-variant uppercase"
            onChange={(e) => {
              e.target.value = e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "");
            }}
          />
          <p className="text-xs text-on-surface-variant">
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
              className="w-full border-outline text-on-surface hover:bg-surface-variant"
            >
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </>
  );
}

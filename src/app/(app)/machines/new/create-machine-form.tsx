"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  createMachineAction,
  type CreateMachineResult,
} from "~/app/(app)/machines/actions";
import { cn } from "~/lib/utils";
import { redirect } from "next/navigation";

export function CreateMachineForm(): React.JSX.Element {
  const [state, formAction] = useActionState<CreateMachineResult, FormData>(
    createMachineAction,
    undefined
  );

  if (state?.ok) {
    redirect(`/machines/${state.data.machineId}`);
  }

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
          <Label htmlFor="name" className="text-on-surface">
            Machine Name *
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            required
            placeholder="e.g., Medieval Madness"
            className="border-outline bg-surface text-on-surface placeholder:text-on-surface-variant"
            autoFocus
          />
          <p className="text-xs text-on-surface-variant">
            Enter the full name of the pinball machine
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            className="flex-1 bg-primary text-on-primary hover:bg-primary/90"
          >
            Create Machine
          </Button>
          <Link href="/machines" className="flex-1">
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

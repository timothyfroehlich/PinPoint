"use client";

import type React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  createIssueAction,
  type CreateIssueResult,
} from "~/app/(app)/issues/actions";
import { cn } from "~/lib/utils";

interface CreateIssueFormProps {
  machines: { id: string; name: string }[];
  prefilledMachineId?: string;
}

export function CreateIssueForm({
  machines,
  prefilledMachineId,
}: CreateIssueFormProps): React.JSX.Element {
  const [state, formAction] = useActionState<
    CreateIssueResult | undefined,
    FormData
  >(createIssueAction, undefined);

  return (
    <>
      {/* Flash message */}
      {state && !state.ok && (
        <div
          className={cn(
            "mb-6 rounded-md border px-4 py-3 text-sm",
            "border-destructive/20 bg-destructive/10 text-destructive"
          )}
        >
          {state.message}
        </div>
      )}

      {/* Create Issue Form */}
      <form action={formAction} className="space-y-6">
        {/* Machine Selector */}
        <div className="space-y-2">
          <Label htmlFor="machineId" className="text-on-surface">
            Machine *
          </Label>
          <select
            id="machineId"
            name="machineId"
            defaultValue={prefilledMachineId ?? machines[0]?.id ?? ""}
            required
            className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
          >
            {prefilledMachineId == null && !machines.length && (
              <option value="" disabled>
                Select a machine
              </option>
            )}
            {machines.map((machine) => (
              <option key={machine.id} value={machine.id}>
                {machine.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-on-surface-variant">
            Select the machine with the issue
          </p>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title" className="text-on-surface">
            Issue Title *
          </Label>
          <Input
            id="title"
            name="title"
            type="text"
            required
            maxLength={200}
            placeholder="Brief description of the issue"
            className="border-outline-variant bg-surface text-on-surface"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-on-surface">
            Description
          </Label>
          <Textarea
            id="description"
            name="description"
            rows={4}
            placeholder="Additional details about the issue (optional)"
            className="border-outline-variant bg-surface text-on-surface"
          />
        </div>

        {/* Severity */}
        <div className="space-y-2">
          <Label htmlFor="severity" className="text-on-surface">
            Severity *
          </Label>
          <select
            id="severity"
            name="severity"
            defaultValue="playable"
            required
            className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
          >
            <option value="minor">
              Minor (cosmetic, doesn&apos;t affect gameplay)
            </option>
            <option value="playable">
              Playable (affects gameplay but machine is playable)
            </option>
            <option value="unplayable">
              Unplayable (machine cannot be played)
            </option>
          </select>
          <p className="text-xs text-on-surface-variant">
            How severely does this issue affect the machine?
          </p>
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <Label htmlFor="priority" className="text-on-surface">
            Priority *
          </Label>
          <select
            id="priority"
            name="priority"
            defaultValue="low"
            required
            className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <p className="text-xs text-on-surface-variant">
            How urgent is this issue?
          </p>
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            className="flex-1 bg-primary text-on-primary hover:bg-primary/90"
          >
            Report Issue
          </Button>
          <Button
            asChild
            type="button"
            variant="outline"
            className="border-outline-variant text-on-surface"
          >
            <Link href="/issues">Cancel</Link>
          </Button>
        </div>
      </form>
    </>
  );
}

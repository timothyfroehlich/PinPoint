"use client";

import type React from "react";
import { useActionState, useEffect, useState, startTransition } from "react";
import {
  reassignIssueMachineAction,
  type ReassignIssueMachineResult,
} from "~/app/(app)/issues/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { MachinePickerList } from "~/components/machines/MachineCombobox";

interface ReassignMachineCandidate {
  initials: string;
  name: string;
}

interface ReassignMachineFormProps {
  issueId: string;
  currentInitials: string;
  machines: ReassignMachineCandidate[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReassignMachineForm({
  issueId,
  currentInitials,
  machines,
  open,
  onOpenChange,
}: ReassignMachineFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    ReassignIssueMachineResult | undefined,
    FormData
  >(reassignIssueMachineAction, undefined);
  const [selectedInitials, setSelectedInitials] = useState<string | null>(null);

  // The action redirects on success, so this form unmounts during the
  // navigation — no client-side state.ok handler needed. The only
  // post-action work happens here when the action returns an error Result.

  // Reset selection when the dialog reopens so the user starts fresh.
  useEffect(() => {
    if (open) {
      setSelectedInitials(null);
    }
  }, [open]);

  const candidates = machines.filter((m) => m.initials !== currentInitials);

  const handleConfirm = (): void => {
    if (!selectedInitials) return;
    const formData = new FormData();
    formData.append("issueId", issueId);
    formData.append("newMachineInitials", selectedInitials);
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Move issue to another machine</AlertDialogTitle>
          <AlertDialogDescription>
            The issue&apos;s URL will change. Existing links to it will no
            longer work.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <MachinePickerList
          machines={candidates.map((machine) => ({
            value: machine.initials,
            name: machine.name,
            initials: machine.initials,
          }))}
          selectedValue={selectedInitials}
          onSelect={setSelectedInitials}
          className="rounded-md border"
          commandTestId="reassign-command"
          optionTestId={(machine) => `reassign-option-${machine.initials}`}
          emptyText="No matching machines."
        />

        {state && !state.ok && (
          <p className="text-sm text-destructive">{state.message}</p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={!selectedInitials || isPending}
            data-testid="reassign-confirm"
          >
            {isPending ? "Moving…" : "Move issue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

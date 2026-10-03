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
  /**
   * Where focus goes when the dialog closes. The dialog has no trigger of its
   * own (it opens from a button or a menu item), so without this focus falls
   * to `<body>`.
   */
  returnFocusTo?: () => HTMLElement | null;
}

export function ReassignMachineForm({
  issueId,
  currentInitials,
  machines,
  open,
  onOpenChange,
  returnFocusTo,
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
      <AlertDialogContent
        // Never taller than the viewport: the machine list gives up height
        // first, then the dialog scrolls, so every control stays reachable
        // on a short or zoomed screen (WCAG 1.4.10).
        className="flex max-h-[calc(100dvh-2rem)] max-w-md flex-col overflow-y-auto"
        onCloseAutoFocus={(event) => {
          const target = returnFocusTo?.();
          if (target) {
            event.preventDefault();
            target.focus();
          }
        }}
      >
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
          className="h-auto min-h-32 shrink rounded-md border"
          listClassName="min-h-0"
          // 44px rows on phones (spec issue-detail §13.2).
          itemClassName="max-md:min-h-11"
          commandTestId="reassign-command"
          optionTestId={(machine) => `reassign-option-${machine.initials}`}
          emptyText="No matching machines."
        />

        {state && !state.ok && (
          <div className="text-sm text-destructive-text">{state.message}</div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} className="max-md:min-h-11">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="max-md:min-h-11"
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

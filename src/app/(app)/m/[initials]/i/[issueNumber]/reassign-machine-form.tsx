"use client";

import type React from "react";
import { useActionState, useEffect, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { cn } from "~/lib/utils";

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
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    ReassignIssueMachineResult | undefined,
    FormData
  >(reassignIssueMachineAction, undefined);
  const [selectedInitials, setSelectedInitials] = useState<string | null>(null);

  // Navigate on success and close the dialog. We can't call router.push() from
  // inside the action because the action returns a Result for useActionState,
  // not a redirect — see actions.ts for the rationale.
  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.push(state.value.newUrl);
    }
  }, [state, router, onOpenChange]);

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

        <Command className="rounded-md border" data-testid="reassign-command">
          <CommandInput placeholder="Search machines…" />
          <CommandList>
            <CommandEmpty>No matching machines.</CommandEmpty>
            <CommandGroup>
              {candidates.map((machine) => {
                const selected = machine.initials === selectedInitials;
                return (
                  <CommandItem
                    key={machine.initials}
                    value={`${machine.name} ${machine.initials}`}
                    onSelect={() => {
                      setSelectedInitials(machine.initials);
                    }}
                    data-testid={`reassign-option-${machine.initials}`}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        selected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1 truncate">{machine.name}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {machine.initials}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>

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

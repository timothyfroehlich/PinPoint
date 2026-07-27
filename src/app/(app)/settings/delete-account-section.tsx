"use client";

import React, { useState, startTransition } from "react";
import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { deleteAccountAction, type DeleteAccountResult } from "./actions";

interface MemberOption {
  id: string;
  name: string;
}

interface DeleteAccountSectionProps {
  ownedMachineCount: number;
  members: MemberOption[];
  isSoleAdmin: boolean;
}

export function DeleteAccountSection({
  ownedMachineCount,
  members,
  isSoleAdmin,
}: DeleteAccountSectionProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    DeleteAccountResult | undefined,
    FormData
  >(deleteAccountAction, undefined);

  const [confirmText, setConfirmText] = useState("");
  const [reassignTo, setReassignTo] = useState<string>("__unassigned__");
  const [isOpen, setIsOpen] = useState(false);

  const isConfirmed = confirmText === "DELETE";

  // Snapshot the live form DOM and dispatch straight to the action, instead of
  // carrying `action={formAction}` on the <form> (PP-1ajq).
  //
  // React 19 auto-resets a `<form action={...}>` once the action settles —
  // failure included — and this dialog has no close-on-failure path.
  // @radix-ui/react-select >=2.3.3 replays its mount-time value through
  // `onValueChange` on that reset, so a failed delete silently threw away the
  // new machine owner the user had picked (dropping the hidden `reassignTo`
  // field back to ""), while the controlled confirmation text survived and
  // kept the destructive button enabled. Dispatching directly means no form
  // submission ever completes, so React never fires the reset. Same remedy as
  // PP-0fvr; sanctioned exception to CORE-ARCH-002 — the form lives inside a
  // Radix AlertDialog, so there is no no-JS story to preserve.
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    // Ignore submits bubbled up from a descendant form. React propagates events
    // through the React tree, not the DOM tree, so a portalled `<form>` in any
    // nested dialog would otherwise land here and be cancelled by our
    // `preventDefault()`. There is no such form today; the guard keeps one from
    // silently breaking later.
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // useActionState dispatch must run inside a transition — outside one React
    // 19 silently skips the server action.
    startTransition(() => {
      formAction(fd);
    });
  };

  return (
    <div className="space-y-4">
      {isSoleAdmin && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-destructive">
          <p className="text-sm font-medium">
            You are the only admin. Promote another user to admin before
            deleting your account.
          </p>
        </div>
      )}

      <AlertDialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setConfirmText("");
            setReassignTo("__unassigned__");
          }
        }}
      >
        <AlertDialogTrigger asChild>
          <Button
            variant="destructive"
            data-testid="delete-account-trigger"
            disabled={isSoleAdmin}
          >
            Delete My Account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="sm:max-w-[500px]">
          {/* No `action={formAction}` on purpose — see `handleSubmit` (PP-1ajq). */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/*
              The failure banner belongs INSIDE the dialog. A failed delete
              leaves this dialog open (there is no close-on-failure path), so a
              banner rendered on the settings page behind the modal overlay was
              invisible at exactly the moment it mattered — the button simply
              flipped back from "Deleting…" and the user re-clicked. Keeping it
              here is also what makes the preserved reassignment (see
              `handleSubmit`) observable rather than merely correct.
            */}
            {state && !state.ok && (
              <div
                role="alert"
                className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-destructive"
              >
                <p className="text-sm font-medium">{state.message}</p>
              </div>
            )}

            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4 text-foreground">
                  {isSoleAdmin && (
                    <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-destructive">
                      <p className="text-sm font-semibold">
                        Critical Error: Sole Admin Constraint
                      </p>
                      <p className="text-xs">
                        You are the only administrator. System security requires
                        at least one active admin. Please promote another user
                        before proceeding.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p>
                      This action is{" "}
                      <strong className="text-destructive underline">
                        permanent and cannot be undone
                      </strong>
                      . Your profile and preferences will be deleted.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Contributions (issues, comments) will be anonymized to
                      preserve history while removing your identity.
                    </p>
                  </div>

                  {ownedMachineCount > 0 && (
                    <div className="space-y-3 rounded-lg border border-warning/30 bg-warning-container/30 p-4">
                      <p className="text-sm font-medium text-on-warning-container">
                        Machine Reassignment Needed
                      </p>
                      <p className="text-xs text-on-warning-container/80">
                        You own {ownedMachineCount}{" "}
                        {ownedMachineCount === 1 ? "machine" : "machines"}.
                        Choose a new owner:
                      </p>
                      <Select
                        value={reassignTo}
                        onValueChange={setReassignTo}
                        name="reassignToSelect"
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select a member..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unassigned__">
                            Leave unassigned
                          </SelectItem>
                          {members.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <input
                        type="hidden"
                        name="reassignTo"
                        value={
                          reassignTo === "__unassigned__" ? "" : reassignTo
                        }
                      />
                    </div>
                  )}

                  <div className="space-y-2 pt-2">
                    <Label
                      htmlFor="confirmation"
                      className="text-sm font-semibold"
                    >
                      To confirm, type{" "}
                      <span className="select-all">DELETE</span> in the box
                      below
                    </Label>
                    <Input
                      id="confirmation"
                      name="confirmation"
                      placeholder='Type "DELETE"'
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      autoComplete="off"
                      className="uppercase"
                      data-testid="delete-confirmation-input"
                    />
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter className="gap-2 sm:gap-0">
              <AlertDialogCancel>Keep Account</AlertDialogCancel>
              <Button
                type="submit"
                variant="destructive"
                disabled={!isConfirmed || isPending || isSoleAdmin}
                className="w-full sm:w-auto"
                data-testid="delete-account-confirm"
              >
                {isPending ? "Deleting..." : "Permanently Delete Account"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

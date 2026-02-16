"use client";

import React, { useState } from "react";
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

  return (
    <div className="space-y-4">
      {state && !state.ok && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-destructive">
          <p className="text-sm font-medium">{state.message}</p>
        </div>
      )}

      {isSoleAdmin && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-destructive">
          <p className="text-sm font-medium">
            You are the only admin. Promote another user to admin before
            deleting your account.
          </p>
        </div>
      )}

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
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
          <form action={formAction} className="space-y-6">
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
                    <div className="space-y-3 rounded-lg border border-amber-500/20 bg-amber-50/50 p-4 dark:bg-amber-950/20">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                        Machine Reassignment Needed
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">
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
              <AlertDialogCancel
                onClick={() => {
                  setConfirmText("");
                  setIsOpen(false);
                }}
              >
                Keep Account
              </AlertDialogCancel>
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

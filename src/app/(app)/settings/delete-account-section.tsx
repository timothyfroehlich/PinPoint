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
  AlertDialogAction,
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
}

export function DeleteAccountSection({
  ownedMachineCount,
  members,
}: DeleteAccountSectionProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    DeleteAccountResult | undefined,
    FormData
  >(deleteAccountAction, undefined);

  const [confirmText, setConfirmText] = useState("");
  const [reassignTo, setReassignTo] = useState<string>("__unassigned__");

  const isConfirmed = confirmText === "DELETE";

  return (
    <div className="space-y-4">
      {state && !state.ok && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-destructive">
          <p className="text-sm font-medium">{state.message}</p>
        </div>
      )}

      {ownedMachineCount > 0 && (
        <div className="rounded-md border border-amber-500/20 bg-amber-50 p-4 dark:bg-amber-950/20">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            You own {ownedMachineCount}{" "}
            {ownedMachineCount === 1 ? "machine" : "machines"}. Choose what
            happens to them:
          </p>
          <div className="mt-3 max-w-[280px]">
            <Label htmlFor="reassignTo" className="text-sm">
              Reassign machines to
            </Label>
            <Select
              value={reassignTo}
              onValueChange={setReassignTo}
              name="reassignToSelect"
            >
              <SelectTrigger id="reassignTo" className="mt-1">
                <SelectValue placeholder="Select a member..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned__">Leave unassigned</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" data-testid="delete-account-trigger">
            Delete My Account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <form action={formAction}>
            <input
              type="hidden"
              name="reassignTo"
              value={reassignTo === "__unassigned__" ? "" : reassignTo}
            />
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <p>
                    This action is{" "}
                    <strong>permanent and cannot be undone</strong>. Your
                    profile, notification preferences, and watch lists will be
                    deleted. Your issues, comments, and images will be
                    anonymized (author information removed) to preserve the
                    maintenance history.
                  </p>
                  <p>
                    Type <strong>DELETE</strong> below to confirm.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="my-4">
              <Label htmlFor="confirmation" className="sr-only">
                Type DELETE to confirm
              </Label>
              <Input
                id="confirmation"
                name="confirmation"
                placeholder='Type "DELETE" to confirm'
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                data-testid="delete-confirmation-input"
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmText("")}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                variant="destructive"
                disabled={!isConfirmed || isPending}
                data-testid="delete-account-confirm"
              >
                {isPending ? "Deleting..." : "Delete My Account"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

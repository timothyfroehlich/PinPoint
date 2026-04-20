"use client";

import type React from "react";
import { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Alert, AlertDescription } from "~/components/ui/alert";

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
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);

  // Open promote dialog when server returns ASSIGNEE_NOT_MEMBER
  useEffect(() => {
    if (state && !state.ok && state.code === "ASSIGNEE_NOT_MEMBER") {
      setIsPromoteOpen(true);
    }
  }, [state]);

  // Assignee from ASSIGNEE_NOT_MEMBER result
  const assignee =
    state && !state.ok && state.code === "ASSIGNEE_NOT_MEMBER"
      ? state.meta?.assignee
      : undefined;

  return (
    <>
      {/* Flash message — suppress ASSIGNEE_NOT_MEMBER only while the promote
          dialog is open and handling it. After dismissal (Cancel/Escape) the
          inline error is shown so the user has guidance on what happened. */}
      {state &&
        !state.ok &&
        (state.code !== "ASSIGNEE_NOT_MEMBER" || !isPromoteOpen) && (
          <div
            className={cn(
              "mb-6 rounded-md border p-4",
              "border-destructive/20 bg-destructive/10 text-destructive"
            )}
          >
            <p className="text-sm font-medium">{state.message}</p>
          </div>
        )}

      <form id="create-machine-form" action={formAction} className="space-y-6">
        {/* Machine Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-foreground">
            Machine Name *
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            required
            placeholder="e.g., Medieval Madness"
            className="border-outline bg-surface text-foreground placeholder:text-muted-foreground"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Enter the full name of the pinball machine
          </p>
        </div>

        {/* Machine Initials */}
        <div className="space-y-2">
          <Label htmlFor="initials" className="text-foreground">
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
            className="border-outline bg-surface text-foreground placeholder:text-muted-foreground uppercase"
            onChange={(e) => {
              e.target.value = e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "");
            }}
          />
          <p className="text-xs text-muted-foreground">
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
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            loading={isPending}
          >
            Create Machine
          </Button>
          <Link href="/m" className="flex-1">
            <Button
              type="button"
              variant="outline"
              className="w-full border-outline text-foreground hover:bg-surface-variant"
            >
              Cancel
            </Button>
          </Link>
        </div>
      </form>

      {/*
       * Promote-on-assign dialog. The "Promote and assign" button uses the
       * `form="create-machine-form"` attribute to associate with the form
       * even though Radix Dialog portals it outside the form's DOM tree.
       * `name`/`value` on the submit button injects forcePromoteUserId into
       * the submitted FormData — natively, no requestSubmit() needed. This
       * sidesteps the React server-action submit-interception race that
       * affected programmatic requestSubmit() from a closing dialog.
       */}
      {assignee && (
        <Dialog
          open={isPromoteOpen}
          onOpenChange={(o) => {
            if (!o) {
              setIsPromoteOpen(false);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Promote to member and assign?</DialogTitle>
              <DialogDescription>
                This updates the user&apos;s role and assigns them as owner.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <p>
                <strong>{assignee.name}</strong>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground ml-1">
                  {assignee.type === "invited"
                    ? "(Invited · Guest)"
                    : "(Guest)"}
                </span>{" "}
                is currently a guest. Assigning them as owner of this machine
                will promote them to member.
              </p>
              <p className="text-sm text-muted-foreground">
                As a member they&apos;ll be able to edit the machine&apos;s
                details, owner notes, tournament notes, and owner requirements.
              </p>
              <Alert>
                <AlertDescription>
                  Promotion and assignment run in one transaction — both succeed
                  or both roll back.
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsPromoteOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="create-machine-form"
                name="forcePromoteUserId"
                value={assignee.id}
                onClick={() => {
                  // Close the dialog after the click. The native submit fires
                  // first, capturing forcePromoteUserId before unmount.
                  setIsPromoteOpen(false);
                }}
              >
                Promote and assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

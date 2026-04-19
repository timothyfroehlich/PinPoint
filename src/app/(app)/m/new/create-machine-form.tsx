"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);

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

  const confirmPromote = (): void => {
    if (!assignee || !formRef.current) return;
    setIsPromoteOpen(false);

    // Inject the hidden forcePromoteUserId field and re-submit
    const hiddenInput = document.createElement("input");
    hiddenInput.type = "hidden";
    hiddenInput.name = "forcePromoteUserId";
    hiddenInput.value = assignee.id;
    formRef.current.appendChild(hiddenInput);
    formRef.current.requestSubmit();
    formRef.current.removeChild(hiddenInput);
  };

  return (
    <>
      {/* Flash message — suppress ASSIGNEE_NOT_MEMBER since it opens a dialog */}
      {state && !state.ok && state.code !== "ASSIGNEE_NOT_MEMBER" && (
        <div
          className={cn(
            "mb-6 rounded-md border p-4",
            "border-destructive/20 bg-destructive/10 text-destructive"
          )}
        >
          <p className="text-sm font-medium">{state.message}</p>
        </div>
      )}

      <form ref={formRef} action={formAction} className="space-y-6">
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

      {/* Promote guest to member confirmation */}
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
                    ? "(INVITED · GUEST)"
                    : "(GUEST)"}
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
              <Button variant="outline" onClick={() => setIsPromoteOpen(false)}>
                Cancel
              </Button>
              <Button onClick={confirmPromote}>Promote and assign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

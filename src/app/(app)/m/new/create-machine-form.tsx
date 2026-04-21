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
  type AssigneeNotMemberMeta,
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

  // Promote dialog state — populated when server returns ASSIGNEE_NOT_MEMBER
  const [promoteAssignee, setPromoteAssignee] = useState<
    AssigneeNotMemberMeta["assignee"] | null
  >(null);
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);

  // Controlled hidden input value for forcePromoteUserId on re-submission
  const [forcePromoteUserId, setForcePromoteUserId] = useState("");

  // Ref to the outer form for programmatic re-submission
  const formRef = useRef<HTMLFormElement>(null);

  // Track whether we need to submit after forcePromoteUserId state flushes
  const [pendingSubmit, setPendingSubmit] = useState(false);

  // Open the promote dialog when server returns ASSIGNEE_NOT_MEMBER
  useEffect(() => {
    if (
      state &&
      !state.ok &&
      state.code === "ASSIGNEE_NOT_MEMBER" &&
      state.meta?.assignee &&
      !isPromoteOpen
    ) {
      setPromoteAssignee(state.meta.assignee);
      setIsPromoteOpen(true);
    }
  }, [state, isPromoteOpen]);

  // Submit after forcePromoteUserId has been set in state (ensures React flushed it)
  useEffect(() => {
    if (pendingSubmit && forcePromoteUserId) {
      setPendingSubmit(false);
      formRef.current?.requestSubmit();
    }
  }, [pendingSubmit, forcePromoteUserId]);

  const confirmPromote = (): void => {
    if (!promoteAssignee) return;
    setForcePromoteUserId(promoteAssignee.id);
    setIsPromoteOpen(false);
    // Signal that we want to submit after state flushes
    setPendingSubmit(true);
  };

  const cancelPromote = (): void => {
    setIsPromoteOpen(false);
    setPromoteAssignee(null);
    setForcePromoteUserId("");
  };

  return (
    <>
      {/* Flash message (non-ASSIGNEE_NOT_MEMBER errors) */}
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

      {/*
       * Promote-and-assign confirmation dialog.
       * Duplicated from update-machine-form.tsx — pending extraction at 3rd consumer.
       *
       * Radix portals the DialogContent outside the form tree, so the confirm
       * button cannot use type="submit" to target the outer form. Instead we
       * use a state-driven hidden input + requestAnimationFrame to ensure React
       * flushes the forcePromoteUserId state before programmatic requestSubmit.
       */}
      <Dialog open={isPromoteOpen} onOpenChange={setIsPromoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote to member and assign?</DialogTitle>
            <DialogDescription>
              This updates the user&apos;s role and assigns them as owner.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p>
              <strong>{promoteAssignee?.name}</strong>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground ml-1">
                {promoteAssignee?.type === "invited"
                  ? "(INVITED · GUEST)"
                  : "(GUEST)"}
              </span>{" "}
              is currently a guest. Assigning them as owner of this machine will
              promote them to member.
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
            <Button variant="outline" onClick={cancelPromote}>
              Cancel
            </Button>
            <Button onClick={confirmPromote}>Promote and assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <form
        ref={formRef}
        action={formAction}
        id="create-machine-form"
        className="space-y-6"
      >
        {/* State-driven hidden input for re-submission with forcePromoteUserId */}
        <input
          type="hidden"
          name="forcePromoteUserId"
          value={forcePromoteUserId}
        />

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
            className="flex-1 bg-primary text-on-primary hover:bg-primary/90"
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
    </>
  );
}

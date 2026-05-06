"use client";

import type React from "react";
import { useState, useRef, useEffect, startTransition } from "react";
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
import { Alert, AlertDescription } from "~/components/ui/alert";

interface CreateMachineFormProps {
  allUsers: OwnerSelectUser[];
  canSelectOwner: boolean;
}

export function CreateMachineForm({
  allUsers,
  canSelectOwner,
}: CreateMachineFormProps): React.JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<
    CreateMachineResult | undefined,
    FormData
  >(createMachineAction, undefined);

  // Lift users state to client so we can append new users without full refresh
  const [users, setUsers] = useState<OwnerSelectUser[]>(allUsers);

  // Controlled field values so they survive re-renders after server action errors
  const [nameValue, setNameValue] = useState("");
  const [initialsValue, setInitialsValue] = useState("");
  const [ownerIdValue, setOwnerIdValue] = useState("");
  // Bumped on reset to remount OwnerSelect (which holds its own internal state).
  const [ownerSelectKey, setOwnerSelectKey] = useState(0);

  // Promote dialog state — populated when server returns ASSIGNEE_NOT_MEMBER
  const [promoteAssignee, setPromoteAssignee] = useState<
    AssigneeNotMemberMeta["assignee"] | null
  >(null);
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);

  // Clear-button confirmation
  const [isClearOpen, setIsClearOpen] = useState(false);

  // Snapshot of the form's field values captured at first submission time,
  // so the promote-confirm re-submission has the correct data even if the
  // server action response caused a component re-render.
  const submittedDataRef = useRef<{
    name: string;
    initials: string;
    ownerId: string;
  } | null>(null);

  // Track the last state we've already handled to avoid re-opening on cancel
  const handledStateRef = useRef<typeof state>(undefined);

  const resetForm = (): void => {
    formRef.current?.reset();
    setNameValue("");
    setInitialsValue("");
    setOwnerIdValue("");
    setOwnerSelectKey((k) => k + 1);
  };

  // Open the promote dialog when server returns ASSIGNEE_NOT_MEMBER (once per state)
  useEffect(() => {
    if (
      state &&
      state !== handledStateRef.current &&
      !state.ok &&
      state.code === "ASSIGNEE_NOT_MEMBER" &&
      state.meta?.assignee
    ) {
      handledStateRef.current = state;
      setPromoteAssignee(state.meta.assignee);
      setIsPromoteOpen(true);
    }
  }, [state]);

  // Reset before client-side redirect (canonical CREATE-form pattern).
  // The server action returns { ok: true, redirectTo } so we can clear local
  // state before navigating; if navigation fails the user sees an empty form
  // rather than stale values.
  useEffect(() => {
    if (state?.ok) {
      resetForm();
      window.location.assign(state.value.redirectTo);
    }
  }, [state]);

  const confirmPromote = (): void => {
    if (!promoteAssignee) return;
    setIsPromoteOpen(false);
    // Build FormData from the snapshotted submission values captured at first
    // submission — these survive any component re-renders caused by server action.
    const snapshot = submittedDataRef.current;
    const fd = new FormData();
    fd.set("name", snapshot?.name ?? nameValue);
    fd.set("initials", snapshot?.initials ?? initialsValue);
    const ownerId = snapshot?.ownerId ?? ownerIdValue;
    if (ownerId) fd.set("ownerId", ownerId);
    fd.set("forcePromoteUserId", promoteAssignee.id);
    // useActionState dispatch must be called inside a transition — calling it
    // outside a transition silently skips the server action (React 19 requirement).
    startTransition(() => {
      formAction(fd);
    });
  };

  const cancelPromote = (): void => {
    setIsPromoteOpen(false);
    setPromoteAssignee(null);
  };

  const hasAnyValue =
    nameValue.length > 0 || initialsValue.length > 0 || ownerIdValue.length > 0;

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
       * button cannot use type="submit" to target the outer form. We build
       * FormData from controlled state values (nameValue, initialsValue, ownerIdValue)
       * and call formAction(fd) directly — this avoids relying on uncontrolled
       * DOM inputs that may lose their values after a server action re-render.
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

      <AlertDialog open={isClearOpen} onOpenChange={setIsClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all fields?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove everything you&apos;ve entered. You can&apos;t
              undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                resetForm();
                setIsClearOpen(false);
              }}
            >
              Clear fields
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <form
        action={formAction}
        ref={formRef}
        onSubmit={(e) => {
          // Snapshot field values at first submission time for use in confirmPromote
          const fd = new FormData(e.currentTarget);
          submittedDataRef.current = {
            name: (fd.get("name") as string | null) ?? "",
            initials: (fd.get("initials") as string | null) ?? "",
            ownerId: (fd.get("ownerId") as string | null) ?? "",
          };
        }}
        id="create-machine-form"
        className="space-y-6"
      >
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
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
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
            value={initialsValue}
            onChange={(e) => {
              setInitialsValue(
                e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
              );
            }}
          />
          <p className="text-xs text-muted-foreground">
            2-6 characters. Permanent unique identifier.
          </p>
        </div>

        {/* Owner Select (Admin/Technician Only) */}
        {canSelectOwner && (
          <OwnerSelect
            key={ownerSelectKey}
            users={users}
            onUsersChange={setUsers}
            onValueChange={setOwnerIdValue}
          />
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-4">
          <Button
            type="submit"
            className="flex-1 min-w-[160px] bg-primary text-on-primary hover:bg-primary/90"
            loading={isPending}
          >
            Create Machine
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!hasAnyValue || isPending}
            onClick={() => setIsClearOpen(true)}
            className="border-outline text-foreground hover:bg-surface-variant"
          >
            Clear
          </Button>
          <Link href="/m" className="flex-1 min-w-[120px]">
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

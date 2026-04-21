"use client";

import type React from "react";
import { useActionState, useState, useRef, useEffect } from "react";
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
  updateMachineAction,
  type UpdateMachineResult,
  type AssigneeNotMemberMeta,
} from "~/app/(app)/m/actions";
import { cn } from "~/lib/utils";
import { OwnerSelect } from "~/components/machines/OwnerSelect";
import {
  VALID_MACHINE_PRESENCE_STATUSES,
  getMachinePresenceLabel,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Pencil } from "lucide-react";

import type { OwnerSelectUser } from "~/components/machines/OwnerSelect";

// --- Edit Machine Dialog ---

interface EditMachineDialogProps {
  machine: {
    id: string;
    name: string;
    initials: string;
    presenceStatus: MachinePresenceStatus;
    ownerId: string | null;
    invitedOwnerId: string | null;
    owner?: {
      id: string;
      name: string;
      avatarUrl?: string | null;
    } | null;
    invitedOwner?: {
      id: string;
      name: string;
    } | null;
  };
  allUsers: OwnerSelectUser[];
  canEditAnyMachine: boolean;
  isOwner: boolean;
}

export function EditMachineDialog({
  machine,
  allUsers,
  canEditAnyMachine,
  isOwner,
}: EditMachineDialogProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const transferConfirmedRef = useRef(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState(
    machine.ownerId ?? machine.invitedOwnerId ?? ""
  );
  const currentOwnerId = machine.ownerId ?? machine.invitedOwnerId ?? "";

  // Promote dialog state — populated when server returns ASSIGNEE_NOT_MEMBER
  const [promoteAssignee, setPromoteAssignee] = useState<
    AssigneeNotMemberMeta["assignee"] | null
  >(null);
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);

  // State-driven hidden input for re-submission with forcePromoteUserId.
  // Using state (not ref) so React flushes the value before requestSubmit.
  const [forcePromoteUserId, setForcePromoteUserId] = useState("");

  // Track whether we need to submit after forcePromoteUserId state flushes
  const [pendingSubmit, setPendingSubmit] = useState(false);

  const [state, formAction, isPending] = useActionState<
    UpdateMachineResult | undefined,
    FormData
  >(updateMachineAction, undefined);

  // Close edit dialog on successful update
  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
    }
  }, [state]);

  // Open promote dialog when server returns ASSIGNEE_NOT_MEMBER
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

  // Reset state when edit dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedOwnerId(currentOwnerId);
      transferConfirmedRef.current = false;
      setForcePromoteUserId("");
      setPromoteAssignee(null);
      setIsPromoteOpen(false);
      setPendingSubmit(false);
    }
  }, [open, currentOwnerId]);

  // Submit after forcePromoteUserId has been set in state (ensures React flushed it)
  useEffect(() => {
    if (pendingSubmit && forcePromoteUserId) {
      setPendingSubmit(false);
      formRef.current?.requestSubmit();
    }
  }, [pendingSubmit, forcePromoteUserId]);

  // Find the selected owner's name for the transfer confirmation dialog
  const selectedOwnerName =
    allUsers.find((u) => u.id === selectedOwnerId)?.name ?? "the selected user";

  // Only intercept submission for ownership-transfer confirmation (non-privileged owners)
  const needsTransferConfirm =
    !canEditAnyMachine && isOwner && selectedOwnerId !== currentOwnerId;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    // If transfer was already confirmed via the dialog, skip the guard
    if (transferConfirmedRef.current) {
      transferConfirmedRef.current = false;
      return;
    }
    // Only prevent default when we need to show the transfer confirmation dialog
    if (needsTransferConfirm) {
      e.preventDefault();
      setShowTransferConfirm(true);
      return;
    }
    // Otherwise, let the form submit naturally via the action attribute
  };

  const handleConfirmTransfer = (): void => {
    setShowTransferConfirm(false);
    transferConfirmedRef.current = true;
    // Use requestSubmit to trigger the form's action attribute
    formRef.current?.requestSubmit();
  };

  const confirmPromote = (): void => {
    if (!promoteAssignee) return;
    setForcePromoteUserId(promoteAssignee.id);
    setIsPromoteOpen(false);
    // Signal that we want to submit after state flushes (useEffect handles the actual call)
    setPendingSubmit(true);
  };

  const cancelPromote = (): void => {
    setIsPromoteOpen(false);
    setPromoteAssignee(null);
    setForcePromoteUserId("");
    setPendingSubmit(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-outline text-foreground hover:bg-surface-variant"
            data-testid="edit-machine-button"
          >
            <Pencil className="mr-2 size-4" />
            Edit Machine
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Machine</DialogTitle>
            <DialogDescription>
              Update the details for {machine.name}.
            </DialogDescription>
          </DialogHeader>

          <form
            ref={formRef}
            action={formAction}
            onSubmit={handleSubmit}
            id="edit-machine-form"
            className="space-y-6"
          >
            <input type="hidden" name="id" value={machine.id} />
            {/* State-driven hidden input for re-submission with forcePromoteUserId */}
            <input
              type="hidden"
              name="forcePromoteUserId"
              value={forcePromoteUserId}
            />

            {/* Flash message — suppress ASSIGNEE_NOT_MEMBER since dialog handles it */}
            {state && !state.ok && state.code !== "ASSIGNEE_NOT_MEMBER" && (
              <div
                className={cn(
                  "rounded-md border p-4",
                  "border-destructive/20 bg-destructive/10 text-destructive"
                )}
              >
                <p className="text-sm font-medium">{state.message}</p>
              </div>
            )}

            {/* Machine Initials (Read Only) */}
            <div className="space-y-2">
              <Label htmlFor="edit-initials" className="text-foreground">
                Initials
              </Label>
              <Input
                id="edit-initials"
                value={machine.initials}
                disabled
                className="border-outline bg-surface-variant text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Machine initials cannot be changed
              </p>
            </div>

            {/* Machine Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-foreground">
                Machine Name *
              </Label>
              <Input
                id="edit-name"
                name="name"
                type="text"
                required
                defaultValue={machine.name}
                placeholder="e.g., Medieval Madness"
                className="border-outline bg-surface text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Enter the full name of the pinball machine
              </p>
            </div>

            {/* Availability */}
            <div className="space-y-2">
              <Label htmlFor="edit-presence" className="text-foreground">
                Availability
              </Label>
              <Select
                name="presenceStatus"
                defaultValue={machine.presenceStatus}
              >
                <SelectTrigger
                  id="edit-presence"
                  className="border-outline bg-surface text-foreground"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALID_MACHINE_PRESENCE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {getMachinePresenceLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Whether this machine is currently available on the floor
              </p>
            </div>

            {/* Machine Owner - show for admin/technician AND machine owner */}
            {canEditAnyMachine || isOwner ? (
              <OwnerSelectWithTracking
                users={allUsers}
                defaultValue={currentOwnerId}
                onOwnerChange={setSelectedOwnerId}
              />
            ) : (
              <div className="space-y-2" data-testid="owner-display">
                <span className="text-sm font-semibold text-foreground">
                  Machine Owner
                </span>
                <div className="rounded-md border border-outline bg-surface px-3 py-2">
                  {machine.owner || machine.invitedOwner ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground">
                        {machine.owner?.name ?? machine.invitedOwner?.name}
                      </span>
                      {machine.invitedOwner && !machine.owner && (
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                          (Invited)
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      No owner assigned
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  The owner receives notifications for new issues on this
                  machine.
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="submit"
                className="bg-primary text-on-primary hover:bg-primary/90"
                loading={isPending}
              >
                Update Machine
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/*
       * Promote-and-assign confirmation dialog.
       * Duplicated from create-machine-form.tsx — pending extraction at 3rd consumer.
       *
       * Radix portals DialogContent outside the form tree. The confirm button
       * cannot implicitly target the outer form, so we use a state-driven
       * hidden forcePromoteUserId input + requestAnimationFrame to flush state
       * before programmatic requestSubmit fires on the outer form.
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
              is currently a guest. Assigning them as owner of{" "}
              <strong>{machine.name}</strong> will promote them to member.
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

      {/* Ownership transfer confirmation (non-admin owners only) */}
      <AlertDialog
        open={showTransferConfirm}
        onOpenChange={setShowTransferConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer Ownership</AlertDialogTitle>
            <AlertDialogDescription>
              You are transferring ownership of {machine.name} to{" "}
              {selectedOwnerName}. You will lose the ability to edit this
              machine. Only an admin can reverse this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmTransfer}
            >
              Transfer Ownership
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// --- Helper: OwnerSelect with change tracking ---

function OwnerSelectWithTracking({
  users,
  defaultValue,
  onOwnerChange,
}: {
  users: OwnerSelectUser[];
  defaultValue: string | null;
  onOwnerChange: (id: string) => void;
}): React.JSX.Element {
  return (
    <OwnerSelect
      users={users}
      defaultValue={defaultValue}
      onValueChange={onOwnerChange}
    />
  );
}

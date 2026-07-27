"use client";

import type React from "react";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react";
import { Button } from "~/components/ui/button";
import {
  updateMachineAction,
  type UpdateMachineResult,
  type AssigneeNotMemberMeta,
} from "~/app/(app)/m/actions";
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

export interface MachineOwnerTransferProps {
  machineId: string;
  /**
   * Current machine name — resubmitted unchanged so the shared update action
   * can satisfy its required `name` field without altering it.
   */
  machineName: string;
  ownerId: string | null;
  invitedOwnerId: string | null;
  ownerName: string | null;
  invitedOwnerName: string | null;
  allUsers: OwnerSelectUser[];
  canEditAnyMachine: boolean;
  isOwner: boolean;
}

/**
 * Ownership transfer — the Danger zone row on the machine edit page
 * (PP-o355.19).
 *
 * Ownership used to ride the Edit Machine modal's single Save. On the page it
 * has its own submit, so changing the owner is deliberate rather than a side
 * effect of saving a description typo.
 *
 * **Why an inline disclosure and not a dialog.** `OwnerSelect` is a Popover +
 * cmdk picker, and Radix portals popover content outside the dialog subtree —
 * the exact mechanism behind PP-o355.13 (a click inside the picker read as an
 * outside-click and dismissed the modal). Expanding in place keeps the picker
 * out of any portal-vs-dismiss interaction. The confirm below IS an
 * AlertDialog, which is safe: plain text and two buttons, no portalled picker.
 *
 * This form carries `id`, `name` and `ownerId` only. `updateMachineAction`
 * leaves presence, description and PinballMap link columns untouched when their
 * fields are absent, so a transfer cannot clobber unsaved edits in Details.
 */
export function MachineOwnerTransfer({
  machineId,
  machineName,
  ownerId,
  invitedOwnerId,
  ownerName,
  invitedOwnerName,
  allUsers,
  canEditAnyMachine,
  isOwner,
}: MachineOwnerTransferProps): React.JSX.Element {
  const currentOwnerId = ownerId ?? invitedOwnerId ?? "";
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState(currentOwnerId);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const transferConfirmedRef = useRef(false);

  const [promoteAssignee, setPromoteAssignee] = useState<
    AssigneeNotMemberMeta["assignee"] | null
  >(null);
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);

  const [state, formAction, isPending] = useActionState<
    UpdateMachineResult | undefined,
    FormData
  >(updateMachineAction, undefined);

  const handledStateRef = useRef<typeof state>(undefined);

  // Collapse the disclosure once the transfer lands.
  useEffect(() => {
    if (state?.ok) {
      setIsOpen(false);
    }
  }, [state]);

  // Offer promotion when the server reports the pick is still a guest.
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

  const displayOwnerName = ownerName ?? invitedOwnerName;
  const selectedOwnerName =
    allUsers.find((u) => u.id === selectedOwnerId)?.name ?? "the selected user";

  // A non-privileged owner handing the machine away loses their own access, so
  // they get a confirm. Admins and technicians keep access either way.
  const needsTransferConfirm =
    !canEditAnyMachine && isOwner && selectedOwnerId !== currentOwnerId;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    if (transferConfirmedRef.current) {
      transferConfirmedRef.current = false;
      return;
    }
    if (needsTransferConfirm) {
      e.preventDefault();
      setShowTransferConfirm(true);
    }
  };

  const handleConfirmTransfer = (): void => {
    setShowTransferConfirm(false);
    transferConfirmedRef.current = true;
    formRef.current?.requestSubmit();
  };

  const confirmPromote = (): void => {
    if (!promoteAssignee || !formRef.current) return;
    setIsPromoteOpen(false);
    const fd = new FormData(formRef.current);
    fd.set("forcePromoteUserId", promoteAssignee.id);
    // useActionState dispatch must run inside a transition — outside one,
    // React 19 silently skips the server action.
    startTransition(() => {
      formAction(fd);
    });
  };

  const cancelTransfer = (): void => {
    setSelectedOwnerId(currentOwnerId);
    setIsOpen(false);
  };

  return (
    <div className="py-2" data-testid="owner-transfer">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium text-foreground">Transfer ownership</p>
          <p className="text-sm text-muted-foreground">
            {displayOwnerName
              ? `Owned by ${displayOwnerName}. `
              : "No owner assigned. "}
            The new owner is notified and inherits issue alerts.
          </p>
        </div>
        {!isOpen && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10"
            onClick={() => setIsOpen(true)}
            data-testid="open-owner-transfer"
          >
            Change owner…
          </Button>
        )}
      </div>

      {isOpen && (
        <form
          ref={formRef}
          action={formAction}
          onSubmit={handleSubmit}
          className="mt-4 space-y-3"
        >
          <input type="hidden" name="id" value={machineId} />
          <input type="hidden" name="name" value={machineName} />

          {state && !state.ok && state.code !== "ASSIGNEE_NOT_MEMBER" && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-destructive">
              <p className="text-sm font-medium" role="alert">
                {state.message}
              </p>
            </div>
          )}

          <OwnerSelect
            users={allUsers}
            defaultValue={currentOwnerId}
            onValueChange={setSelectedOwnerId}
            showHelpText={false}
          />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={cancelTransfer}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              loading={isPending}
              disabled={selectedOwnerId === currentOwnerId}
            >
              Transfer ownership
            </Button>
          </div>
        </form>
      )}

      {/*
       * Promote-and-assign confirmation.
       * Duplicated from create-machine-form.tsx — pending extraction at 3rd
       * consumer.
       *
       * Radix portals DialogContent outside the form tree, so the confirm
       * button cannot implicitly submit the form. We read the live form DOM via
       * formRef, inject forcePromoteUserId, and dispatch the action directly.
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
              <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {promoteAssignee?.type === "invited"
                  ? "(INVITED · GUEST)"
                  : "(GUEST)"}
              </span>{" "}
              is currently a guest. Assigning them as owner of{" "}
              <strong>{machineName}</strong> will promote them to member.
            </p>
            <p className="text-sm text-muted-foreground">
              As a member they&apos;ll be able to edit the machine&apos;s
              details and owner requirements.
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
              variant="outline"
              onClick={() => {
                setIsPromoteOpen(false);
                setPromoteAssignee(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={confirmPromote}>Promote and assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Non-admin owners are handing away their own access. */}
      <AlertDialog
        open={showTransferConfirm}
        onOpenChange={setShowTransferConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer Ownership</AlertDialogTitle>
            <AlertDialogDescription>
              You are transferring ownership of {machineName} to{" "}
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
    </div>
  );
}

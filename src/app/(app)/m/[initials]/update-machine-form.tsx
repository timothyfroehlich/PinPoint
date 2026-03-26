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
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import type { OwnerSelectUser } from "~/components/machines/OwnerSelect";
import { PbmMachineSearch } from "~/components/machines/PbmMachineSearch";
import {
  addToPinballMapAction,
  removeFromPinballMapAction,
} from "~/app/(app)/m/pinball-map-actions";

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
    pbmMachineId: number | null;
    pbmMachineName: string | null;
    pbmLocationMachineXrefId: number | null;
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

  const [state, formAction, isPending] = useActionState<
    UpdateMachineResult | undefined,
    FormData
  >(updateMachineAction, undefined);

  // Close dialog on successful update + show PBM suggestion toast
  useEffect(() => {
    if (state?.ok) {
      setOpen(false);

      const suggestion = state.value.pbmSuggestion;
      if (suggestion?.suggestAddToPbm) {
        toast("Machine is on the floor", {
          description: "Add to Pinball Map so players can find it?",
          action: {
            label: "Add to PBM",
            onClick: () => {
              void addToPinballMapAction(machine.id);
            },
          },
        });
      } else if (suggestion?.suggestRemoveFromPbm) {
        toast("Machine is off the floor", {
          description: "Remove from Pinball Map?",
          action: {
            label: "Remove from PBM",
            onClick: () => {
              void removeFromPinballMapAction(machine.id);
            },
          },
        });
      }
    }
  }, [state, machine.id]);

  // Reset selectedOwnerId when dialog reopens to avoid stale selection
  useEffect(() => {
    if (open) {
      setSelectedOwnerId(currentOwnerId);
      transferConfirmedRef.current = false;
    }
  }, [open, currentOwnerId]);

  // Find the selected owner's name for the confirmation dialog
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

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-outline text-on-surface hover:bg-surface-variant"
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
            className="space-y-6"
          >
            <input type="hidden" name="id" value={machine.id} />

            {/* Flash message */}
            {state && !state.ok && (
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
              <Label htmlFor="edit-initials" className="text-on-surface">
                Initials
              </Label>
              <Input
                id="edit-initials"
                value={machine.initials}
                disabled
                className="border-outline bg-surface-variant text-on-surface-variant"
              />
              <p className="text-xs text-on-surface-variant">
                Machine initials cannot be changed
              </p>
            </div>

            {/* Machine Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-on-surface">
                Machine Name *
              </Label>
              <Input
                id="edit-name"
                name="name"
                type="text"
                required
                defaultValue={machine.name}
                placeholder="e.g., Medieval Madness"
                className="border-outline bg-surface text-on-surface placeholder:text-on-surface-variant"
              />
              <p className="text-xs text-on-surface-variant">
                Enter the full name of the pinball machine
              </p>
            </div>

            {/* Availability */}
            <div className="space-y-2">
              <Label htmlFor="edit-presence" className="text-on-surface">
                Availability
              </Label>
              <Select
                name="presenceStatus"
                defaultValue={machine.presenceStatus}
              >
                <SelectTrigger
                  id="edit-presence"
                  className="border-outline bg-surface text-on-surface"
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
              <p className="text-xs text-on-surface-variant">
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
                <span className="text-sm font-semibold text-on-surface">
                  Machine Owner
                </span>
                <div className="rounded-md border border-outline bg-surface px-3 py-2">
                  {machine.owner || machine.invitedOwner ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-on-surface">
                        {machine.owner?.name ?? machine.invitedOwner?.name}
                      </span>
                      {machine.invitedOwner && !machine.owner && (
                        <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant/70">
                          (Invited)
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-on-surface-variant">
                      No owner assigned
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant">
                  The owner receives notifications for new issues on this
                  machine.
                </p>
              </div>
            )}

            {/* Pinball Map Link */}
            <div className="space-y-2">
              <Label className="text-on-surface">Pinball Map Game Model</Label>
              <PbmMachineSearch
                defaultValue={
                  machine.pbmMachineId && machine.pbmMachineName
                    ? {
                        id: machine.pbmMachineId,
                        name: machine.pbmMachineName,
                      }
                    : null
                }
              />
              <p className="text-xs text-on-surface-variant">
                Optional. Link to a game model on Pinball Map.
              </p>
            </div>

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

"use client";

import type React from "react";
import {
  useActionState,
  useState,
  useRef,
  useEffect,
  startTransition,
} from "react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
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
import { PinballMapLinkField } from "~/components/machines/PinballMapLinkField";
import { RichTextEditor } from "~/components/editor/RichTextEditorDynamic";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
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
    // Only `name` is consumed (display of current owner when the user lacks
    // edit-owner permission). `id`/`avatarUrl` are intentionally excluded so
    // unused server data never crosses the client boundary (CORE-SEC-006).
    owner?: { name: string } | null;
    invitedOwner?: { name: string } | null;
    // PinballMap link state (bead B / PP-o355.2).
    pinballmapMachineId: number | null;
    pinballmapExcluded: boolean;
    pinballmapExcludedReason: string | null;
    /** Whether the machine is marked listed on PinballMap's public map (bead C). */
    pinballmapListed: boolean;
    /** Linked catalog title's display name, resolved server-side from the mirror. */
    pinballmapTitleName: string | null;
    /** Machine description (rich text), edited via the editor in this dialog. */
    description: ProseMirrorDoc | null;
  };
  allUsers: OwnerSelectUser[];
  canEditAnyMachine: boolean;
  isOwner: boolean;
  /** Whether the viewer may set/change the PinballMap link (machines.pinballmap.link). */
  canLink: boolean;
}

export function EditMachineDialog({
  machine,
  allUsers,
  canEditAnyMachine,
  isOwner,
  canLink,
}: EditMachineDialogProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const transferConfirmedRef = useRef(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState(
    machine.ownerId ?? machine.invitedOwnerId ?? ""
  );
  const currentOwnerId = machine.ownerId ?? machine.invitedOwnerId ?? "";

  // Description draft — the RichTextEditor is uncontrolled after mount (content
  // is an initial prop), so we mirror its doc here to serialize into the hidden
  // form field. Reset on each open so a cancel doesn't leak a stale draft.
  const [descriptionDoc, setDescriptionDoc] = useState<ProseMirrorDoc | null>(
    machine.description
  );

  // Promote dialog state — populated when server returns ASSIGNEE_NOT_MEMBER
  const [promoteAssignee, setPromoteAssignee] = useState<
    AssigneeNotMemberMeta["assignee"] | null
  >(null);
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);

  const [state, formAction, isPending] = useActionState<
    UpdateMachineResult | undefined,
    FormData
  >(updateMachineAction, undefined);

  // Track the last state we've already handled to avoid re-opening on cancel
  const handledStateRef = useRef<typeof state>(undefined);

  // Close edit dialog on successful update
  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
    }
  }, [state]);

  // Open promote dialog when server returns ASSIGNEE_NOT_MEMBER (once per state)
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

  // Reset state when edit dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedOwnerId(currentOwnerId);
      setDescriptionDoc(machine.description);
      transferConfirmedRef.current = false;
      setPromoteAssignee(null);
      setIsPromoteOpen(false);
    }
  }, [open, currentOwnerId, machine.description]);

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
    if (!promoteAssignee || !formRef.current) return;
    setIsPromoteOpen(false);
    // Build FormData from the live form DOM (captures all current field values)
    // then inject forcePromoteUserId before dispatching directly to the action.
    // This avoids the DOM requestSubmit() → useActionState wiring uncertainty.
    const fd = new FormData(formRef.current);
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
        <DialogContent
          // Radix portals the Model-picker Popover and the edition/Availability
          // Selects to <body>, OUTSIDE this content subtree. A pointerdown on
          // that portalled content otherwise reads as an outside interaction and
          // dismisses the whole dialog (PP-o355.13: "clicking a dropdown closed
          // the modal"). Keep the dialog open when the interaction originates
          // inside a popover/select layer; genuine outside clicks still close it.
          onInteractOutside={(e) => {
            const target = e.detail.originalEvent.target;
            if (
              target instanceof Element &&
              target.closest(
                '[data-slot="popover-content"], [data-slot="select-content"]'
              )
            ) {
              e.preventDefault();
            }
          }}
        >
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
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
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
              </div>
            )}

            {/* Model — PinballMap catalog model/edition, right after the name
                (bead B / PP-o355.2). */}
            {canLink && (
              <PinballMapLinkField
                defaultMachineId={machine.pinballmapMachineId}
                defaultName={machine.pinballmapTitleName}
                defaultExcluded={machine.pinballmapExcluded}
                defaultExcludedReason={machine.pinballmapExcludedReason}
              />
            )}

            {/* Description — rich text shown to anyone viewing the machine. The
                editor is uncontrolled (content is an initial prop); its current
                doc is mirrored into the hidden field below for submission. */}
            <div className="space-y-2">
              {/* No htmlFor: RichTextEditor is a contenteditable widget with no
                  focusable `id` to associate. Its accessible name comes from
                  `ariaLabel` below; this is the visible caption. */}
              <Label className="text-foreground">Description</Label>
              <RichTextEditor
                content={machine.description}
                onChange={setDescriptionDoc}
                mentionsEnabled={false}
                placeholder="Add a description for this machine..."
                ariaLabel="Machine description"
                compact={false}
                className="min-h-[120px]"
              />
              <input
                type="hidden"
                name="description"
                value={descriptionDoc ? JSON.stringify(descriptionDoc) : ""}
              />
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
            </div>

            {/* List on PinballMap — display-only until outbound sync
                (PP-o355.11) exists. Disabled rather than editable: with no
                way to actually push a list/unlist to PinballMap.com yet,
                letting someone flip this would just be lying to the card.
                The hidden input always mirrors the persisted value (not
                `listed`) so saving other fields never silently resets it. */}
            {canLink && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="edit-pinballmap-listed"
                      checked={machine.pinballmapListed}
                      disabled
                    />
                    <input
                      type="hidden"
                      name="pinballmapListed"
                      value={machine.pinballmapListed ? "on" : ""}
                    />
                    <Label
                      htmlFor="edit-pinballmap-listed"
                      className="text-muted-foreground"
                    >
                      List on PinballMap
                    </Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Coming soon — PinPoint can&apos;t push listing changes to
                  PinballMap.com yet.
                </TooltipContent>
              </Tooltip>
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
       * cannot implicitly target the outer form, so we read the live form DOM
       * via formRef, inject forcePromoteUserId, and call formAction(fd) directly.
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
      showHelpText={false}
    />
  );
}

"use client";

import type React from "react";
import { useState, useRef, useEffect, startTransition } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
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
  createMachineAction,
  type CreateMachineResult,
  type AssigneeNotMemberMeta,
} from "~/app/(app)/m/actions";
import { cn } from "~/lib/utils";
import {
  OwnerSelect,
  type OwnerSelectUser,
} from "~/components/machines/OwnerSelect";
import { PinballMapLinkField } from "~/components/machines/PinballMapLinkField";
import { RichTextEditor } from "~/components/editor/RichTextEditorDynamic";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import {
  VALID_MACHINE_PRESENCE_STATUSES,
  getMachinePresenceLabel,
} from "~/lib/machines/presence";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
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
  const [descriptionDoc, setDescriptionDoc] = useState<ProseMirrorDoc | null>(
    null
  );

  // Promote dialog state — populated when server returns ASSIGNEE_NOT_MEMBER
  const [promoteAssignee, setPromoteAssignee] = useState<
    AssigneeNotMemberMeta["assignee"] | null
  >(null);
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);

  // Snapshot of the full FormData captured at first submission time, so the
  // promote-confirm re-submission carries EVERY field (incl. the PinballMap
  // link) even if the server action response caused a component re-render. A
  // typed subset previously dropped the link fields, silently un-linking the
  // machine when an owner promotion was confirmed.
  const submittedDataRef = useRef<FormData | null>(null);

  // Track the last state we've already handled to avoid re-opening on cancel
  const handledStateRef = useRef<typeof state>(undefined);

  const resetForm = (): void => {
    formRef.current?.reset();
    setNameValue("");
    setInitialsValue("");
    setOwnerIdValue("");
    setOwnerSelectKey((k) => k + 1);
    setDescriptionDoc(null);
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
    // Re-dispatch the originally-submitted FormData (captured in onSubmit), which
    // survives any component re-render from the server action and carries all
    // fields — name, initials, owner, AND the PinballMap link. Fall back to
    // controlled state only if the snapshot is somehow unset (confirmPromote runs
    // after a submit, so it normally exists).
    const fd = submittedDataRef.current ?? new FormData();
    if (!submittedDataRef.current) {
      fd.set("name", nameValue);
      fd.set("initials", initialsValue);
      if (ownerIdValue) fd.set("ownerId", ownerIdValue);
    }
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

      <form
        action={formAction}
        ref={formRef}
        onSubmit={(e) => {
          // Snapshot the full submitted FormData for confirmPromote's re-dispatch.
          submittedDataRef.current = new FormData(e.currentTarget);
        }}
        id="create-machine-form"
        className="space-y-4"
      >
        {/* Machine Name */}
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-foreground">
            Machine Name *
          </Label>
          <p className="text-xs text-muted-foreground">
            Full name of the game.
          </p>
          <Input
            id="name"
            name="name"
            type="text"
            required
            placeholder="e.g., Medieval Madness"
            className="border-outline bg-surface text-foreground placeholder:text-muted-foreground"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
          />
        </div>

        {/* Machine Initials */}
        <div className="space-y-1.5">
          <Label htmlFor="initials" className="text-foreground">
            Initials{" "}
            <span className="font-normal text-muted-foreground">
              (cannot be changed later)
            </span>{" "}
            *
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
        </div>

        {/* Owner Select (Admin/Technician Only) */}
        {canSelectOwner && (
          <OwnerSelect
            key={ownerSelectKey}
            users={users}
            onUsersChange={setUsers}
            onValueChange={setOwnerIdValue}
            showHelpText={false}
          />
        )}

        {/* Model — links the machine to its PinballMap catalog model/edition
            (bead B / PP-o355.2). */}
        <PinballMapLinkField />

        {/* Description */}
        <div className="space-y-1.5">
          <Label className="text-foreground">Description</Label>
          <RichTextEditor
            content={null}
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
        <div className="space-y-1.5">
          <Label htmlFor="presence-status" className="text-foreground">
            Availability
          </Label>
          <Select name="presenceStatus" defaultValue="on_the_floor">
            <SelectTrigger
              id="presence-status"
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
            (PP-o355.11) exists; a new machine always starts unlisted. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Checkbox id="pinballmap-listed" checked={false} disabled />
              <input type="hidden" name="pinballmapListed" value="" />
              <Label
                htmlFor="pinballmap-listed"
                className="text-muted-foreground"
              >
                List on Pinball Map
              </Label>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            Coming soon — PinPoint can&apos;t push listing changes to Pinball
            Map yet.
          </TooltipContent>
        </Tooltip>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Link href="/m">
            <Button
              type="button"
              variant="outline"
              className="border-outline text-foreground hover:bg-surface-variant"
            >
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            className="bg-primary text-on-primary hover:bg-primary/90"
            loading={isPending}
          >
            Create Machine
          </Button>
        </div>
      </form>
    </>
  );
}

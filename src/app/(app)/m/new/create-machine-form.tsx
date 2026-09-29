"use client";

import type React from "react";
import { useState, useRef, useEffect, startTransition } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { useHydrated } from "~/hooks/use-hydrated";
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
  PinballMapLinkField,
  type PbmLinkFieldSelection,
} from "~/components/machines/PinballMapLinkField";
import { IscoredGamePicker } from "~/components/machines/IscoredGamePicker";
import { MachineFormFields } from "~/components/machines/machine-form/MachineFormFields";
import {
  MachineFormActionBar,
  PinnedActionBarSpacer,
} from "~/components/machines/machine-form/MachineFormActionBar";
import {
  NewMachinePinballmapFields,
  type NewMachinePinballmapFieldsProps,
} from "~/components/machines/machine-form/NewMachinePinballmapFields";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Alert, AlertDescription } from "~/components/ui/alert";

/** What the page knows about Pinball Map for the lineup choice (4.11). */
export type NewMachinePinballmapContext = Pick<
  NewMachinePinballmapFieldsProps,
  | "configured"
  | "locationName"
  | "canSetIntent"
  | "canAddAfterCreate"
  | "lineupTitleIds"
>;

interface CreateMachineFormProps {
  allUsers: OwnerSelectUser[];
  canSelectOwner: boolean;
  iscoredConfigured?: boolean;
  /** The creator may see Owner's Requirements (machine-editing 2.6). */
  canViewOwnerRequirements?: boolean;
  pinballmap?: NewMachinePinballmapContext;
  initialName?: string | undefined;
  /** Pinball Map title to preselect in the Model field. */
  initialPinballmap?: { id: number; name: string } | undefined;
}

const NO_PINBALLMAP: NewMachinePinballmapContext = {
  configured: false,
  locationName: null,
  canSetIntent: false,
  canAddAfterCreate: false,
  lineupTitleIds: [],
};

/**
 * The New Machine page's form: the shared machine form fields
 * (`MachineFormFields`, machine-editing 2.1) plus Initials and Owner (2.2),
 * created in one action (4.3).
 */
export function CreateMachineForm({
  allUsers,
  canSelectOwner,
  iscoredConfigured = false,
  canViewOwnerRequirements = false,
  pinballmap = NO_PINBALLMAP,
  initialName,
  initialPinballmap,
}: CreateMachineFormProps): React.JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<
    CreateMachineResult | undefined,
    FormData
  >(createMachineAction, undefined);

  // Lift users state to client so we can append new users without full refresh
  const [users, setUsers] = useState<OwnerSelectUser[]>(allUsers);

  // Controlled field values so they survive re-renders after server action errors
  const [nameValue, setNameValue] = useState(initialName ?? "");
  const [initialsValue, setInitialsValue] = useState("");
  const [ownerIdValue, setOwnerIdValue] = useState("");
  // Bumped on reset to remount OwnerSelect (which holds its own internal state).
  const [ownerSelectKey, setOwnerSelectKey] = useState(0);
  const [descriptionDoc, setDescriptionDoc] = useState<ProseMirrorDoc | null>(
    null
  );
  const [ownerRequirementsDoc, setOwnerRequirementsDoc] =
    useState<ProseMirrorDoc | null>(null);
  // Live Availability and Model Details selection, which decide what the
  // Pinball Map block in Integrations offers (pinballmap 4.11, 6.2).
  const [presenceStatus, setPresenceStatus] =
    useState<MachinePresenceStatus>("on_the_floor");
  const [pbmSelection, setPbmSelection] = useState<PbmLinkFieldSelection>({
    manual: false,
    pinballmapMachineId: null,
  });
  const isHydrated = useHydrated();

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
    setOwnerRequirementsDoc(null);
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
            "border-destructive/20 bg-destructive/10 text-destructive-text"
          )}
        >
          <p className="text-sm font-medium">{state.message}</p>
        </div>
      )}

      {/*
       * Promote-and-assign confirmation dialog.
       * Duplicated from machine-owner-transfer.tsx — pending extraction at 3rd consumer.
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

      {/*
       * No `action={formAction}` on purpose (PP-1ajq). React 19 auto-resets a
       * `<form action={...}>` once the action settles — on failure as well as
       * success — and this form stays on screen after a failed create.
       * @radix-ui/react-select >=2.3.3 replays each Select's mount-time value
       * through `onValueChange` on that reset, so a failed create silently
       * threw the Availability choice back to "On the Floor" (and the
       * PinballMap edition picker back to its mount state) while the user was
       * still reading the error. The text fields were already made controlled
       * for exactly this reason; dispatching `useActionState` directly closes
       * the same hole for the Selects, because no form submission ever
       * completes and React never fires the reset. This form depends on JS end
       * to end regardless (the success path is a `window.location.assign`
       * redirect). Success still resets explicitly via `resetForm()`.
       */}
      <form
        ref={formRef}
        method="post"
        onSubmit={(e) => {
          // Ignore submits that bubbled up from a DESCENDANT form. React
          // propagates events through the React tree, not the DOM tree, so the
          // portalled `<form>` inside OwnerSelect's InviteUserDialog reaches
          // this handler even though it is not a DOM descendant. Without this
          // guard our `preventDefault()` cancelled the invite's own submission
          // and the invited user never appeared (caught by
          // e2e/full/machine-with-invite.spec.ts).
          if (e.target !== e.currentTarget) return;
          e.preventDefault();
          // Snapshot the full submitted FormData for confirmPromote's re-dispatch.
          const fd = new FormData(e.currentTarget);
          submittedDataRef.current = fd;
          // useActionState dispatch must be called inside a transition — calling it
          // outside a transition silently skips the server action (React 19 requirement).
          startTransition(() => {
            formAction(fd);
          });
        }}
        id="create-machine-form"
        className="space-y-5"
      >
        <MachineFormFields
          idPrefix="create"
          name={{ value: nameValue, onChange: setNameValue }}
          availability={{
            defaultValue: "on_the_floor",
            onValueChange: setPresenceStatus,
          }}
          identityFields={
            <>
              <div className="flex min-w-0 flex-col gap-1.5">
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
                  className="border-outline bg-surface text-foreground placeholder:text-muted-foreground uppercase placeholder:normal-case"
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
            </>
          }
          modelDetails={
            <PinballMapLinkField
              // Preselected from a lineup entry's Create in PinPoint (`?pbm=`).
              defaultMachineId={initialPinballmap?.id ?? null}
              defaultName={initialPinballmap?.name ?? null}
              machineName={nameValue}
              onSelectionChange={setPbmSelection}
            />
          }
          description={{
            initial: null,
            value: descriptionDoc,
            onChange: setDescriptionDoc,
          }}
          ownerRequirements={
            canViewOwnerRequirements
              ? {
                  initial: null,
                  value: ownerRequirementsDoc,
                  onChange: setOwnerRequirementsDoc,
                }
              : null
          }
          iscored={
            iscoredConfigured ? (
              <IscoredGamePicker machineName={nameValue} boxed />
            ) : null
          }
          pinballmapUnavailable={pbmSelection.manual}
          pinballmap={
            pbmSelection.manual ? null : (
              <NewMachinePinballmapFields
                pinballmapMachineId={pbmSelection.pinballmapMachineId}
                presenceStatus={presenceStatus}
                // Opened from a lineup entry: the title is on the lineup
                // already, so intent starts On (pinballmap 4.11).
                initialIntent={initialPinballmap ? "on" : "off"}
                {...pinballmap}
              />
            )
          }
        />

        <MachineFormActionBar>
          <Button
            variant="outline"
            className="border-outline text-foreground hover:bg-surface-variant"
            asChild
          >
            <Link href="/m">Cancel</Link>
          </Button>
          <Button
            type="submit"
            className="bg-primary text-on-primary hover:bg-primary/90"
            disabled={!isHydrated || isPending}
            loading={isPending}
          >
            Create Machine
          </Button>
        </MachineFormActionBar>
        <PinnedActionBarSpacer />
      </form>
    </>
  );
}

"use client";

import type React from "react";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { useHydrated } from "~/hooks/use-hydrated";
import { useUnsavedChangesGuard } from "~/hooks/use-unsaved-changes-guard";
import { useDetailsDirty } from "./details-dirty";
import { Button } from "~/components/ui/button";
import {
  updateMachineAction,
  type UpdateMachineResult,
} from "~/app/(app)/m/actions";
import { PinballMapLinkField } from "~/components/machines/PinballMapLinkField";
import { IscoredGamePicker } from "~/components/machines/IscoredGamePicker";
import { MachineFormFields } from "~/components/machines/machine-form/MachineFormFields";
import { MachineFormActionBar } from "~/components/machines/machine-form/MachineFormActionBar";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import type { OpdbDisplayType, OpdbMachineType } from "~/lib/opdb/types";

export interface MachineDetailsFormProps {
  machineId: string;
  name: string;
  presenceStatus: MachinePresenceStatus;
  description: ProseMirrorDoc | null;
  /** Viewer may set/change the PinballMap catalog link. */
  canLink: boolean;
  pinballmapMachineId: number | null;
  pinballmapExcluded: boolean;
  pinballmapTitleName: string | null;
  /** Hand-entered model identity, present only on an excluded machine (PP-3bbr). */
  modelName: string | null;
  manufacturer: string | null;
  year: number | null;
  type: OpdbMachineType | null;
  display: OpdbDisplayType | null;
  playerCount: number | null;
  designers: string[] | null;
  artists: string[] | null;
  /** Linked iScored game ID string, or null if unlinked. */
  iscoredGameId: string | null;
  ownerRequirements: ProseMirrorDoc | null;
  /** Viewer may see Owner's Requirements (machine-editing 2.6). */
  canViewOwnerRequirements: boolean;
  /**
   * The machine's Pinball Map controls, rendered inside Integrations (3.6).
   * Built by the page, which derives their whole view on the server.
   */
  pinballmap?: React.ReactNode;
}

/**
 * The Manage tab's machine form (PP-o355.19, PP-wqit.14.2).
 *
 * The same fields, in the same order, as the New Machine page
 * (`MachineFormFields`, machine-editing 2.1). One Save writes every field in
 * it through one `updateMachineAction` submit (4.1). Ownership deliberately
 * does NOT live here — owner transfer is in the Danger zone, which acts on its
 * own. Because this form carries no `ownerId` field, the action leaves the
 * owner columns untouched.
 *
 * The Pinball Map controls render inside the Integrations section but are not
 * part of this save: they act immediately, and the page wraps them in a gate
 * that holds them inert while this form is dirty (4.2).
 */
export function MachineDetailsForm({
  machineId,
  name,
  presenceStatus,
  description,
  canLink,
  pinballmapMachineId,
  pinballmapExcluded,
  pinballmapTitleName,
  modelName,
  manufacturer,
  year,
  type,
  display,
  playerCount,
  designers,
  artists,
  iscoredGameId,
  ownerRequirements,
  canViewOwnerRequirements,
  pinballmap = null,
}: MachineDetailsFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    UpdateMachineResult | undefined,
    FormData
  >(updateMachineAction, undefined);

  const isHydrated = useHydrated();

  // Dirtiness lives in a context rather than local state because the Pinball
  // Map section below reads it too — this form owns the PBM link, so its
  // pending save can move the ground under those controls (PP-3bbr.3). Still
  // written from here only; nothing else sets it.
  const { dirty: isDirty, setDirty: setIsDirty } = useDetailsDirty();
  // `useActionState` exposes no reset, so Cancel dismisses the last result
  // instead. Cleared on every submit so a fresh outcome always shows.
  const [resultDismissed, setResultDismissed] = useState(false);
  const shownState = resultDismissed ? undefined : state;

  // The RichTextEditor is uncontrolled after mount (content is an initial
  // prop), so its doc is mirrored here to serialize into the hidden field.
  const [descriptionDoc, setDescriptionDoc] = useState<ProseMirrorDoc | null>(
    description
  );
  const [ownerRequirementsDoc, setOwnerRequirementsDoc] =
    useState<ProseMirrorDoc | null>(ownerRequirements);
  // Machine Name stays uncontrolled, but its live value is mirrored because the
  // Model Details field below shows it as the placeholder — and that
  // placeholder is a promise: a blank model name resolves to the machine's name
  // at read time (spec 2.4). Reading the stored prop instead would preview the
  // OLD name after a rename in the same unsaved edit, then save something else
  // (PR #1925 review).
  const [liveName, setLiveName] = useState(name);
  // Cancel remounts the subtree by changing the key — a native form reset
  // cannot restore a contenteditable widget.
  const [resetKey, setResetKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  // Identifies WHICH snapshot a settling action belongs to. `submitSeqRef` is
  // bumped on dispatch AND on every subsequent edit; `inFlightSeqRef` records
  // the value at dispatch. They diverge exactly when the user typed after the
  // FormData was taken.
  const submitSeqRef = useRef(0);
  const inFlightSeqRef = useRef(0);

  // A successful save makes the SUBMITTED values the new baseline — but only
  // those. The inputs stay editable while the round trip is in flight, so
  // anything typed after the snapshot was taken is still unsaved. Clearing
  // dirtiness for it would both mislabel the note "Saved" and disarm the
  // navigation guard protecting it (PP-o355.19 review).
  //
  // `setIsDirty` is in the deps because it now comes off a context value whose
  // identity changes with `dirty`, so the effect re-runs on every flip. That is
  // safe rather than merely tolerated: `markDirty` bumps `submitSeqRef` on every
  // edit, so the moment anything is dirty the two sequence numbers differ and
  // the body is a no-op. Only the save that matches its own snapshot clears.
  useEffect(() => {
    if (state?.ok && submitSeqRef.current === inFlightSeqRef.current) {
      setIsDirty(false);
    }
  }, [state, setIsDirty]);

  // Snapshot the live form DOM and dispatch straight to the action.
  //
  // This form deliberately does NOT carry `action={formAction}` (PP-1ajq).
  // React 19 auto-resets a `<form action={...}>` once the action settles — on
  // failure as well as success — which wiped the user's unsaved edits: the
  // Machine Name input snapped back to its `defaultValue`, and
  // @radix-ui/react-select >=2.3.3 replayed Availability's mount-time value
  // through its own form-`reset` listener. On a failed save that is silent
  // data loss under an error banner. Dispatching `useActionState` directly
  // means no form submission ever completes, so React never fires that reset.
  // Same remedy as the inline issue metadata forms (PP-0fvr) and the other
  // PP-1ajq forms (create-machine, unified-report, delete-account). It was
  // first applied to the Edit Machine modal that this page replaces.
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    // Suppress native submission; the dispatch below drives the action.
    // Native constraint validation (`required` on name) has already run by the
    // time a submit event fires, so it is not lost.
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    submitSeqRef.current += 1;
    inFlightSeqRef.current = submitSeqRef.current;
    // useActionState dispatch must run inside a transition — outside one,
    // React 19 silently skips the server action.
    setResultDismissed(false);
    startTransition(() => {
      formAction(fd);
    });
  };

  /**
   * Every dirtiness source funnels through here: it flags the section AND
   * invalidates any in-flight save snapshot, so a save that settles after the
   * user kept typing cannot claim those later edits as saved.
   */
  const markDirty = (): void => {
    setIsDirty(true);
    submitSeqRef.current += 1;
  };

  const discardEdits = (): void => {
    setDescriptionDoc(description);
    setOwnerRequirementsDoc(ownerRequirements);
    // The remount restores the input's defaultValue without firing `change`,
    // so the mirror has to be put back by hand.
    setLiveName(name);
    setResetKey((k) => k + 1);
    setIsDirty(false);
    // Discarding throws the edits away, so any banner or "Saved" note
    // describing them has to go with them — otherwise a failed save leaves its
    // error on screen over reverted fields, and a prior success reads as
    // "Saved" about values that were just thrown away (PP-o355.19 review).
    setResultDismissed(true);
  };

  const { dialog: unsavedChangesDialog, openConfirm } = useUnsavedChangesGuard({
    isDirty,
    description: (href) => (
      <>
        You&apos;ve made changes to {name} that haven&apos;t been saved.
        {href
          ? " Leaving now will discard them."
          : " Discarding reverts every field to its saved value."}
      </>
    ),
    discardLabel: "Discard changes",
    stayLabel: "Keep editing",
    onDiscard: discardEdits,
  });

  // Cancel discards after confirming (machine-editing 4.1). With nothing
  // unsaved it is disabled — there is nothing to discard (Tim, PP-wqit.14.2).
  const handleCancel = (): void => {
    openConfirm(null);
  };

  return (
    <>
      <form
        key={resetKey}
        ref={formRef}
        method="post"
        // No `action={formAction}` on purpose — see `handleSubmit` (PP-1ajq).
        // `method="post"` prevents fallback to native GET before hydration (PP-aeei).
        onSubmit={handleSubmit}
        // Any native input event marks the section dirty. Radix Select changes
        // do not bubble `input`, so Availability flags dirtiness explicitly.
        onInput={markDirty}
        className="space-y-5"
        data-testid="machine-details-form"
      >
        <input type="hidden" name="id" value={machineId} />

        {shownState && !shownState.ok && (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-destructive-text">
            <p className="text-sm font-medium" role="alert">
              {shownState.message}
            </p>
          </div>
        )}

        <MachineFormFields
          idPrefix="edit"
          name={{
            defaultValue: name,
            onChange: setLiveName,
          }}
          // Radix Select changes do not bubble `input`, so Availability flags
          // dirtiness explicitly.
          availability={{
            defaultValue: presenceStatus,
            onValueChange: markDirty,
          }}
          modelDetails={
            canLink ? (
              <PinballMapLinkField
                defaultMachineId={pinballmapMachineId}
                defaultName={pinballmapTitleName}
                defaultExcluded={pinballmapExcluded}
                defaultModelName={modelName}
                defaultManufacturer={manufacturer}
                defaultYear={year}
                defaultType={type}
                defaultDisplay={display}
                defaultPlayerCount={playerCount}
                defaultDesigners={designers}
                defaultArtists={artists}
                // The Model name's placeholder — the live input, not the
                // stored prop, so a rename in the same unsaved edit previews
                // the name a blank model will actually resolve to.
                machineName={liveName}
                // The picker's controls are cmdk items and a Radix Select, so
                // none of them bubble `input` — without this the section would
                // still claim "No unsaved changes" after a model change, and
                // Cancel would discard it silently (PP-o355.19 review).
                onDirty={markDirty}
              />
            ) : null
          }
          description={{
            initial: description,
            value: descriptionDoc,
            onChange: (doc) => {
              setDescriptionDoc(doc);
              markDirty();
            },
          }}
          ownerRequirements={
            canViewOwnerRequirements
              ? {
                  initial: ownerRequirements,
                  value: ownerRequirementsDoc,
                  onChange: (doc) => {
                    setOwnerRequirementsDoc(doc);
                    markDirty();
                  },
                }
              : null
          }
          iscored={
            <IscoredGamePicker
              boxed
              machineId={machineId}
              defaultGameId={iscoredGameId}
              machineName={liveName}
              onDirty={markDirty}
            />
          }
          // The STORED source, not the form's live one: the controls act on the
          // saved machine, and while a Source change is unsaved they are held
          // inert anyway (4.2).
          pinballmapUnavailable={pinballmapExcluded}
          pinballmap={pinballmap}
        />

        <MachineFormActionBar
          status={
            <span
              className={
                isDirty
                  ? "mr-auto text-sm text-warning"
                  : "mr-auto text-sm text-muted-foreground"
              }
              data-testid="details-dirty-note"
            >
              {isDirty
                ? "Unsaved changes"
                : shownState?.ok
                  ? "Saved"
                  : "No unsaved changes"}
            </span>
          }
        >
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={!isDirty}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-primary text-on-primary hover:bg-primary/90"
            disabled={!isHydrated || isPending}
            loading={isPending}
          >
            Save details
          </Button>
        </MachineFormActionBar>
      </form>

      {unsavedChangesDialog}
    </>
  );
}

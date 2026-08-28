"use client";

import type React from "react";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
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
import { PinballMapLinkField } from "~/components/machines/PinballMapLinkField";
import { RichTextEditor } from "~/components/editor/RichTextEditorDynamic";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import {
  VALID_MACHINE_PRESENCE_STATUSES,
  getMachinePresenceLabel,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";

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
}

/**
 * Details section of the machine edit page (PP-o355.19).
 *
 * The section owns its own save: everything inside this form is written by one
 * `updateMachineAction` submit, and nothing outside it rides along. Ownership
 * deliberately does NOT live here — it moved to the Danger zone, which submits
 * its own form. Because this form carries no `ownerId` field, the action leaves
 * the owner columns untouched.
 *
 * The PinballMap catalog picker renders here rather than in the PinballMap
 * section because it is genuinely part of this save today — it submits with
 * these fields. PP-o355.21 moves it into that section with its own Save title
 * button; until then, putting it under a heading that implies otherwise would
 * misrepresent the save model.
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
}: MachineDetailsFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    UpdateMachineResult | undefined,
    FormData
  >(updateMachineAction, undefined);

  const [isDirty, setIsDirty] = useState(false);
  // `useActionState` exposes no reset, so Cancel dismisses the last result
  // instead. Cleared on every submit so a fresh outcome always shows.
  const [resultDismissed, setResultDismissed] = useState(false);
  const shownState = resultDismissed ? undefined : state;

  const router = useRouter();
  // Non-null exactly while the discard dialog is open; holds where the user was
  // heading so "Discard changes" can finish the trip.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  // The RichTextEditor is uncontrolled after mount (content is an initial
  // prop), so its doc is mirrored here to serialize into the hidden field.
  const [descriptionDoc, setDescriptionDoc] = useState<ProseMirrorDoc | null>(
    description
  );
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
  useEffect(() => {
    if (state?.ok && submitSeqRef.current === inFlightSeqRef.current) {
      setIsDirty(false);
    }
  }, [state]);

  /**
   * Unsaved-changes guard, part 1 of 2: exits that unload the document —
   * reload, tab close, and off-site links.
   *
   * Armed only while dirty. A permanently-registered handler slows every
   * navigation and is treated as abuse by some browsers, so the subscription
   * itself is the signal. The prompt's wording belongs to the browser — custom
   * strings have been ignored for a decade, so `preventDefault()` is the whole
   * API (no legacy `returnValue`).
   */
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  /**
   * Unsaved-changes guard, part 2 of 2: in-app navigation.
   *
   * The Edit MODAL this page replaced funnelled every dismiss vector through one
   * controlled `onOpenChange` and confirmed there. The conversion dropped it,
   * reasoning that a page has no dismiss vector — true, but a page has
   * navigation vectors, and `MachineTabStrip` renders Info/Settings/Service/
   * Timeline links directly above this form (via `RouteTabStrip`, which emits
   * real `next/link` anchors). App Router navigations never unload the document,
   * so `beforeunload` cannot see them: one click discarded a paragraph of
   * Description with no prompt (PP-o355.19 review).
   *
   * App Router exposes no navigation-guard API, so the click is the only seam.
   * Capture phase, to run before Next's own handler; on `document` rather than
   * the form because the links live OUTSIDE this component's subtree. It
   * unregisters the moment the form is clean, so it has no reach beyond the
   * window where there is something to lose.
   *
   * Threading a guard through React context into `RouteTabStrip` would be
   * tidier in the abstract, but that component is shared by every machine page;
   * this keeps a one-page concern on the one page.
   *
   * KNOWN GAP — the browser Back button within the app. It fires `popstate`,
   * which is not cancellable; guarding it means pushing a sentinel history entry
   * and re-pushing on every pop, which breaks Back for as long as the form is
   * dirty. A user who cannot leave is a worse bug than the one that fixes, so
   * same-app Back still discards silently. (`beforeunload` does cover Back when
   * it leaves the origin.) Don't "fix" this speculatively.
   */
  useEffect(() => {
    if (!isDirty) return;
    const handleClick = (event: MouseEvent): void => {
      // A modified or non-primary click opens a new tab or window, so THIS
      // document — and the edits in it — survives. Let it through.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      // Opens elsewhere, or downloads without navigating.
      if (anchor.target !== "" && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      // Off-site: the document unloads, so `beforeunload` already covers it.
      if (destination.origin !== window.location.origin) return;
      // Same page (including a bare fragment): discards nothing.
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingHref(
        `${destination.pathname}${destination.search}${destination.hash}`
      );
    };
    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [isDirty]);

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

  const keepEditing = (): void => {
    setPendingHref(null);
  };

  const discardAndLeave = (): void => {
    const destination = pendingHref;
    setPendingHref(null);
    // Clear dirtiness FIRST so both listeners unsubscribe before the navigation
    // starts — otherwise the guard is still armed on the way out.
    setIsDirty(false);
    if (destination !== null) router.push(destination);
  };

  const handleCancel = (): void => {
    setDescriptionDoc(description);
    setResetKey((k) => k + 1);
    setIsDirty(false);
    // Cancel discards the edits, so any banner or "Saved" note describing them
    // has to go with them — otherwise a failed save leaves its error on screen
    // over reverted fields, and a prior success reads as "Saved" about values
    // that were just thrown away (PP-o355.19 review).
    setResultDismissed(true);
  };

  return (
    <>
      <form
        key={resetKey}
        ref={formRef}
        // No `action={formAction}` on purpose — see `handleSubmit` (PP-1ajq).
        onSubmit={handleSubmit}
        // Any native input event marks the section dirty. Radix Select changes
        // do not bubble `input`, so Availability flags dirtiness explicitly.
        onInput={markDirty}
        className="space-y-4"
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

        {/* Name and Availability share a row once the container is wide enough.
          This pairing is deliberate but NOT semantic — unlike Model/Edition
          (which pair inside PinballMapLinkField, where Edition is meaningless
          without a Model), these two fields have nothing to do with each other
          and are paired purely because both are short. The tradeoff was taken
          knowingly: multi-column forms cost some scanning speed when the
          columns aren't related, and it makes tab order Name → Availability →
          Model, but it buys enough vertical space that the whole tab —
          including Danger zone — fits above the fold at 1440x900. Tab order is
          pinned by a test in machine-details-form.test.tsx; if you unpair
          these, that test is the thing that will tell you. */}
        <div className="grid gap-4 @xl:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name" className="text-foreground">
              Machine Name <span aria-hidden="true">*</span>
            </Label>
            <Input
              id="edit-name"
              name="name"
              type="text"
              required
              defaultValue={name}
              placeholder="e.g., Medieval Madness"
              enterKeyHint="next"
              className="border-outline bg-surface text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-presence" className="text-foreground">
              Availability
            </Label>
            <Select
              name="presenceStatus"
              defaultValue={presenceStatus}
              onValueChange={markDirty}
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
        </div>

        {canLink && (
          <PinballMapLinkField
            defaultMachineId={pinballmapMachineId}
            defaultName={pinballmapTitleName}
            defaultExcluded={pinballmapExcluded}
            defaultModelName={modelName}
            defaultManufacturer={manufacturer}
            defaultYear={year}
            // Seeds the Model name when the hand-entry panel opens empty. The
            // stored name, not the live input: renaming a cabinet and marking
            // it off-catalog in the same edit is rare enough that reading the
            // uncontrolled input's DOM value would cost more than it buys.
            machineName={name}
            // The picker's controls are cmdk items and a Radix Select, so none of
            // them bubble `input` — without this the section would still claim
            // "No unsaved changes" after a model change, and Cancel would discard
            // it silently (PP-o355.19 review).
            onDirty={markDirty}
          />
        )}

        <div className="space-y-1.5">
          {/* No htmlFor: RichTextEditor is a contenteditable widget with no
            focusable `id`. Its accessible name comes from `ariaLabel`. */}
          <Label className="text-foreground">Description</Label>
          <RichTextEditor
            content={description}
            onChange={(doc) => {
              setDescriptionDoc(doc);
              markDirty();
            }}
            mentionsEnabled={false}
            placeholder="Add a description for this machine..."
            ariaLabel="Machine description"
            compact={false}
            className="min-h-[96px]"
          />
          <input
            type="hidden"
            name="description"
            value={descriptionDoc ? JSON.stringify(descriptionDoc) : ""}
          />
        </div>

        <div className="flex items-center justify-end gap-3">
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
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-primary text-on-primary hover:bg-primary/90"
            loading={isPending}
          >
            Save details
          </Button>
        </div>
      </form>

      {/* Copy carried over verbatim from the Edit modal this page replaced, so
          the choice reads identically to anyone who used the old dialog. */}
      <AlertDialog
        open={pendingHref !== null}
        onOpenChange={(open) => {
          if (!open) keepEditing();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ve made changes to {name} that haven&apos;t been saved.
              Leaving now will discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={keepEditing}>
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={discardAndLeave}>
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

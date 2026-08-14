"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { CheckCircle2, MapPin, TriangleAlert } from "lucide-react";

import {
  acceptMissingPinballmapListingAction,
  linkPinballmapEntryAction,
  listMachineOnPinballMapAction,
  unlistMachineFromPinballMapAction,
} from "~/app/(app)/m/pinballmap-actions";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import type { PbmListingState } from "~/lib/pinballmap/status";
import type { Result } from "~/lib/result";

/**
 * The four listing actions share this shape. Widened to `Result<unknown,
 * string>` deliberately: this component reads only `ok` and `message`, and
 * naming the four concrete result types here would couple it to four error-code
 * unions it never branches on.
 */
type ListingAction = (
  prev: undefined,
  formData: FormData
) => Promise<Result<unknown, string>>;

/**
 * The Manage tab's Pinball Map listing control (PP-o355.21) — a full rewrite of
 * the #1683 control it replaces.
 *
 * **Derive, don't discover.** The state arrives already computed from stored
 * columns and the stored snapshot (`derivePbmListingState`), so the control is
 * painted before anyone clicks anything and no render reaches pinballmap.com
 * (CORE-PBM-001). The old control made you press "Connect" to find out where
 * you stood, and told APC's entire listed fleet "Not listed" while it waited.
 * "Connect", "Verify" and "Reconnect" are retired outright — the Verify server
 * action is deleted, and the drift it used to heal by hand is healed by the
 * hourly reconcile pass instead.
 *
 * **Buttons, not a toggle.** Three of the four transitions change what the
 * public map shows and need a confirm; a switch would promise instant and cheap
 * and then argue with a modal. The status line carries the state, the button
 * carries the weight. No trailing ellipsis on the labels — a confirm dialog is
 * not the kind of "more input required" that an ellipsis promises (Tim,
 * 2026-08-12).
 *
 * **No Pinball Map title row.** The Model / Edition control in Details owns that
 * job; repeating it here would put two editors on one fact.
 *
 * Everything here applies immediately — nothing in this section rides the
 * Details save.
 */

export interface PinballmapListingControlProps {
  machineId: string;
  /** Derived on the server; never discovered by pressing a button. */
  state: PbmListingState;
  /** Our local listing flag — the only thing `unsynced` can honestly report. */
  listed: boolean;
  /**
   * Viewer holds `machines.pinballmap.link`: the local-bookkeeping capability
   * (owner of this machine / technician / admin). Claim and Accept write only
   * to PinPoint, so they sit behind this rather than `push`.
   */
  canLink: boolean;
  /** Viewer holds `machines.pinballmap.push` — writes to the public map (admin). */
  canPush: boolean;
  /**
   * An operator credential is provisioned in Vault. Without one the outbound
   * writes cannot run at all, so Add / Remove are absent rather than present
   * and failing (CORE-ARCH-012). Read from `pinballmap_state` columns — the
   * token itself is never decrypted to answer this.
   */
  writeEnabled: boolean;
  /** Catalog title, so a confirm names the game rather than "this machine". */
  modelName: string | null;
  /**
   * Initials of the OTHER cabinets sharing this title, for the two states whose
   * sentence has to name them. Empty for every other state, and the copy falls
   * back to "another cabinet" rather than rendering a gap if it arrives empty
   * when it shouldn't.
   */
  rivalInitials?: readonly string[];
}

/** What the confirm dialog for each outbound action says. */
interface ConfirmCopy {
  title: string;
  body: string;
  action: string;
  destructive?: boolean;
}

function ConfirmButton({
  trigger,
  copy,
  onConfirm,
  pending,
  testId,
}: {
  trigger: React.ReactNode;
  copy: ConfirmCopy;
  onConfirm: () => void;
  pending: boolean;
  testId: string;
}): React.JSX.Element {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent data-testid={`${testId}-confirm`}>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant={copy.destructive === true ? "destructive" : "default"}
            disabled={pending}
            onClick={onConfirm}
          >
            {copy.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function PinballmapListingControl({
  machineId,
  state,
  listed,
  canLink,
  canPush,
  writeEnabled,
  modelName,
  rivalInitials = [],
}: PinballmapListingControlProps): React.JSX.Element {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  /**
   * Every action here is `(prev, formData)`-shaped, but none of them is
   * dispatched by a `<form>`: the trigger lives inside an AlertDialog that
   * unmounts the moment it is confirmed, and a form that unmounts mid-submit is
   * a race nobody needs. Calling the action inside a transition keeps the
   * pending state and the failure message on THIS component, which outlives the
   * dialog.
   */
  function run(action: ListingAction): void {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("machineId", machineId);
      const result = await action(undefined, formData);
      // A failure has to be visible: on success the page revalidates and the
      // status line changes underneath, so a silent no-op would leave both
      // outcomes looking identical (CORE-ARCH-012).
      if (!result.ok) setError(result.message);
    });
  }

  const game = modelName ?? "this machine";
  const canWriteOut = canPush && writeEnabled;

  const addButton = (
    <ConfirmButton
      testId="pbm-listing-add"
      pending={pending}
      onConfirm={() => {
        run(listMachineOnPinballMapAction);
      }}
      copy={{
        title: "Add to Pinball Map?",
        body: `This adds ${game} to our location's lineup on pinballmap.com, where anyone can see it.`,
        action: "Add to Pinball Map",
      }}
      trigger={
        <Button
          variant="outline"
          size="sm"
          loading={pending}
          data-testid="pbm-listing-add"
        >
          <MapPin aria-hidden="true" className="size-4" />
          Add to Pinball Map
        </Button>
      }
    />
  );

  // Which actions appear is a permission question first and a state question
  // second — a member looking at a machine they don't own sees the status and
  // nothing else. Computed up front so the actions row can be omitted entirely
  // rather than rendered empty: an empty flex row is invisible but still takes
  // the `space-y` margin above it, which is half of why this block used to
  // look padded for no reason.
  //
  // The four unclaimed states do NOT share an action, which is the whole reason
  // they are four states. Claim is offered where claiming is right — this
  // machine is the pick, or the tie is this machine's to break. It is withheld
  // for `unclaimed_unavailable`, where the entry should come down rather than be
  // recorded, and for `unclaimed_elsewhere`, where claiming would move the
  // listing onto the wrong cabinet.
  //
  // `unclaimed_unavailable` gets NO button, deliberately. Its copy says the
  // entry should come down, and the obvious control would be Remove — but
  // `unlistMachineFromPinballMapAction` needs `pinballmapListed` and a stored
  // lmx id, and this state is defined by having neither: the listing is theirs,
  // not ours. The button would fail every time with "This machine isn't listed
  // on Pinball Map", which is precisely the control-that-cannot-do-what-it-says
  // shape CORE-ARCH-012 forbids. Taking down an entry PinPoint does not hold is
  // PP-o355.31 / PP-o355.32 work; until then the copy points at the map link
  // directly above, which is a real route.
  const claimable = state === "unclaimed_on_pbm" || state === "unclaimed_tie";
  const actions = [
    state === "not_listed" && canWriteOut,
    claimable && canLink,
    state === "listed" && canWriteOut,
    state === "missing_on_pbm" && (canLink || canWriteOut),
  ].some(Boolean);

  return (
    // No card, no border, no background. This is one sentence and sometimes a
    // button; a bordered box around that reads as a component when it is really
    // a line of prose, and it stacked a second frame directly above the
    // abandoned-listing Alert that follows (Tim, 2026-08-14: "the box is too
    // big and misaligned, why not just a single line of text?"). The section
    // heading and divider above already scope it.
    <section aria-label="Pinball Map listing" data-testid="pbm-listing-control">
      {/* `items-center`, not `items-start`. The copy is a single line at every
          width the rail allows, so top-aligning put the icon visibly above the
          text's optical centre. It wraps to two lines only on very narrow
          phones, where a centred icon is still the lesser problem. */}
      <div className="flex items-center gap-2">
        <StateIcon state={state} />
        <p className="text-sm text-foreground" data-testid="pbm-listing-status">
          {statusCopy(state, listed, rivalInitials)}
        </p>
      </div>

      {actions ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {state === "not_listed" && canWriteOut ? addButton : null}

          {claimable && canLink ? (
            // No confirm: this writes nothing to Pinball Map. It records the
            // listing they already show, which is what auto-link would have done
            // on its own if two same-title cabinets hadn't tied.
            <Button
              variant="outline"
              size="sm"
              loading={pending}
              data-testid="pbm-listing-claim"
              onClick={() => {
                run(linkPinballmapEntryAction);
              }}
            >
              Claim this listing
            </Button>
          ) : null}

          {state === "listed" && canWriteOut ? (
            <ConfirmButton
              testId="pbm-listing-remove"
              pending={pending}
              onConfirm={() => {
                run(unlistMachineFromPinballMapAction);
              }}
              copy={{
                title: "Remove from Pinball Map?",
                body: `This takes ${game} off our location's lineup on pinballmap.com. Anyone looking us up will stop seeing it.`,
                action: "Remove from Pinball Map",
                destructive: true,
              }}
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  loading={pending}
                  data-testid="pbm-listing-remove"
                >
                  Remove from Pinball Map
                </Button>
              }
            />
          ) : null}

          {state === "missing_on_pbm" ? (
            <>
              {canLink ? (
                <ConfirmButton
                  testId="pbm-listing-accept"
                  pending={pending}
                  onConfirm={() => {
                    run(acceptMissingPinballmapListingAction);
                  }}
                  copy={{
                    title: "Accept the removal?",
                    body: "This only updates PinPoint to agree with Pinball Map. Nothing is sent to them — the entry is already gone from their lineup.",
                    action: "Accept",
                  }}
                  trigger={
                    <Button
                      variant="outline"
                      size="sm"
                      loading={pending}
                      data-testid="pbm-listing-accept"
                    >
                      Accept
                    </Button>
                  }
                />
              ) : null}
              {/* Same action as `not_listed`, offered as the other resolution:
                put it back rather than agree it is gone. */}
              {canWriteOut ? addButton : null}
            </>
          ) : null}
        </div>
      ) : null}

      {error !== null ? (
        <p
          className="mt-2 text-xs text-destructive-text"
          role="alert"
          data-testid="pbm-listing-error"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Amber for the states somebody has to resolve, a check for the settled listed
 * state, and a neutral pin for everything else. The icon is decorative — the
 * sentence beside it carries the meaning, so nothing here is colour-only.
 *
 * Plain `unclaimed_on_pbm` gets the neutral pin rather than amber: it resolves
 * itself on the next reconcile, and an alert icon for something no one has to
 * act on is the noise `isActionableDesync` exists to avoid. `unclaimed_elsewhere`
 * is neutral for the same reason from the other direction — it is another
 * cabinet's business and there is nothing to do here.
 */
function StateIcon({ state }: { state: PbmListingState }): React.JSX.Element {
  if (
    state === "missing_on_pbm" ||
    state === "unclaimed_tie" ||
    state === "unclaimed_unavailable"
  ) {
    return (
      <TriangleAlert
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-warning"
      />
    );
  }
  if (state === "listed") {
    return (
      <CheckCircle2
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-success"
      />
    );
  }
  return (
    <MapPin
      aria-hidden="true"
      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
    />
  );
}

/**
 * One sentence per state, saying what is true rather than what to press.
 *
 * "Our location's lineup" instead of "APC's lineup" or a bare "listed": the
 * thing being described is a row on someone else's public map, and every one of
 * these sentences has to survive being read by someone who has never heard of
 * an lmx. The word never appears (settled vocabulary, §4 of the refresher).
 */
function statusCopy(
  state: PbmListingState,
  listed: boolean,
  rivals: readonly string[]
): string {
  switch (state) {
    case "unmatched":
      return "No model set yet, so there's nothing to list on Pinball Map.";
    case "not_on_pbm":
      return "Marked as not on Pinball Map, so it can't be listed there.";
    case "unsynced":
      return listed
        ? "Listed on Pinball Map — PinPoint hasn't read their lineup yet, so this hasn't been checked against it."
        : "PinPoint hasn't read Pinball Map's lineup yet, so this machine's listing there is unknown.";
    case "not_listed":
      return "Not on our location's lineup on Pinball Map.";
    case "unclaimed_on_pbm":
      return "Pinball Map shows this game on our location's lineup, but PinPoint isn't holding that listing yet. The next sync will pick this up on its own.";
    // Names the other cabinets and says what breaks the tie, because "PinPoint
    // won't choose" is only actionable if you know the choice is yours and
    // where the alternative lives (Tim, 2026-08-14).
    case "unclaimed_tie":
      return `Pinball Map shows this game on our location's lineup, but ${describeRivals(rivals)} could hold that listing and PinPoint won't guess between them. Claim it here to settle it on this machine, or claim it on ${rivals.length === 1 ? "the other one" : "one of the others"} instead.`;
    // The availability contradiction, stated as the contradiction: the entry is
    // live on a public map for a game we record as not on the floor.
    case "unclaimed_unavailable":
      return "Pinball Map shows this game on our location's lineup, but no cabinet of it is on the floor — every one is marked as not yet arrived or removed. Their entry is out of date and should come down; PinPoint can't do it from here because the listing isn't ours to remove. Use the Pinball Map link above.";
    case "unclaimed_elsewhere":
      return `Pinball Map shows this game on our location's lineup, and that listing belongs to ${describeRivals(rivals)}. Nothing to do here.`;
    case "listed":
      return "Listed on our location's lineup on Pinball Map.";
    case "missing_on_pbm":
      return "PinPoint has this listed, but it isn't on Pinball Map's lineup — someone removed it there.";
  }
}

/**
 * "AFM", "AFM or SM", "AFM, SM or BK" — the other cabinets of the same title.
 *
 * Falls back to a count when the caller could not resolve names, which is
 * better than an empty phrase but is not expected in practice: the Manage page
 * queries the group it passes.
 */
function describeRivals(rivals: readonly string[]): string {
  if (rivals.length === 0) return "another cabinet";
  if (rivals.length === 1) return `this one and ${rivals[0] ?? ""}`.trim();
  const last = rivals[rivals.length - 1] ?? "";
  return `this one, ${rivals.slice(0, -1).join(", ")} or ${last}`;
}

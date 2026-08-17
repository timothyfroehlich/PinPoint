"use client";

import type React from "react";
import { useState, useTransition } from "react";
import {
  CheckCircle2,
  ExternalLink,
  MapPin,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import {
  addMachineToPinballMapAction,
  refreshPinballmapLineupAction,
  removeMachineFromPinballMapAction,
  setPinballmapIntentAction,
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
import { formatRelative } from "~/lib/dates";
import type {
  PbmListingIntent,
  PbmListingView,
  PbmSibling,
} from "~/lib/pinballmap/listing-state";
import type { Result } from "~/lib/result";
import { cn } from "~/lib/utils";

/**
 * The Manage tab's Pinball Map control (PP-o355.21) — spec §4.
 *
 * **Two rows under one header, at one fixed height in every state** (4.1). The
 * intent row is the operator's decision; the status row is what Pinball Map
 * actually shows, with the push that would reconcile them on the right. States
 * swap content, never geometry, so switching between machines does not reflow
 * the tab.
 *
 * Splitting the two lines is what removed the old control's central confusion.
 * When one button meant both "decide this should be listed" and "write that to
 * pinballmap.com", every state had to answer both questions at once, and the
 * add/remove verbs double-booked. Now the toggle is local and instant, the push
 * appears only when the two lines disagree, and an in-sync machine has no
 * buttons at all.
 *
 * **Derive, don't discover.** The whole view arrives computed from stored
 * columns and the stored lineup (`derivePbmListingView`), so nothing here
 * reaches pinballmap.com at render (CORE-PBM-001).
 */

/** Every action here is `(prev, formData)`-shaped and read only for ok/message. */
type ListingAction = (
  prev: undefined,
  formData: FormData
) => Promise<Result<unknown, string>>;

export interface PinballmapListingControlProps {
  machineId: string;
  /** Derived on the server; never discovered by pressing a button. */
  view: PbmListingView;
  /** Location name from Pinball Map's own record; null before a first refresh. */
  locationName: string | null;
  /** The location's page on pinballmap.com — also the 9.1 attribution link. */
  locationUrl: string;
  /** When the stored lineup was last read, or null if it never has been. */
  lastRefreshedAt: Date | null;
  /** Refreshes left in the shared burst allowance, and when the next lands. */
  refreshRemaining: number;
  refreshAvailableAt: Date | null;
  /**
   * Viewer holds `machines.pinballmap.link` (spec 8.1) — may set intent. False
   * renders the whole control read-only (4.9), header Refresh excepted.
   */
  canSetIntent: boolean;
  /** Viewer holds `machines.pinballmap.push` (8.2) — may write to Pinball Map. */
  canPush: boolean;
  /** Viewer holds `machines.pinballmap.sync` (8.3) — may press Refresh. */
  canRefresh: boolean;
  /**
   * An operator credential is provisioned. Without one the outbound writes
   * cannot run, so the status row links out instead of showing a button that
   * would fail (4.4, CORE-ARCH-012). Read off `pinballmap_state` columns — the
   * token is never decrypted to answer this.
   */
  writeEnabled: boolean;
  /** Catalog title, so a confirm names the game rather than "this machine". */
  modelName: string | null;
  /** Comments on the entry, for the remove confirm's consequence line (4.6). */
  commentCount: number | null;
}

const INTENT_OPTIONS: readonly { value: PbmListingIntent; label: string }[] = [
  { value: "on", label: "On the lineup" },
  { value: "off", label: "Off the lineup" },
  { value: "no_sync", label: "Don't sync" },
];

export function PinballmapListingControl({
  machineId,
  view,
  locationName,
  locationUrl,
  lastRefreshedAt,
  refreshRemaining,
  refreshAvailableAt,
  canSetIntent,
  canPush,
  canRefresh,
  writeEnabled,
  modelName,
  commentCount,
}: PinballmapListingControlProps): React.JSX.Element {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  /**
   * None of these actions is dispatched by a `<form>`: the push triggers live
   * inside an AlertDialog that unmounts the moment it is confirmed, and a form
   * that unmounts mid-submit is a race nobody needs. Running the action in a
   * transition keeps the pending state and the failure message on THIS
   * component, which outlives the dialog.
   */
  function run(action: ListingAction, fields?: Record<string, string>): void {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("machineId", machineId);
      for (const [k, v] of Object.entries(fields ?? {})) formData.set(k, v);
      const result = await action(undefined, formData);
      // A failure has to be visible: on success the page revalidates and the
      // rows change underneath, so a silent no-op would leave both outcomes
      // looking identical (CORE-ARCH-012).
      if (!result.ok) setError(result.message);
    });
  }

  const game = modelName ?? "this machine";
  const canWriteOut = canPush && writeEnabled;
  const disabled = view.disabled !== null;

  return (
    <section aria-label="Pinball Map" data-testid="pbm-listing-control">
      <Header
        locationName={locationName}
        locationUrl={locationUrl}
        lastRefreshedAt={lastRefreshedAt}
        refreshRemaining={refreshRemaining}
        refreshAvailableAt={refreshAvailableAt}
        canRefresh={canRefresh}
        outOfSync={view.outOfSync}
        pending={pending}
        onRefresh={() => {
          run(refreshPinballmapLineupAction);
        }}
      />

      {/* One wrapper for both rows so the disabled states dim and inert the
          pair together without changing the box's height (4.1). `inert` is the
          platform answer to "visible but not interactive" — it removes the
          subtree from the tab order and the a11y tree in one attribute, where
          `pointer-events-none` would leave it keyboard-reachable. */}
      <div
        className={cn("space-y-2.5", disabled && "opacity-45")}
        {...(disabled ? { inert: true } : {})}
        data-testid="pbm-listing-rows"
      >
        <Row label="Intent">
          <IntentToggle
            value={view.intent}
            blockedReason={view.onPositionBlockedReason}
            readOnly={!canSetIntent || disabled}
            pending={pending}
            onChange={(intent) => {
              run(setPinballmapIntentAction, { intent });
            }}
          />
          {/* Tim, 2026-08-16: the Alert state gets BOTH placements — this note
              beside the toggle and the warning on the status row. The toggle is
              where the contradiction lives (this cabinet says it should be on a
              public lineup while our own records say it is not here), so a
              reader scanning the intent row has to see it there too. */}
          {view.advisory === "alert" && view.advisoryDetail !== null ? (
            <span
              className="inline-flex items-center gap-1.5 text-xs text-warning"
              data-testid="pbm-listing-alert"
            >
              <TriangleAlert aria-hidden="true" className="size-3.5" />
              Alert: Availability set to {view.advisoryDetail}
            </span>
          ) : null}
        </Row>

        <Row label="Status">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <StatusIcon view={view} />
            <p
              className="text-sm text-foreground"
              data-testid="pbm-listing-status"
            >
              {statusSentence(view, locationUrl, canWriteOut)}
            </p>
          </div>

          {view.pushAction !== null && canWriteOut ? (
            <div className="ml-auto shrink-0">
              {view.pushAction === "add" ? (
                <ConfirmButton
                  testId="pbm-listing-add"
                  pending={pending}
                  onConfirm={() => {
                    run(addMachineToPinballMapAction);
                  }}
                  copy={{
                    title: "Add to Pinball Map?",
                    body: `Adds ${game} to the location's lineup on pinballmap.com, where it will be publicly visible.`,
                    action: "Add machine",
                  }}
                  label="Add machine to Pinball Map"
                />
              ) : (
                <ConfirmButton
                  testId="pbm-listing-remove"
                  pending={pending}
                  destructive
                  onConfirm={() => {
                    run(removeMachineFromPinballMapAction);
                  }}
                  copy={{
                    title: "Remove from Pinball Map?",
                    body: `Removes ${game} from the location's lineup on pinballmap.com. It will no longer be publicly visible.`,
                    action: "Remove machine",
                    consequence: removeConsequence(commentCount),
                  }}
                  label="Remove machine from Pinball Map"
                />
              )}
            </div>
          ) : null}
        </Row>
      </div>

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
 * "Pinball Map — {location}", last-refresh time, Refresh, and the Out of sync
 * alert (4.1). Before the first refresh the location name is unknown — it comes
 * from Pinball Map's own record — so the title renders bare rather than guessing.
 */
function Header({
  locationName,
  locationUrl,
  lastRefreshedAt,
  refreshRemaining,
  refreshAvailableAt,
  canRefresh,
  outOfSync,
  pending,
  onRefresh,
}: {
  locationName: string | null;
  locationUrl: string;
  lastRefreshedAt: Date | null;
  refreshRemaining: number;
  refreshAvailableAt: Date | null;
  canRefresh: boolean;
  outOfSync: boolean;
  pending: boolean;
  onRefresh: () => void;
}): React.JSX.Element {
  const spent = refreshRemaining <= 0;
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant pb-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Pinball Map
        {locationName !== null ? (
          <>
            {" — "}
            <a
              href={locationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 normal-case tracking-normal text-primary underline underline-offset-2 hover:no-underline"
            >
              {locationName}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </>
        ) : null}
      </h3>

      <div className="flex items-center gap-2.5">
        {outOfSync ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-warning/50 bg-warning-container/50 px-2 py-0.5 text-xs font-medium text-on-warning-container"
            data-testid="pbm-listing-out-of-sync"
          >
            <TriangleAlert aria-hidden="true" className="size-3" />
            Out of sync
          </span>
        ) : null}

        <span
          className={cn(
            "text-xs",
            lastRefreshedAt === null ? "text-warning" : "text-muted-foreground"
          )}
          data-testid="pbm-listing-refreshed-at"
        >
          {lastRefreshedAt === null
            ? "Never refreshed"
            : `Refreshed ${formatRelative(lastRefreshedAt)}`}
        </span>

        {canRefresh ? (
          <Button
            variant="outline"
            size="sm"
            loading={pending}
            disabled={spent}
            onClick={onRefresh}
            data-testid="pbm-listing-refresh"
            // The countdown lives in the title rather than the label so the
            // button does not change width as it ticks — the header sits above
            // a fixed-height box and a resizing control undoes that (4.1).
            title={
              spent && refreshAvailableAt !== null
                ? `Refreshes again ${formatRelative(refreshAvailableAt)}`
                : undefined
            }
          >
            <RefreshCw aria-hidden="true" className="size-3.5" />
            Refresh
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** One labelled row. Fixed minimum height is what keeps 4.1's promise. */
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-3">
      <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * The tri-state toggle (4.1). A segmented control rather than three buttons or a
 * switch: the three positions are mutually exclusive settings, all three are
 * always meaningful, and the current one has to be readable at a glance.
 *
 * Real `<button>` elements inside a radiogroup, so keyboard and screen-reader
 * users get the same three choices (CORE-A11Y-004).
 */
function IntentToggle({
  value,
  blockedReason,
  readOnly,
  pending,
  onChange,
}: {
  value: PbmListingIntent;
  blockedReason: string | null;
  readOnly: boolean;
  pending: boolean;
  onChange: (intent: PbmListingIntent) => void;
}): React.JSX.Element {
  return (
    <>
      <div
        role="radiogroup"
        aria-label="Pinball Map listing intent"
        className="inline-flex overflow-hidden rounded-lg border border-outline-variant"
        data-testid="pbm-listing-intent"
      >
        {INTENT_OPTIONS.map((option) => {
          const selected = option.value === value;
          // Only the On position is ever blocked by availability (6.2); Off and
          // Don't sync are always reachable, which is what makes the block a
          // guard rather than a trap.
          const blocked = option.value === "on" && blockedReason !== null;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={readOnly || pending || (blocked && !selected)}
              onClick={() => {
                if (!selected) onChange(option.value);
              }}
              data-testid={`pbm-listing-intent-${option.value}`}
              className={cn(
                "px-3 py-1.5 text-xs whitespace-nowrap transition-colors",
                "border-l border-outline-variant first:border-l-0",
                selected
                  ? "bg-primary/15 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-muted/50",
                "disabled:pointer-events-none disabled:opacity-40"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {blockedReason !== null && value !== "on" ? (
        <span
          className="text-xs text-muted-foreground"
          data-testid="pbm-listing-blocked-reason"
        >
          {blockedReason}
        </span>
      ) : null}
    </>
  );
}

/**
 * Amber where somebody has to act or look, a check where intent and lineup
 * agree, a neutral pin otherwise. Decorative — the sentence beside it carries
 * the meaning, so nothing here is colour-only (CORE-A11Y).
 */
function StatusIcon({ view }: { view: PbmListingView }): React.JSX.Element {
  if (view.outOfSync || view.advisory === "alert") {
    return (
      <TriangleAlert
        aria-hidden="true"
        className="size-4 shrink-0 text-warning"
      />
    );
  }
  if (view.name === "on" || view.name === "shared" || view.name === "flag") {
    return (
      <CheckCircle2
        aria-hidden="true"
        className="size-4 shrink-0 text-success"
      />
    );
  }
  return (
    <MapPin
      aria-hidden="true"
      className="size-4 shrink-0 text-muted-foreground"
    />
  );
}

/**
 * One sentence per state, saying what is true rather than what to press
 * (spec 4.2, 4.8 — "listing" never appears; the object is an entry, the set is
 * the lineup).
 *
 * Without credentials the sentence carries the action as a link out to Pinball
 * Map instead (4.4): a control that cannot perform its action must not be shown
 * (CORE-ARCH-012).
 */
function statusSentence(
  view: PbmListingView,
  locationUrl: string,
  canWriteOut: boolean
): React.ReactNode {
  const sub = (text: string): React.JSX.Element => (
    <span className="text-muted-foreground">{text}</span>
  );
  const linkOut = (text: string): React.JSX.Element => (
    <>
      {" "}
      <a
        href={locationUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:no-underline"
      >
        {text}
      </a>
      , then Refresh to update.
    </>
  );

  switch (view.name) {
    case "no_model":
      return (
        <>
          No model set. {sub("Set a model to add this machine to Pinball Map.")}
        </>
      );
    case "uncataloged":
      return <>Uncataloged game — not in Pinball Map&apos;s catalog.</>;
    case "waiting":
      return sub("Waiting for the first Pinball Map refresh.");
    case "sync_off":
      return (
        <>
          {view.observed
            ? "On the location's lineup."
            : "Not on the location's lineup."}{" "}
          {sub("Sync off — differences not flagged.")}
        </>
      );
    case "on":
      return <>On the location&apos;s lineup.</>;
    case "shared":
      // Composed as elements rather than an interpolated string: the sibling
      // names are links, so they cannot go through `sub`'s string argument.
      return (
        <>
          On the location&apos;s lineup.{" "}
          <span className="text-muted-foreground">
            Shared with {nameSiblings(view.coveredBy)} — comments sync to all.
          </span>
        </>
      );
    case "covered":
      return (
        <>On the location&apos;s lineup via {nameSiblings(view.coveredBy)}.</>
      );
    case "off":
    case "blocked":
      return <>Not on the location&apos;s lineup.</>;
    case "alert":
      return (
        <>
          On the location&apos;s lineup.{" "}
          {sub("Pinball Map only allows entries for games that are present.")}
        </>
      );
    case "flag":
      return (
        <>
          On the location&apos;s lineup.{" "}
          {sub(
            `Note: ${view.advisoryDetail ?? "away"} — if it will be away more than a week, consider removing it from the lineup.`
          )}
        </>
      );
    case "missing":
      return (
        <>
          Not on the location&apos;s lineup.
          {canWriteOut ? null : linkOut("Add it on Pinball Map")}
        </>
      );
    case "lingering":
      return (
        <>
          Still on the location&apos;s lineup.
          {canWriteOut ? null : linkOut("Remove it on Pinball Map")}
        </>
      );
  }
}

/** "AFM", "AFM and MM", "AFM, MM and TZ" — the sibling cabinets, by initials. */
function nameSiblings(siblings: readonly PbmSibling[]): React.ReactNode {
  if (siblings.length === 0) return "another cabinet";
  const links = siblings.map((s) => (
    <a
      key={s.id}
      href={`/m/${s.initials}`}
      className="text-primary underline underline-offset-2 hover:no-underline"
    >
      {s.initials}
    </a>
  ));
  if (links.length === 1) return links[0];
  return (
    <>
      {links.slice(0, -1).map((link, i) => (
        <span key={siblings[i]?.id ?? i}>
          {link}
          {i < links.length - 2 ? ", " : " "}
        </span>
      ))}
      and {links[links.length - 1]}
    </>
  );
}

/**
 * The remove confirmation's consequence line (4.6): the entry's comment count
 * and what happens to it, stated accurately.
 *
 * A null count means the lineup has not been read recently enough to know. It
 * says so rather than showing a number it cannot stand behind (CORE-ARCH-012).
 */
function removeConsequence(commentCount: number | null): string | null {
  if (commentCount === null) {
    return "PinPoint could not read this entry's comments just now, so it can't say how many would be lost. Refresh first if that matters.";
  }
  if (commentCount === 0) return null;
  const plural = commentCount === 1 ? "comment" : "comments";
  return `The entry has ${String(commentCount)} ${plural}. They are recoverable only if the game is re-added within 7 days; after that the history is permanently lost.`;
}

interface ConfirmCopy {
  title: string;
  body: string;
  action: string;
  consequence?: string | null;
}

/** Pushes confirm before acting, naming the game and the public effect (4.5). */
function ConfirmButton({
  copy,
  onConfirm,
  pending,
  testId,
  label,
  destructive = false,
}: {
  copy: ConfirmCopy;
  onConfirm: () => void;
  pending: boolean;
  testId: string;
  label: string;
  destructive?: boolean;
}): React.JSX.Element {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          loading={pending}
          data-testid={testId}
        >
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent data-testid={`${testId}-confirm`}>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.body}</AlertDialogDescription>
        </AlertDialogHeader>
        {copy.consequence != null ? (
          <p
            className="rounded-r-md border-l-[3px] border-warning bg-warning-container/40 px-3 py-2 text-sm text-on-warning-container"
            data-testid={`${testId}-consequence`}
          >
            {copy.consequence}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant={destructive ? "destructive" : "default"}
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

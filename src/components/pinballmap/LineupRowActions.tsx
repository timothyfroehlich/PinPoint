"use client";

import type React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";

import {
  addMachineToPinballMapAction,
  removeMachineFromPinballMapAction,
  updateInsiderConnectedAction,
} from "~/app/(app)/m/pinballmap-actions";
import { Button } from "~/components/ui/button";
import { RemoveEntryButton } from "~/components/machines/PinballmapAbandonedEntries";
import { ConfirmButton } from "~/components/machines/PinballmapListingControl";
import type {
  LineupCabinet,
  LineupRow,
} from "~/lib/pinballmap/lineup-comparison";
import { pinballmapLocationUrl } from "~/lib/pinballmap/public-url";
import type { Result } from "~/lib/result";

/** What the viewer may do, decided on the server (lineup spec §8.2). */
export interface LineupActionContext {
  /**
   * Machines the viewer holds `machines.pinballmap.push` for. Push is
   * owner-scoped for members, so each row acts through a cabinet the viewer
   * may push for, and the server action re-checks it (CORE-ARCH-008).
   */
  pushableMachineIds: readonly string[];
  /**
   * The viewer holds push without an ownership condition — the only tier that
   * could act on an entry no PinPoint machine owns. Gates the no-action
   * guidance on unmatched entries.
   */
  canPushUnowned: boolean;
  /** The viewer may add machines to PinPoint (`machines.create`). */
  canCreateMachine: boolean;
  /**
   * An operator credential is provisioned. Without one no outbound write can
   * run, so rows link to Pinball Map instead (pinballmap §4.4).
   */
  writeEnabled: boolean;
  /** The tracked location's Pinball Map page. */
  locationUrl: string;
}

type RowAction = (
  prev: undefined,
  formData: FormData
) => Promise<Result<unknown, string>>;

const linkClass =
  "text-sm text-primary underline underline-offset-2 hover:no-underline";

/**
 * The actions that resolve one row (lineup spec §5.8). Outbound pushes reuse
 * the listing control's server actions and confirmations unchanged — same
 * capability and credential gates, same comment-count removal confirmation
 * (pinballmap §4.5, §4.6) — and one row is always one entry (§5.9). Intent and
 * match changes link to the machine's Manage tab, where those controls live.
 */
export function LineupRowActions({
  row,
  context,
}: {
  row: LineupRow;
  context: LineupActionContext;
}): React.JSX.Element | null {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  /** Runs outside a form, as the listing control does: the trigger lives in a
   *  dialog that unmounts on confirm. */
  function run(
    action: RowAction,
    machineId: string,
    fields?: Record<string, string>
  ): void {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("machineId", machineId);
      for (const [k, v] of Object.entries(fields ?? {})) formData.set(k, v);
      const result = await action(undefined, formData);
      if (!result.ok) setError(result.message);
    });
  }

  const pushable = new Set(context.pushableMachineIds);
  /** The cabinet a push acts through: the viewer must hold push for it, and it
   *  must be one whose own listing control offers the same push. */
  const actor = (intent: LineupCabinet["intent"]): LineupCabinet | undefined =>
    row.cabinets.find((c) => pushable.has(c.id) && c.intent === intent);
  const game = row.title.name;

  const externalLink = (
    label: string,
    href = context.locationUrl
  ): React.JSX.Element => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={linkClass}
    >
      {label}
    </a>
  );
  const manageLink = (
    cabinet: LineupCabinet | undefined
  ): React.JSX.Element | null =>
    cabinet === undefined ? null : (
      <Button asChild variant="outline" size="sm">
        <Link href={`/m/${cabinet.initials}/edit`}>
          Open {cabinet.initials}
        </Link>
      </Button>
    );

  let content: React.ReactNode = null;
  switch (row.reason) {
    case "missing": {
      const by = actor("on");
      content =
        by === undefined ? (
          manageLink(row.cabinets.find((c) => c.intent === "on"))
        ) : context.writeEnabled ? (
          <ConfirmButton
            testId={`pbm-lineup-add-${String(row.title.id)}`}
            pending={pending}
            label="Add machine to Pinball Map"
            onConfirm={() => {
              run(addMachineToPinballMapAction, by.id);
            }}
            copy={{
              title: "Add to Pinball Map?",
              body: `Adds ${game} to the location's lineup on pinballmap.com${
                row.icTarget === "on"
                  ? " and marks it Insider Connected"
                  : row.icTarget === "off"
                    ? " with Insider Connected off"
                    : ""
              }, where it will be publicly visible.`,
              action: "Add machine",
            }}
          />
        ) : (
          externalLink("Add it on Pinball Map")
        );
      break;
    }
    case "lingering": {
      const by = actor("off");
      content =
        by === undefined ? (
          manageLink(row.cabinets.find((c) => c.intent === "off"))
        ) : context.writeEnabled ? (
          <ConfirmButton
            testId={`pbm-lineup-remove-${String(row.title.id)}`}
            pending={pending}
            destructive
            removalMachineId={by.id}
            label="Remove machine from Pinball Map"
            onConfirm={() => {
              run(removeMachineFromPinballMapAction, by.id);
            }}
            copy={{
              title: "Remove from Pinball Map?",
              body: `Removes ${game} from the location's lineup on pinballmap.com. It will no longer be publicly visible.`,
              action: "Remove machine",
            }}
          />
        ) : (
          externalLink("Remove it on Pinball Map")
        );
      break;
    }
    case "left_behind":
    case "previous_location": {
      const by = row.abandonedBy;
      const entryUrl = pinballmapLocationUrl(row.locationId);
      content = !pushable.has(by.id) ? null : context.writeEnabled ? (
        <RemoveEntryButton
          machineId={by.id}
          entry={{
            lmxId: row.lmxId,
            locationUrl: entryUrl,
            title: row.title.name,
            currentLocation: row.reason === "left_behind",
            commentCount: row.commentCount,
          }}
          pending={pending}
          onConfirm={() => {
            run(removeMachineFromPinballMapAction, by.id, {
              lmxId: String(row.lmxId),
            });
          }}
        />
      ) : (
        externalLink("Remove it on Pinball Map", entryUrl)
      );
      break;
    }
    case "ic_differs": {
      const by = actor("on") ?? actor("off");
      content =
        by === undefined ? (
          manageLink(row.cabinets.find((c) => c.intent === "on"))
        ) : context.writeEnabled ? (
          <ConfirmButton
            testId={`pbm-lineup-update-${String(row.title.id)}`}
            pending={pending}
            label="Update Pinball Map"
            onConfirm={() => {
              run(updateInsiderConnectedAction, by.id);
            }}
            copy={{
              title: "Update Pinball Map?",
              body: `Sets Insider Connected to ${row.icTarget === "off" ? "Off" : "On"} for ${game} on pinballmap.com, where it is publicly visible.`,
              action: "Update",
            }}
          />
        ) : (
          externalLink("Set on Pinball Map")
        );
      break;
    }
    case "alert":
      // Intent and availability both live on the Manage tab; which one is
      // wrong is exactly what PinPoint cannot tell (§5.5).
      content = manageLink(
        row.cabinets.find((c) => c.advisory === "alert") ?? row.cabinets[0]
      );
      break;
    case "flag":
      content = manageLink(
        row.cabinets.find((c) => c.advisory === "flag") ?? row.cabinets[0]
      );
      break;
    case "edition_near_miss":
      // Re-matching is a match change (pinballmap §2.3), made on the machine.
      // Nothing removes an entry no machine left behind, so its removal is
      // guidance only.
      content = (
        <>
          {context.canPushUnowned
            ? externalLink("Remove it on Pinball Map")
            : null}
          {manageLink(row.cabinets.find((c) => c.intent === "on"))}
        </>
      );
      break;
    case "unmatched_entry":
      content = (
        <>
          {context.canPushUnowned
            ? externalLink("Remove it on Pinball Map")
            : null}
          {context.canCreateMachine ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/m/new">Add machine to PinPoint</Link>
            </Button>
          ) : null}
        </>
      );
      break;
  }

  if (content === null && error === null) return null;
  return (
    <div className="flex flex-col items-start gap-1 @3xl:items-end">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {content}
      </div>
      {error !== null ? (
        <p
          className="text-xs text-destructive-text"
          role="alert"
          data-testid="pbm-lineup-row-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

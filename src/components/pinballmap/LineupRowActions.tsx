"use client";

import type React from "react";
import { createContext, useContext, useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import {
  addMachineToPinballMapAction,
  linkMachineToPinballmapEntryAction,
  removeMachineFromPinballMapAction,
  removeUnlinkedPinballmapEntryAction,
  updateInsiderConnectedAction,
} from "~/app/(app)/m/pinballmap-actions";
import {
  MachinePickerList,
  type MachineOption,
} from "~/components/machines/MachineCombobox";
import { ConfirmButton } from "~/components/machines/PinballmapListingControl";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import type { PbmIcIntent } from "~/lib/pinballmap/insider-connected";
import type { LineupOutOfSyncTag } from "~/lib/pinballmap/lineup-comparison";
import type { Result } from "~/lib/result";
import { cn } from "~/lib/utils";

import {
  LINEUP_ACTION_SLOTS,
  LINEUP_REMOVE_BUTTON,
  LINEUP_SLOT_BUTTON,
} from "./lineup-styles";

/**
 * The lineup page's row actions (lineup spec §5.2–§5.8). Every outbound push
 * reuses the listing control's server actions and confirmations, so the gates,
 * the confirm copy and the removal comment check are the machine page's own
 * (§5.7). One row is always one entry; nothing acts on several (§5.8).
 */

type RowAction = (
  prev: undefined,
  formData: FormData
) => Promise<Result<unknown, string>>;

/**
 * Runs an action outside a form, as the listing control does: the trigger lives
 * in a dialog that unmounts on confirm. A failure is shown on the row — on
 * success the page revalidates and the row moves, so a silent failure would
 * look the same as nothing happening (CORE-ARCH-012).
 */
function useRowAction(): {
  pending: boolean;
  error: string | null;
  run: (
    action: RowAction,
    fields: Record<string, string>,
    onOk?: () => void
  ) => void;
} {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(
    action: RowAction,
    fields: Record<string, string>,
    onOk?: () => void
  ): void {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      for (const [k, v] of Object.entries(fields)) formData.set(k, v);
      const result = await action(undefined, formData);
      if (result.ok) onOk?.();
      else setError(result.message);
    });
  }
  return { pending, error, run };
}

/** The action slots, with a failure message under them. */
function Slots({
  error,
  children,
}: {
  error: string | null;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className={LINEUP_ACTION_SLOTS}>{children}</div>
      {error !== null ? (
        <div
          className="max-w-[536px] text-right text-xs text-destructive-text"
          role="alert"
          data-testid="pbm-lineup-row-error"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The no-credential guidance (pinballmap §4.4): the row's tag already names the
 * change, so the slot links straight to the location's Pinball Map page.
 */
function PinballMapLink({
  locationUrl,
  label,
}: {
  locationUrl: string;
  label: string;
}): React.JSX.Element {
  return (
    <Button asChild variant="outline" size="sm" className={LINEUP_SLOT_BUTTON}>
      <a
        href={locationUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
      >
        Open Pinball Map
        <ExternalLink className="size-3" aria-hidden="true" />
      </a>
    </Button>
  );
}

const PUSH_LABEL: Record<LineupOutOfSyncTag, string> = {
  to_add: "Add to Pinball Map",
  to_remove: "Remove from Pinball Map",
  to_update: "Update Pinball Map",
};

/** What Add also does to Insider Connected, for its confirm (pinballmap 4.5). */
function icAddClause(target: PbmIcIntent | null): string {
  if (target === "on") return " and marks it Insider Connected";
  if (target === "off") return " with Insider Connected off";
  return "";
}

/**
 * The one push an Out of sync row's tag names (§5.2), acting through a cabinet
 * the viewer may push for. `machineId` is null when the viewer may push for
 * none of the title's cabinets: a read-only viewer sees no push (pinballmap
 * 4.9).
 */
export function LineupPushAction({
  tag,
  machineId,
  game,
  icTarget,
  writeEnabled,
  locationUrl,
}: {
  tag: LineupOutOfSyncTag;
  machineId: string | null;
  game: string;
  icTarget: PbmIcIntent | null;
  writeEnabled: boolean;
  locationUrl: string;
}): React.JSX.Element | null {
  const { pending, error, run } = useRowAction();
  if (machineId === null) return null;
  if (!writeEnabled)
    return (
      <Slots error={null}>
        <PinballMapLink
          locationUrl={locationUrl}
          label={`${PUSH_LABEL[tag]}: ${game}, on pinballmap.com`}
        />
      </Slots>
    );

  const button =
    tag === "to_add" ? (
      <ConfirmButton
        testId="pbm-lineup-add"
        pending={pending}
        triggerVariant="default"
        triggerClassName={LINEUP_SLOT_BUTTON}
        label={PUSH_LABEL.to_add}
        onConfirm={() => {
          run(addMachineToPinballMapAction, { machineId });
        }}
        copy={{
          title: "Add to Pinball Map?",
          body: `Adds ${game} to the location's lineup on pinballmap.com${icAddClause(icTarget)}, where it will be publicly visible.`,
          action: "Add",
        }}
      />
    ) : tag === "to_update" ? (
      <ConfirmButton
        testId="pbm-lineup-update"
        pending={pending}
        triggerVariant="default"
        triggerClassName={LINEUP_SLOT_BUTTON}
        label={PUSH_LABEL.to_update}
        onConfirm={() => {
          run(updateInsiderConnectedAction, { machineId });
        }}
        copy={{
          title: "Update Pinball Map?",
          body: `Sets Insider Connected to ${icTarget === "off" ? "Off" : "On"} for ${game} on pinballmap.com, where it is publicly visible.`,
          action: "Update",
        }}
      />
    ) : (
      <ConfirmButton
        testId="pbm-lineup-remove"
        pending={pending}
        destructive
        triggerClassName={cn(LINEUP_SLOT_BUTTON, LINEUP_REMOVE_BUTTON)}
        removalCheck={{ machineId }}
        label={PUSH_LABEL.to_remove}
        onConfirm={() => {
          run(removeMachineFromPinballMapAction, { machineId });
        }}
        copy={{
          title: "Remove from Pinball Map?",
          body: `Removes ${game} from the location's lineup on pinballmap.com. It will no longer be publicly visible.`,
          action: "Remove",
        }}
      />
    );

  return <Slots error={error}>{button}</Slots>;
}

/** A machine the viewer may link, as the Link picker lists it. */
export interface LineupLinkOption {
  id: string;
  initials: string;
  name: string;
  /** The title it is linked to now, for the re-match warning (pinballmap 2.3). */
  linkedTitle: string | null;
}

const LinkOptionsContext = createContext<readonly LineupLinkOption[]>([]);

/**
 * Hands the Link picker's machine list to every row once, rather than
 * serializing the whole fleet into each of up to a hundred rows.
 */
export function LineupLinkOptionsProvider({
  options,
  children,
}: {
  options: readonly LineupLinkOption[];
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <LinkOptionsContext.Provider value={options}>
      {children}
    </LinkOptionsContext.Provider>
  );
}

/**
 * The three actions every On Pinball Map, not linked row offers (§5.4):
 * Remove from Pinball Map, Create in PinPoint, and Link — right-aligned, so
 * Link keeps its slot when a viewer lacks the others.
 */
export function LineupEntryActions({
  lmxId,
  titleId,
  game,
  possibleMatchIds,
  canRemove,
  canLink,
  createHref,
  writeEnabled,
  locationUrl,
}: {
  lmxId: number;
  titleId: number;
  game: string;
  possibleMatchIds: readonly string[];
  /** The viewer holds the push gate for this entry (pinballmap §8.2). */
  canRemove: boolean;
  /** The viewer may link at least one machine (pinballmap §8.1). */
  canLink: boolean;
  /** The new-machine page with the title prefilled, or null without access. */
  createHref: string | null;
  writeEnabled: boolean;
  locationUrl: string;
}): React.JSX.Element {
  const { pending, error, run } = useRowAction();

  return (
    <Slots error={error}>
      {canRemove ? (
        writeEnabled ? (
          <ConfirmButton
            testId={`pbm-lineup-remove-entry-${String(lmxId)}`}
            pending={pending}
            destructive
            triggerClassName={cn(LINEUP_SLOT_BUTTON, LINEUP_REMOVE_BUTTON)}
            removalCheck={{ lmxId: String(lmxId) }}
            label="Remove from Pinball Map"
            onConfirm={() => {
              run(removeUnlinkedPinballmapEntryAction, {
                lmxId: String(lmxId),
              });
            }}
            copy={{
              title: "Remove from Pinball Map?",
              body: `Removes ${game} from the location's lineup on pinballmap.com. It will no longer be publicly visible.`,
              action: "Remove",
            }}
          />
        ) : (
          <PinballMapLink
            locationUrl={locationUrl}
            label={`Remove ${game} on pinballmap.com`}
          />
        )
      ) : null}
      {createHref !== null ? (
        <Button
          asChild
          variant="outline"
          size="sm"
          className={LINEUP_SLOT_BUTTON}
        >
          <Link href={createHref}>Create in PinPoint</Link>
        </Button>
      ) : null}
      {canLink ? (
        <LinkEntryDialog
          titleId={titleId}
          game={game}
          possibleMatchIds={possibleMatchIds}
        />
      ) : null}
    </Slots>
  );
}

/**
 * Link: a person picks the PinPoint machine this entry is (§5.4, pinballmap
 * §2.2). Possible matches lead the list; nothing is preselected.
 */
function LinkEntryDialog({
  titleId,
  game,
  possibleMatchIds,
}: {
  titleId: number;
  game: string;
  possibleMatchIds: readonly string[];
}): React.JSX.Element {
  const options = useContext(LinkOptionsContext);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const { pending, error, run } = useRowAction();

  const possible = new Set(possibleMatchIds);
  const ordered = [
    ...options.filter((o) => possible.has(o.id)),
    ...options.filter((o) => !possible.has(o.id)),
  ];
  const pickerOptions: MachineOption[] = ordered.map((o) => ({
    value: o.id,
    name: o.name,
    initials: o.initials,
  }));
  const chosen = options.find((o) => o.id === selected) ?? null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSelected(null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={LINEUP_SLOT_BUTTON}
          data-testid={`pbm-lineup-link-${String(titleId)}`}
        >
          Link
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="pbm-lineup-link-dialog">
        <DialogHeader>
          <DialogTitle>Link to a PinPoint machine</DialogTitle>
          <DialogDescription>
            Choose the machine that is {game} on Pinball Map.
          </DialogDescription>
        </DialogHeader>
        <MachinePickerList
          machines={pickerOptions}
          selectedValue={selected}
          onSelect={setSelected}
          className="rounded-md border border-border"
          commandTestId="pbm-lineup-link-picker"
        />
        {chosen?.linkedTitle != null ? (
          <div className="text-sm text-on-warning-container">
            {chosen.initials} is linked to {chosen.linkedTitle}. Linking it here
            sets it Off the lineup; the {chosen.linkedTitle} entry stays on
            Pinball Map until removed.
          </div>
        ) : null}
        {error !== null ? (
          <div className="text-sm text-destructive-text" role="alert">
            {error}
          </div>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              setOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={chosen === null}
            loading={pending}
            onClick={() => {
              if (chosen === null) return;
              run(
                linkMachineToPinballmapEntryAction,
                {
                  machineId: chosen.id,
                  pinballmapMachineId: String(titleId),
                },
                () => {
                  setOpen(false);
                }
              );
            }}
          >
            Link {chosen?.initials ?? ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import type React from "react";
import Link from "next/link";
import { Check } from "lucide-react";

import { Button, buttonVariants } from "~/components/ui/button";
import {
  LINEUP_TONE,
  LineupTag,
  type LineupTone,
} from "~/components/pinballmap/LineupTag";
import { getMachinePresenceLabel } from "~/lib/machines/presence";
import type {
  LineupCabinet,
  LineupConflictTag,
  LineupOutOfSyncRow,
  LineupOutOfSyncTag,
  LineupPinballMapOnlyRow,
  LineupPossibleMatch,
  LineupReady,
  LineupSectionKey,
} from "~/lib/pinballmap/lineup-comparison";
import { LINEUP_SECTIONS } from "~/lib/pinballmap/lineup-comparison";
import type { PbmListingIntent } from "~/lib/pinballmap/listing-state";
import { cn } from "~/lib/utils";

import { LineupEntryActions, LineupPushAction } from "./LineupRowActions";
import {
  LINEUP_ACTION_SLOTS,
  LINEUP_ROW_GRID,
  LINEUP_SLOT_BUTTON,
} from "./lineup-styles";

/**
 * The lineup page body below the header (lineup spec §4–§6): the "to review"
 * summary, the four sections in fixed order with empty ones hidden, the
 * collapsed In sync card, and the not-compared footer. When nothing needs
 * review, a single "Nothing to review" card replaces the summary and sections
 * (§4.2).
 *
 * A server component: only the row actions are client islands.
 */

/** What the viewer may do, decided on the server (lineup spec §8.2). */
export interface LineupViewContext {
  /** An operator credential exists; without one, pushes link out (§4.4). */
  writeEnabled: boolean;
  locationUrl: string;
  /** The cabinet an Out of sync row's push acts through, or null. */
  pushActor: (row: LineupOutOfSyncRow) => string | null;
  /** The viewer holds the push gate for this unlinked entry. */
  canRemoveEntry: (row: LineupPinballMapOnlyRow) => boolean;
  /** The viewer may link at least one machine. */
  canLink: boolean;
  /** The viewer may create machines. */
  canCreate: boolean;
}

const SECTION: Record<
  LineupSectionKey,
  { name: string; desc: string; glyph: string; tone: LineupTone; badge: string }
> = {
  out_of_sync: {
    name: "Out of sync",
    desc: "Set On or Off the lineup, and Pinball Map disagrees.",
    glyph: "≠",
    tone: "destructive",
    badge: "out of sync",
  },
  pinpoint_only: {
    name: "In PinPoint, not linked to Pinball Map",
    desc: "No Pinball Map title, not a custom game, not set to Don't sync.",
    glyph: "P",
    tone: "secondary",
    badge: "in PinPoint only",
  },
  pinball_map_only: {
    name: "On Pinball Map, not linked to a PinPoint machine",
    desc: "No PinPoint machine is linked to this entry.",
    glyph: "M",
    tone: "secondary",
    badge: "on Pinball Map only",
  },
  availability_conflict: {
    name: "Availability conflict",
    desc: "A machine set On the lineup that isn't on the floor.",
    glyph: "!",
    tone: "warning",
    badge: "availability conflict",
  },
};

const OUT_OF_SYNC_TAG: Record<
  LineupOutOfSyncTag,
  { label: string; tone: LineupTone; reason: string }
> = {
  to_add: { label: "To add", tone: "success", reason: "Not on Pinball Map" },
  to_remove: {
    label: "To remove",
    tone: "destructive",
    reason: "Still on Pinball Map",
  },
  to_update: {
    label: "To update",
    tone: "warning",
    reason: "Insider Connected differs",
  },
};

const CONFLICT_TAG: Record<
  LineupConflictTag,
  { label: string; tone: LineupTone }
> = {
  alert: { label: "Alert", tone: "destructive" },
  note: { label: "Note", tone: "note" },
};

/** The listing control's own words for intent (§7.2). */
const INTENT_LABEL: Record<PbmListingIntent, string> = {
  on: "On the lineup",
  off: "Off the lineup",
  no_sync: "Don't sync",
};

function plural(n: number, one: string, many: string): string {
  return `${String(n)} ${n === 1 ? one : many}`;
}

function comments(count: number | null, absent: string): string {
  if (count === null) return absent;
  if (count === 0) return "No comments";
  return plural(count, "comment", "comments");
}

function Glyph({
  children,
  tone,
  className,
}: {
  children: React.ReactNode;
  tone: LineupTone;
  className?: string;
}): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md border text-base font-extrabold",
        LINEUP_TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

function MachineInitials({
  initials,
}: {
  initials: string;
}): React.JSX.Element {
  return (
    <Link
      href={`/m/${initials}`}
      className="font-medium text-foreground/90 hover:underline"
    >
      {initials}
    </Link>
  );
}

/** One line per cabinet: initials · intent · availability (§5.6). */
function CabinetLines({
  cabinets,
  showIntent = true,
  showPresence = true,
}: {
  cabinets: readonly LineupCabinet[];
  showIntent?: boolean;
  showPresence?: boolean;
}): React.JSX.Element {
  return (
    <>
      {cabinets.map((c) => (
        <span key={c.id} className="block">
          <MachineInitials initials={c.initials} />
          {showIntent ? ` · ${INTENT_LABEL[c.intent]}` : null}
          {showPresence
            ? ` · ${getMachinePresenceLabel(c.presenceStatus)}`
            : null}
        </span>
      ))}
    </>
  );
}

function RowShell({
  heading,
  sub,
  reason,
  facts,
  actions,
  testId,
}: {
  heading: string;
  sub: React.ReactNode;
  reason: React.ReactNode;
  facts: string;
  actions: React.ReactNode;
  testId?: string;
}): React.JSX.Element {
  return (
    <li className={LINEUP_ROW_GRID} data-testid={testId}>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{heading}</div>
        <div className="mt-0.5 text-xs leading-snug text-muted-foreground">
          {sub}
        </div>
      </div>
      <div className="flex min-w-0 items-center text-sm">{reason}</div>
      <div className="text-xs text-muted-foreground">{facts}</div>
      <div className="min-w-0">{actions}</div>
    </li>
  );
}

function EditSlot({ initials }: { initials: string }): React.JSX.Element {
  return (
    <div className="flex justify-end">
      <div className={LINEUP_ACTION_SLOTS}>
        <Button
          asChild
          variant="outline"
          size="sm"
          className={LINEUP_SLOT_BUTTON}
        >
          <Link href={`/m/${initials}/edit`}>Edit Machine</Link>
        </Button>
      </div>
    </div>
  );
}

function possibleMatchText(
  matches: readonly LineupPossibleMatch[]
): string | null {
  if (matches.length === 0) return null;
  const names = matches
    .map((m) =>
      m.edition === null ? m.initials : `${m.initials} (${m.edition})`
    )
    .join(", ");
  return `${matches.length === 1 ? "Possible match" : "Possible matches"}: ${names}`;
}

function SectionRows({
  sectionKey,
  comparison,
  context,
}: {
  sectionKey: LineupSectionKey;
  comparison: LineupReady;
  context: LineupViewContext;
}): React.JSX.Element {
  const { sections } = comparison;
  switch (sectionKey) {
    case "out_of_sync":
      return (
        <>
          {sections.out_of_sync.map((row) => {
            const tag = OUT_OF_SYNC_TAG[row.tag];
            return (
              <RowShell
                key={row.key}
                testId={`pbm-lineup-row-${row.key}`}
                heading={row.title.name}
                sub={<CabinetLines cabinets={row.cabinets} />}
                reason={
                  <>
                    <LineupTag label={tag.label} tone={tag.tone} />
                    <span>{tag.reason}</span>
                  </>
                }
                facts={comments(row.commentCount, "—")}
                actions={
                  <LineupPushAction
                    tag={row.tag}
                    machineId={context.pushActor(row)}
                    game={row.title.name}
                    icTarget={row.icTarget}
                    writeEnabled={context.writeEnabled}
                    locationUrl={context.locationUrl}
                  />
                }
              />
            );
          })}
        </>
      );
    case "pinpoint_only":
      return (
        <>
          {sections.pinpoint_only.map((row) => (
            <RowShell
              key={row.key}
              testId={`pbm-lineup-row-${row.key}`}
              heading={row.machine.name}
              sub={<CabinetLines cabinets={[row.machine]} showIntent={false} />}
              reason={null}
              facts=""
              actions={<EditSlot initials={row.machine.initials} />}
            />
          ))}
        </>
      );
    case "pinball_map_only":
      return (
        <>
          {sections.pinball_map_only.map((row) => (
            <RowShell
              key={row.key}
              testId={`pbm-lineup-row-${row.key}`}
              heading={row.title.name}
              sub={
                [row.title.manufacturer, row.title.year]
                  .filter((part) => part !== null)
                  .join(" · ") || " "
              }
              reason={possibleMatchText(row.possibleMatches)}
              facts={comments(row.commentCount, "")}
              actions={
                <LineupEntryActions
                  lmxId={row.lmxId}
                  titleId={row.title.id}
                  game={row.title.name}
                  possibleMatchIds={row.possibleMatches.map((m) => m.id)}
                  canRemove={context.canRemoveEntry(row)}
                  canLink={context.canLink}
                  createHref={
                    context.canCreate
                      ? `/m/new?${new URLSearchParams({ title: row.title.name, pbm: String(row.title.id) }).toString()}`
                      : null
                  }
                  writeEnabled={context.writeEnabled}
                  locationUrl={context.locationUrl}
                />
              }
            />
          ))}
        </>
      );
    case "availability_conflict":
      return (
        <>
          {sections.availability_conflict.map((row) => {
            const tag = CONFLICT_TAG[row.tag];
            return (
              <RowShell
                key={row.key}
                testId={`pbm-lineup-row-${row.key}`}
                heading={row.title.name}
                sub={
                  <CabinetLines cabinets={[row.machine]} showPresence={false} />
                }
                reason={
                  <>
                    <LineupTag label={tag.label} tone={tag.tone} />
                    <span>
                      {getMachinePresenceLabel(row.machine.presenceStatus)}
                    </span>
                  </>
                }
                facts={comments(row.commentCount, "")}
                actions={<EditSlot initials={row.machine.initials} />}
              />
            );
          })}
        </>
      );
  }
}

export function LineupSections({
  comparison,
  context,
}: {
  comparison: LineupReady;
  context: LineupViewContext;
}): React.JSX.Element {
  const shown = LINEUP_SECTIONS.filter(
    (key) => comparison.sections[key].length > 0
  );
  const inSyncOn = comparison.inSync.filter((t) => t.onPinballMap).length;
  const inSyncOff = comparison.inSync.length - inSyncOn;
  const { notCompared, insiderConnected: ic } = comparison;

  return (
    <>
      {comparison.toReview === 0 ? (
        <div
          className="flex items-center gap-3.5 rounded-xl border border-success-container bg-success-container/20 px-5 py-5"
          data-testid="pbm-lineup-clear"
        >
          <Glyph tone="success" className="size-9 text-xl">
            <Check className="size-5" strokeWidth={3} />
          </Glyph>
          <div>
            <div className="text-lg font-bold">Nothing to review</div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              PinPoint and Pinball Map agree on all{" "}
              {plural(comparison.inSync.length, "title", "titles")}.
            </div>
          </div>
        </div>
      ) : (
        <div
          className="flex items-baseline gap-3.5"
          data-testid="pbm-lineup-summary"
        >
          <h2 className="text-xl font-bold tracking-normal">
            {comparison.toReview} to review
          </h2>
          {shown.map((key) => (
            <span
              key={key}
              className={cn(
                "inline-flex h-[22px] items-center rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap",
                LINEUP_TONE[SECTION[key].tone]
              )}
            >
              {comparison.sections[key].length}{" "}
              {key === "availability_conflict" &&
              comparison.sections[key].length !== 1
                ? "availability conflicts"
                : SECTION[key].badge}
            </span>
          ))}
          <span className="ml-auto text-sm text-muted-foreground">
            Comparing machines not marked Removed
          </span>
        </div>
      )}

      {shown.map((key) => {
        const section = SECTION[key];
        const headingId = `pbm-lineup-section-${key}`;
        return (
          <section
            key={key}
            aria-labelledby={headingId}
            className="rounded-xl border border-border bg-card"
            data-testid={headingId}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <Glyph tone={section.tone}>{section.glyph}</Glyph>
              <h3
                id={headingId}
                className="text-base font-bold tracking-normal"
              >
                {section.name}
              </h3>
              <span className="text-[15px] font-semibold tabular-nums text-muted-foreground">
                {comparison.sections[key].length}
              </span>
              <span className="text-sm text-muted-foreground">
                {section.desc}
              </span>
            </div>
            <ul>
              <SectionRows
                sectionKey={key}
                comparison={comparison}
                context={context}
              />
            </ul>
          </section>
        );
      })}

      <details
        className="group rounded-xl border border-border bg-card"
        data-testid="pbm-lineup-in-sync"
      >
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <Glyph tone="success">
            <Check className="size-4" strokeWidth={3} />
          </Glyph>
          <h3 className="text-base font-bold tracking-normal">In sync</h3>
          <span className="text-[15px] font-semibold tabular-nums text-muted-foreground">
            {comparison.inSync.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {inSyncOn} on Pinball Map · {inSyncOff} not on Pinball Map
          </span>
          {comparison.inSync.length > 0 ? (
            <span
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "ml-auto h-7 px-2.5 text-xs"
              )}
            >
              <span className="group-open:hidden">Show in-sync titles</span>
              <span className="hidden group-open:inline">
                Hide in-sync titles
              </span>
            </span>
          ) : null}
        </summary>
        <ul>
          {comparison.inSync.map((row) => (
            <RowShell
              key={row.key}
              heading={row.title.name}
              sub={<CabinetLines cabinets={row.cabinets} />}
              reason={
                <span className="text-muted-foreground">
                  {row.onPinballMap ? "On Pinball Map" : "Not on Pinball Map"}
                </span>
              }
              facts={comments(row.commentCount, "")}
              actions={null}
            />
          ))}
        </ul>
      </details>

      <div
        className="px-1 text-sm leading-relaxed text-muted-foreground"
        data-testid="pbm-lineup-not-compared"
      >
        <div>
          Not compared:{" "}
          {plural(
            notCompared.uncataloged.length,
            "custom game",
            "custom games"
          )}
          {notCompared.uncataloged.length > 0
            ? ` (${notCompared.uncataloged.map((m) => m.initials).join(", ")})`
            : null}
          {" · "}
          {notCompared.dontSync} set to Don&apos;t sync
          {" · "}
          {plural(notCompared.removed, "removed machine", "removed machines")}
        </div>
        {ic.titles > 0 ? (
          <div>
            Insider Connected:{" "}
            {plural(ic.titles, "eligible title has", "eligible titles have")} no
            PinPoint setting, so nothing is compared. Pinball Map shows{" "}
            {ic.onPinballMap.on} On, {ic.onPinballMap.off} Off,{" "}
            {ic.onPinballMap.not_set} Not set.
          </div>
        ) : null}
      </div>
    </>
  );
}

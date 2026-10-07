import type React from "react";

import {
  SHEET_BLANK_ROWS,
  type SettingsSheet,
  type SheetCoverage,
  type SheetDirection,
  type SheetMachine,
  type SheetNote,
  type SheetRow,
  type SheetSetRef,
  type SheetValue,
} from "~/lib/machines/settings-sheet";
import { cn } from "~/lib/utils";
import "./settings-sheet.css";

export const SHEET_DIRECTION_LABELS: Record<SheetDirection, string> = {
  setup: "Set up",
  restore: "Restore",
  both: "Set up and restore",
};

export const SHEET_COVERAGE_LABELS: Record<SheetCoverage, string> = {
  differences: "Differences only",
  full: "Full sets",
};

// Fixed to the venue's zone so the server render and the browser agree, and
// "printed" and "edited" dates read on the same calendar.
const VENUE_TIME_ZONE = "America/Chicago";
const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: VENUE_TIME_ZONE,
});
const MEDIUM_DATE = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: VENUE_TIME_ZONE,
});

/** How the sheet names each side: the default's short name, e.g. "House". */
export interface SheetLabels {
  /** The defaults in full, for the header, e.g. "Preferred House". */
  fromDefault: string;
  toDefault: string;
  /** Column and step names, e.g. "House" and "Tournament". */
  from: string;
  to: string;
}

function valueText(value: SheetValue): string {
  switch (value.kind) {
    case "value":
      return value.text;
    case "install":
      return `Install (${value.install})`;
    case "not-recorded":
      return "Not recorded";
  }
}

function Value({ value }: { value: SheetValue }): React.JSX.Element {
  return (
    <span
      className={
        value.kind === "value" ? undefined : "settings-sheet__value--derived"
      }
    >
      {valueText(value)}
    </span>
  );
}

function Box(): React.JSX.Element {
  return <span className="settings-sheet__box" aria-hidden="true" />;
}

/** Bold marks a difference only when matching rows print too (§3.9). */
function emphasis(differs: boolean, bold: boolean): string | undefined {
  return bold && differs ? "settings-sheet__differs" : undefined;
}

function CompareRows({
  rows,
  labels,
  bold,
}: {
  rows: SheetRow[];
  labels: SheetLabels;
  bold: boolean;
}): React.JSX.Element {
  return (
    <div className="settings-sheet__rows">
      <div className="settings-sheet__row settings-sheet__row--compare settings-sheet__row--head">
        <span />
        <span />
        <span>{labels.to}</span>
        <span>{labels.from}</span>
      </div>
      {rows.map((row, i) => (
        <div
          key={`${row.location}-${row.name}-${i}`}
          className={cn(
            "settings-sheet__row settings-sheet__row--compare",
            emphasis(row.differs, bold)
          )}
        >
          <span className="settings-sheet__loc">{row.location}</span>
          <span>{row.name}</span>
          <span className="settings-sheet__cell">
            <Box />
            <Value value={row.to} />
          </span>
          <span className="settings-sheet__cell">
            <Box />
            <Value value={row.from} />
          </span>
        </div>
      ))}
    </div>
  );
}

function StepRows({
  label,
  rows,
  side,
  bold,
}: {
  label: string | null;
  rows: SheetRow[];
  side: "from" | "to";
  bold: boolean;
}): React.JSX.Element | null {
  if (rows.length === 0 && label === null) return null;
  return (
    <div className="settings-sheet__rows">
      {label !== null && <div className="settings-sheet__step">{label}</div>}
      {rows.map((row, i) => (
        <div
          key={`${row.location}-${row.name}-${i}`}
          className={cn(
            "settings-sheet__row settings-sheet__row--step",
            emphasis(row.differs, bold)
          )}
        >
          <Box />
          <span className="settings-sheet__loc">{row.location}</span>
          <span>{row.name}</span>
          <span className="settings-sheet__set-to">
            <Value value={row[side]} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** The To set's rows with a blank for the machine's value before (§5.1). */
function RecordRows({ rows }: { rows: SheetRow[] }): React.JSX.Element | null {
  if (rows.length === 0) return null;
  return (
    <div className="settings-sheet__rows">
      <div className="settings-sheet__row settings-sheet__row--record settings-sheet__row--head">
        <span />
        <span />
        <span />
        <span>Set to</span>
        <span>Was</span>
      </div>
      {rows.map((row, i) => (
        <div
          key={`${row.location}-${row.name}-${i}`}
          className="settings-sheet__row settings-sheet__row--record"
        >
          <Box />
          <span className="settings-sheet__loc">{row.location}</span>
          <span>{row.name}</span>
          <span className="settings-sheet__set-to">
            <Value value={row.to} />
          </span>
          <span className="settings-sheet__write-in" />
        </div>
      ))}
    </div>
  );
}

/** Blank rows for any other setting the person changes (§5.1, §5.2). */
function BlankRows(): React.JSX.Element {
  return (
    <div className="settings-sheet__rows">
      <div className="settings-sheet__step">Other settings changed</div>
      <div className="settings-sheet__row settings-sheet__row--blank settings-sheet__row--head">
        <span>Location</span>
        <span>Setting</span>
        <span>Set to</span>
        <span>Was</span>
      </div>
      {Array.from({ length: SHEET_BLANK_ROWS }, (_, i) => (
        <div
          key={i}
          className="settings-sheet__row settings-sheet__row--blank settings-sheet__row--write-in"
        >
          <span className="settings-sheet__write-in" />
          <span className="settings-sheet__write-in" />
          <span className="settings-sheet__write-in" />
          <span className="settings-sheet__write-in" />
        </div>
      ))}
    </div>
  );
}

function noteText(
  note: SheetNote,
  direction: SheetDirection,
  labels: SheetLabels
): string | null {
  if (direction === "setup") return note.to;
  if (direction === "restore") return note.from;
  if (!note.differs) return note.to;
  return `\n${labels.to}: ${note.to ?? "Not recorded"}\n${labels.from}: ${note.from ?? "Not recorded"}`;
}

function Notes({
  notes,
  direction,
  labels,
  bold,
}: {
  notes: SheetNote[];
  direction: SheetDirection;
  labels: SheetLabels;
  bold: boolean;
}): React.JSX.Element {
  return (
    <>
      {notes.map((note) => {
        const text = noteText(note, direction, labels);
        if (text === null) return null;
        return (
          <div
            key={note.title}
            className={cn("settings-sheet__note", emphasis(note.differs, bold))}
          >
            <Box />
            <span>
              <b>{note.title}:</b> {text}
            </span>
          </div>
        );
      })}
    </>
  );
}

function setLine(label: string, set: SheetSetRef | null): string {
  return set === null
    ? `${label}: none`
    : `${label}: ${set.name} (${SHORT_DATE.format(new Date(set.updatedAt))})`;
}

function CompareBody({
  machine,
  direction,
  labels,
  bold,
}: {
  machine: SheetMachine;
  direction: SheetDirection;
  labels: SheetLabels;
  bold: boolean;
}): React.JSX.Element {
  const { reinstall, rows } = machine;
  const showSetup = direction !== "restore";
  const showRestore = direction !== "setup";
  const prefix = (setup: boolean): string =>
    direction === "both" ? `${setup ? "Set up" : "Restore"}: apply ` : "Apply ";
  return (
    <>
      {direction === "both" && rows.length > 0 && (
        <CompareRows rows={rows} labels={labels} bold={bold} />
      )}
      {direction === "setup" && (
        <StepRows label={null} rows={rows} side="to" bold={bold} />
      )}
      {direction === "restore" && (
        <StepRows label={null} rows={rows} side="from" bold={bold} />
      )}
      {reinstall !== null && showSetup && (
        <StepRows
          label={`${prefix(true)}${reinstall.toInstall}, then set`}
          rows={reinstall.toRows}
          side="to"
          bold={bold}
        />
      )}
      {reinstall !== null && showRestore && (
        <StepRows
          label={`${prefix(false)}${reinstall.fromInstall}, then set`}
          rows={reinstall.fromRows}
          side="from"
          bold={bold}
        />
      )}
    </>
  );
}

function MachineBlock({
  machine,
  direction,
  labels,
  bold,
}: {
  machine: SheetMachine;
  direction: SheetDirection;
  labels: SheetLabels;
  bold: boolean;
}): React.JSX.Element {
  return (
    <section className="settings-sheet__machine">
      <div className="settings-sheet__machine-head">
        <span className="settings-sheet__machine-name">{machine.name}</span>
        <span className="settings-sheet__initials">{machine.initials}</span>
        <span className="settings-sheet__done">
          Done
          <span className="settings-sheet__blank" />
        </span>
      </div>
      <div className="settings-sheet__meta">
        {setLine(labels.to, machine.toSet)} ·{" "}
        {setLine(labels.from, machine.fromSet)}
      </div>
      {machine.kind === "record" && (
        <div className="settings-sheet__warn">
          No {labels.from} set — record original values
        </div>
      )}
      {machine.kind === "blank" && (
        <div className="settings-sheet__warn">No {labels.to} set</div>
      )}

      {machine.kind === "compare" && (
        <CompareBody
          machine={machine}
          direction={direction}
          labels={labels}
          bold={bold}
        />
      )}
      {machine.kind === "record" && <RecordRows rows={machine.rows} />}
      <Notes
        notes={machine.notes}
        direction={machine.kind === "record" ? "setup" : direction}
        labels={labels}
        bold={bold}
      />
      {machine.kind !== "compare" && <BlankRows />}

      <div className="settings-sheet__notes-lines">
        <span className="settings-sheet__notes-label">Notes</span>
        <span className="settings-sheet__line" />
        <span className="settings-sheet__line" />
      </div>
    </section>
  );
}

function names(list: { name: string; initials: string }[]): string {
  return list.map((m) => `${m.name} (${m.initials})`).join(", ");
}

function instruction(
  direction: SheetDirection,
  coverage: SheetCoverage,
  labels: SheetLabels
): string {
  const base =
    direction === "setup"
      ? "Set each value, then tick its box."
      : direction === "restore"
        ? `Set each value back to ${labels.from}, then tick its box.`
        : `${labels.to} column to set up, ${labels.from} column to restore. Tick each box as you go.`;
  return coverage === "full"
    ? `${base} Every recorded setting is listed; differences are in bold.`
    : base;
}

export interface SettingsSheetDocumentProps {
  sheet: SettingsSheet;
  direction: SheetDirection;
  coverage: SheetCoverage;
  labels: SheetLabels;
  /** ISO timestamp of the render. */
  printedAt: string;
}

/**
 * The printed settings sheet (settings-sheets §3): a header, a summary of
 * machines needing nothing, then one block per machine in two columns that
 * never split a block across a column or page.
 */
export function SettingsSheetDocument({
  sheet,
  direction,
  coverage,
  labels,
  printedAt,
}: SettingsSheetDocumentProps): React.JSX.Element {
  const count = sheet.machines.length;
  const bold = coverage === "full";
  return (
    <article className="settings-sheet" aria-label="Settings sheet">
      <header className="settings-sheet__header">
        <div>
          <div className="settings-sheet__kicker">Settings sheet</div>
          <h2 className="settings-sheet__title">
            {labels.fromDefault} to {labels.toDefault}
          </h2>
        </div>
        <div className="settings-sheet__header-right">
          <div className="settings-sheet__direction">
            {SHEET_DIRECTION_LABELS[direction]}
          </div>
          <div className="settings-sheet__printed">
            {SHEET_COVERAGE_LABELS[coverage]} · Printed{" "}
            {MEDIUM_DATE.format(new Date(printedAt))}
          </div>
        </div>
      </header>
      <div className="settings-sheet__summary">
        <div className="settings-sheet__instruction">
          {instruction(direction, coverage, labels)}
        </div>
        <div className="settings-sheet__summary-items">
          <span>
            <b>
              {count} {count === 1 ? "machine" : "machines"}
            </b>
          </span>
          {sheet.unchanged.length > 0 && (
            <span>
              <b>No changes:</b> {names(sheet.unchanged)}
            </span>
          )}
        </div>
      </div>
      {count > 0 && (
        <div className="settings-sheet__columns">
          {sheet.machines.map((machine) => (
            <MachineBlock
              key={machine.id}
              machine={machine}
              direction={direction}
              labels={labels}
              bold={bold}
            />
          ))}
        </div>
      )}
    </article>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronLeft, Eye, Plus, Printer, X } from "lucide-react";

import { loadPrintRunMachinesAction } from "~/app/(app)/m/settings-sheets/actions";
import { PageHeader } from "~/components/layout/PageHeader";
import { MachineView } from "~/components/machines/view";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  SHEET_COVERAGE_LABELS,
  SHEET_DIRECTION_LABELS,
  SettingsSheetDocument,
} from "~/components/machines/settings/SettingsSheetDocument";
import {
  buildSettingsSheet,
  SHEET_COVERAGES,
  SHEET_DIRECTIONS,
  type SheetCoverage,
  type SheetDirection,
} from "~/lib/machines/settings-sheet";
import {
  DEFAULT_PRINT_RUN_OPTIONS,
  parseSheetDefault,
  printRunInputs,
  printRunRowStatus,
  printRunStatusPrints,
  resolveRowSide,
  serializePrintRunQuery,
  serializeSheetDefault,
  sheetLabels,
  type PrintRunMachine,
  type PrintRunOptions,
  type PrintRunRow,
  type PrintRunStatus,
  type SheetResolution,
  type SheetSide,
  type SheetTagOption,
} from "~/lib/machines/settings-sheet-run";
import type {
  MachineViewResult,
  MachineViewRow,
  MachineViewSavedViews,
} from "~/lib/types";
import { cn } from "~/lib/utils";

const STORAGE_KEY = "pinpoint:settings-sheets:run";

const DIRECTION_HINTS: Record<SheetDirection, (to: string) => string> = {
  setup: (to) => `Change each machine to its ${to} set`,
  restore: () => "Change each machine back",
  both: () => "Both columns, to keep with the machine",
};

const COVERAGE_HINTS: Record<SheetCoverage, string> = {
  differences: "Only the settings that change",
  full: "Every setting, differences in bold",
};

const SELECT_CLASS =
  "h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-base text-foreground md:text-sm";

function count(n: number, one: string, other: string): string {
  return `${n} ${n === 1 ? one : other}`;
}

interface StoredRun {
  options: PrintRunOptions;
  rows: PrintRunRow[];
}

function isStoredRun(value: unknown): value is StoredRun {
  if (typeof value !== "object" || value === null) return false;
  return "options" in value && "rows" in value && Array.isArray(value.rows);
}

function readStoredRun(): StoredRun | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredRun(parsed)) return null;
    const options = parsed.options;
    return {
      options: {
        from: parseSheetDefault(
          serializeSheetDefault(options.from),
          DEFAULT_PRINT_RUN_OPTIONS.from
        ),
        to: parseSheetDefault(
          serializeSheetDefault(options.to),
          DEFAULT_PRINT_RUN_OPTIONS.to
        ),
        direction: SHEET_DIRECTIONS.includes(options.direction)
          ? options.direction
          : "setup",
        coverage: SHEET_COVERAGES.includes(options.coverage)
          ? options.coverage
          : "differences",
      },
      rows: parsed.rows.filter(
        (row): row is PrintRunRow =>
          typeof row === "object" && typeof row.machineId === "string"
      ),
    };
  } catch {
    // Storage can be unavailable or hold something else; start empty.
    return null;
  }
}

function writeStoredRun(run: StoredRun): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(run));
  } catch {
    // Without storage the run lasts for this page view.
  }
}

function statusText(
  status: PrintRunStatus | null,
  labels: { from: string; to: string }
): string {
  if (status === null) return "Loading…";
  switch (status.kind) {
    case "choose":
      return "Choose a set";
    case "no-to":
      return `No ${labels.to} set: blank rows`;
    case "no-from":
      return `No ${labels.from} set: record values`;
    case "same-set":
      return "Same set";
    case "reinstall":
      return "Different installs";
    case "changes":
      return status.count === 0
        ? "No changes"
        : count(status.count, "change", "changes");
  }
}

function needsAttention(status: PrintRunStatus | null): boolean {
  return (
    status !== null &&
    (status.kind === "choose" ||
      status.kind === "no-to" ||
      status.kind === "no-from")
  );
}

interface SettingsSheetsBuilderProps {
  result: MachineViewResult;
  savedViews: MachineViewSavedViews;
  /** The ids "Add N shown" adds: every match On the Floor (§2.3). */
  addableIds: string[];
  tags: SheetTagOption[];
  /** A run named in the URL (§2.6, §2.8), or null to restore this tab's. */
  initialRun: { options: PrintRunOptions; rows: PrintRunRow[] } | null;
  initialMachines: PrintRunMachine[];
}

/**
 * Print settings sheets (settings-sheets §2): the Machines list to add from,
 * with the default sets above it; the print run, one row per machine; and the
 * Print run panel with direction, coverage, Preview, and Print.
 */
export function SettingsSheetsBuilder({
  result,
  savedViews,
  addableIds,
  tags,
  initialRun,
  initialMachines,
}: SettingsSheetsBuilderProps): React.JSX.Element {
  const id = React.useId();
  const [options, setOptions] = React.useState<PrintRunOptions>(
    initialRun?.options ?? DEFAULT_PRINT_RUN_OPTIONS
  );
  const [rows, setRows] = React.useState<PrintRunRow[]>(initialRun?.rows ?? []);
  const [machines, setMachines] = React.useState<Map<string, PrintRunMachine>>(
    () => new Map(initialMachines.map((machine) => [machine.id, machine]))
  );
  const [restored, setRestored] = React.useState(initialRun !== null);
  const [adding, startAdding] = React.useTransition();
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);

  const loadMachines = React.useCallback(
    async (ids: string[]): Promise<PrintRunMachine[]> => {
      if (ids.length === 0) return [];
      const outcome = await loadPrintRunMachinesAction(ids);
      if (!outcome.ok) {
        setLoadError(true);
        return [];
      }
      setLoadError(false);
      setMachines((current) => {
        const next = new Map(current);
        for (const machine of outcome.value) next.set(machine.id, machine);
        return next;
      });
      return outcome.value;
    },
    []
  );

  // With no run in the URL, this tab's last run comes back (§2.8: the way
  // back from the print page lands on the same run).
  React.useEffect(() => {
    if (restored) return;
    setRestored(true);
    const stored = readStoredRun();
    if (stored === null || stored.rows.length === 0) return;
    setOptions(stored.options);
    startAdding(async () => {
      const loaded = await loadMachines(stored.rows.map((r) => r.machineId));
      const ids = new Set(loaded.map((machine) => machine.id));
      setRows(stored.rows.filter((row) => ids.has(row.machineId)));
    });
  }, [loadMachines, restored]);

  React.useEffect(() => {
    if (restored) writeStoredRun({ options, rows });
  }, [options, restored, rows]);

  const inRun = React.useMemo(
    () => new Set(rows.map((row) => row.machineId)),
    [rows]
  );
  const toAdd = addableIds.filter((machineId) => !inRun.has(machineId));
  const labels = sheetLabels(options, tags);

  function add(ids: string[]): void {
    const fresh = ids.filter((machineId) => !inRun.has(machineId));
    if (fresh.length === 0) return;
    startAdding(async () => {
      const missing = fresh.filter((machineId) => !machines.has(machineId));
      const loaded = await loadMachines(missing);
      const available = new Set([
        ...fresh.filter((machineId) => machines.has(machineId)),
        ...loaded.map((machine) => machine.id),
      ]);
      setRows((current) => {
        const present = new Set(current.map((row) => row.machineId));
        return [
          ...current,
          ...fresh
            .filter((machineId) => available.has(machineId))
            .filter((machineId) => !present.has(machineId))
            .map((machineId) => ({ machineId })),
        ];
      });
    });
  }

  function choose(machineId: string, side: SheetSide, setId: string): void {
    setRows((current) =>
      current.map((row) =>
        row.machineId === machineId ? { ...row, [side]: setId } : row
      )
    );
  }

  function remove(machineId: string): void {
    setRows((current) => current.filter((row) => row.machineId !== machineId));
  }

  const loadedMachines = [...machines.values()];
  const statuses = new Map(
    rows.map((row) => {
      const machine = machines.get(row.machineId);
      return [
        row.machineId,
        machine === undefined ? null : printRunRowStatus(machine, row, options),
      ] as const;
    })
  );
  const printing = rows.filter((row) => {
    const status = statuses.get(row.machineId);
    return (
      status !== undefined &&
      status !== null &&
      printRunStatusPrints(status, options.coverage)
    );
  }).length;
  const printHref = `/m/settings-sheets/print?${serializePrintRunQuery(
    loadedMachines,
    rows,
    options
  ).toString()}`;
  const runDetail = `${SHEET_COVERAGE_LABELS[options.coverage]} · ${labels.from} → ${labels.to}`;

  const rowAction = (row: MachineViewRow): React.ReactNode => {
    if (inRun.has(row.id)) {
      return (
        <span className="inline-flex h-8 items-center gap-1 px-2 text-sm text-muted-foreground">
          <Check className="size-4" aria-hidden="true" />
          Added
        </span>
      );
    }
    const onFloor = row.presence === "on_the_floor";
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!onFloor || adding}
        aria-label={`Add ${row.title}`}
        title={onFloor ? undefined : "Only machines on the floor can be added"}
        onClick={() => add([row.id])}
      >
        <Plus className="size-4" aria-hidden="true" />
        Add
      </Button>
    );
  };

  const listAction = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={toAdd.length === 0 || adding}
      onClick={() => add(toAdd)}
      className="whitespace-nowrap"
    >
      <Plus className="size-4" aria-hidden="true" />
      {toAdd.length === 0 ? "Nothing to add" : `Add ${toAdd.length} shown`}
    </Button>
  );

  const defaultOptions = [
    { value: "house", label: "Preferred House" },
    { value: "tournament", label: "Preferred Tournament" },
    ...tags
      .filter((tag) => tag.slug !== "house" && tag.slug !== "tournament")
      .map((tag) => ({ value: `tag:${tag.slug}`, label: `Tag: ${tag.name}` })),
  ];

  return (
    <div className="flex flex-col gap-5 pb-28 md:pb-0">
      <div className="flex flex-col gap-1">
        <Link
          href="/m"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Machines
        </Link>
        <PageHeader title="Print settings sheets" />
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-6">
          <section
            aria-labelledby={`${id}-add`}
            className="flex min-w-0 flex-col gap-3"
          >
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
              <h2 id={`${id}-add`} className="text-lg font-semibold">
                Add machines
              </h2>
              {/* The phone List Header has no slot for it (list-views §7.3). */}
              <div className="ml-auto md:hidden">{listAction}</div>
              <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-sm md:ml-auto md:flex md:w-auto md:flex-wrap">
                <label htmlFor={`${id}-from`} className="text-muted-foreground">
                  Change from
                </label>
                <select
                  id={`${id}-from`}
                  value={serializeSheetDefault(options.from)}
                  onChange={(event) =>
                    setOptions((current) => ({
                      ...current,
                      from: parseSheetDefault(event.target.value, current.from),
                    }))
                  }
                  className={cn(SELECT_CLASS, "md:w-auto")}
                >
                  {defaultOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <label
                  htmlFor={`${id}-to`}
                  className="text-right text-muted-foreground"
                >
                  to
                </label>
                <select
                  id={`${id}-to`}
                  value={serializeSheetDefault(options.to)}
                  onChange={(event) =>
                    setOptions((current) => ({
                      ...current,
                      to: parseSheetDefault(event.target.value, current.to),
                    }))
                  }
                  className={cn(SELECT_CLASS, "md:w-auto")}
                >
                  {defaultOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <MachineView
              result={result}
              preset="machines"
              savedViews={savedViews}
              rowAction={rowAction}
              listAction={listAction}
              showSummary={false}
            />
          </section>

          <PrintRunList
            id={id}
            rows={rows}
            machines={machines}
            statuses={statuses}
            options={options}
            labels={labels}
            loadError={loadError}
            onChoose={choose}
            onRemove={remove}
            onRemoveAll={() => setRows([])}
          />
        </div>

        <aside
          id="print-run"
          aria-labelledby={`${id}-panel`}
          className="flex w-full scroll-mt-20 flex-col gap-5 rounded-lg border border-border bg-card p-5 md:w-auto md:max-w-sm md:flex-[1_1_300px] md:sticky md:top-20"
        >
          <h2 id={`${id}-panel`} className="text-lg font-semibold">
            Print run
          </h2>
          <div className="flex flex-col gap-0.5 border-b border-border pb-3">
            <span className="font-semibold">
              {count(printing, "machine prints", "machines print")}
            </span>
            <span className="text-sm text-muted-foreground">{runDetail}</span>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-medium">Direction</legend>
            {SHEET_DIRECTIONS.map((direction) => (
              <label
                key={direction}
                className="grid min-h-8 grid-cols-[auto_minmax(0,1fr)] gap-x-2.5"
              >
                <input
                  type="radio"
                  name={`${id}-direction`}
                  className="row-span-2 mt-0.5 size-4 accent-primary"
                  checked={options.direction === direction}
                  onChange={() =>
                    setOptions((current) => ({ ...current, direction }))
                  }
                />
                <span>{SHEET_DIRECTION_LABELS[direction]}</span>
                <span className="text-sm text-muted-foreground">
                  {DIRECTION_HINTS[direction](labels.to)}
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-medium">What to print</legend>
            {SHEET_COVERAGES.map((coverage) => (
              <label
                key={coverage}
                className="grid min-h-8 grid-cols-[auto_minmax(0,1fr)] gap-x-2.5"
              >
                <input
                  type="radio"
                  name={`${id}-coverage`}
                  className="row-span-2 mt-0.5 size-4 accent-primary"
                  checked={options.coverage === coverage}
                  onChange={() =>
                    setOptions((current) => ({ ...current, coverage }))
                  }
                />
                <span>{SHEET_COVERAGE_LABELS[coverage]}</span>
                <span className="text-sm text-muted-foreground">
                  {COVERAGE_HINTS[coverage]}
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={rows.length === 0}
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="size-4" aria-hidden="true" />
              Preview
            </Button>
            {rows.length === 0 ? (
              <Button type="button" disabled>
                <Printer className="size-4" aria-hidden="true" />
                Print
              </Button>
            ) : (
              <Button asChild>
                <Link href={printHref}>
                  <Printer className="size-4" aria-hidden="true" />
                  Print
                </Link>
              </Button>
            )}
          </div>
        </aside>
      </div>

      {/* Phone: the run's totals stay in view above the pager and tab bar. */}
      <div className="fixed inset-x-0 bottom-[calc(101px+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 border-t border-border bg-card px-4 py-2 md:hidden">
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold">
            {count(printing, "machine prints", "machines print")}
          </span>
          <span className="truncate text-sm text-muted-foreground">
            {runDetail}
          </span>
        </span>
        <Button asChild size="sm" className="ml-auto shrink-0">
          <a href="#print-run">Print run</a>
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[calc(8.5in+4rem)] flex-col gap-3 sm:max-w-[calc(8.5in+4rem)]">
          <div className="flex flex-wrap items-center gap-3 pr-8">
            <DialogTitle>Preview</DialogTitle>
            <DialogDescription className="text-sm">
              {runDetail}
            </DialogDescription>
            <Button asChild size="sm" className="ml-auto">
              <Link href={printHref}>
                <Printer className="size-4" aria-hidden="true" />
                Print
              </Link>
            </Button>
          </div>
          <div className="min-h-0 overflow-auto rounded-md bg-muted p-4">
            <div className="mx-auto w-[8.5in] bg-white p-[0.5in] shadow-lg">
              <SettingsSheetDocument
                sheet={buildSettingsSheet(
                  printRunInputs(loadedMachines, rows, options),
                  options.coverage
                )}
                direction={options.direction}
                coverage={options.coverage}
                labels={labels}
                printedAt={new Date().toISOString()}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PrintRunListProps {
  id: string;
  rows: PrintRunRow[];
  machines: Map<string, PrintRunMachine>;
  statuses: Map<string, PrintRunStatus | null>;
  options: PrintRunOptions;
  labels: { from: string; to: string };
  loadError: boolean;
  onChoose: (machineId: string, side: SheetSide, setId: string) => void;
  onRemove: (machineId: string) => void;
  onRemoveAll: () => void;
}

/** "In this print run" (§2.5): each machine, its From and To sets, and status. */
function PrintRunList({
  id,
  rows,
  machines,
  statuses,
  options,
  labels,
  loadError,
  onChoose,
  onRemove,
  onRemoveAll,
}: PrintRunListProps): React.JSX.Element {
  return (
    <section
      aria-labelledby={`${id}-run`}
      className="overflow-hidden rounded-lg border border-border bg-card max-md:-mx-4 max-md:rounded-none max-md:border-x-0"
    >
      <div className="flex items-center gap-2 bg-muted px-4 py-3">
        <h2 id={`${id}-run`} className="text-base font-semibold">
          In this print run
        </h2>
        <span className="text-sm text-muted-foreground">
          {count(rows.length, "machine", "machines")}
        </span>
        {rows.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={onRemoveAll}
          >
            Remove all
          </Button>
        ) : null}
      </div>
      {loadError ? (
        <p
          role="alert"
          className="border-t border-border px-4 py-3 text-sm text-error"
        >
          Couldn&apos;t load those machines. Try again.
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="border-t border-border px-4 py-5 text-sm text-muted-foreground">
          No machines added
        </p>
      ) : (
        <>
          <div
            aria-hidden="true"
            className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_8.5rem_2.5rem] gap-x-3 border-t border-border px-4 py-2 text-sm text-muted-foreground md:grid"
          >
            <span>Machine</span>
            <span>From</span>
            <span>To</span>
            <span>Sheet</span>
            <span />
          </div>
          <ul className="divide-y divide-border border-t border-border">
            {rows.map((row) => {
              const machine = machines.get(row.machineId);
              const status = statuses.get(row.machineId) ?? null;
              return (
                <li
                  key={row.machineId}
                  className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-x-3 gap-y-2 px-4 py-2.5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_8.5rem_2.5rem]"
                >
                  <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-2">
                    <span className="truncate font-semibold">
                      {machine?.name ?? "Loading…"}
                    </span>
                    {machine ? (
                      <span className="shrink-0 rounded-sm border border-outline-variant px-1.5 text-xs font-medium text-muted-foreground uppercase">
                        {machine.initials}
                      </span>
                    ) : null}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="col-start-2 row-start-1 size-9 justify-self-end md:col-start-5"
                    aria-label={`Remove ${machine?.name ?? "machine"}`}
                    onClick={() => onRemove(row.machineId)}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                  {machine ? (
                    <>
                      <SetSelect
                        machine={machine}
                        row={row}
                        side="from"
                        options={options}
                        label={labels.from}
                        onChoose={onChoose}
                      />
                      <SetSelect
                        machine={machine}
                        row={row}
                        side="to"
                        options={options}
                        label={labels.to}
                        onChoose={onChoose}
                      />
                    </>
                  ) : null}
                  <span
                    className={cn(
                      "col-span-2 text-sm md:col-span-1 md:col-start-4 md:row-start-1",
                      needsAttention(status)
                        ? "font-medium text-warning"
                        : "text-muted-foreground"
                    )}
                  >
                    {statusText(status, labels)}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function setOptionLabel(set: PrintRunMachine["sets"][number]): string {
  if (set.isPreferredHouse && set.isPreferredTournament) {
    return `${set.name} · pref. House, Tournament`;
  }
  if (set.isPreferredHouse) return `${set.name} · pref. House`;
  if (set.isPreferredTournament) return `${set.name} · pref. Tournament`;
  return set.name;
}

function SetSelect({
  machine,
  row,
  side,
  options,
  label,
  onChoose,
}: {
  machine: PrintRunMachine;
  row: PrintRunRow;
  side: SheetSide;
  options: PrintRunOptions;
  label: string;
  onChoose: (machineId: string, side: SheetSide, setId: string) => void;
}): React.JSX.Element {
  const resolution: SheetResolution = resolveRowSide(
    machine,
    row,
    side,
    side === "from" ? options.from : options.to
  );
  const value = resolution.kind === "set" ? resolution.setId : "";
  const choices =
    resolution.kind === "choose"
      ? machine.sets.filter((set) => resolution.setIds.includes(set.id))
      : [];
  const sideName = side === "from" ? "From" : "To";
  return (
    <span
      className={cn(
        "col-span-2 flex min-w-0 items-center gap-2 md:col-span-1 md:row-start-1",
        side === "from" ? "md:col-start-2" : "md:col-start-3"
      )}
    >
      <span className="w-10 shrink-0 text-sm text-muted-foreground md:hidden">
        {sideName}
      </span>
      <select
        aria-label={`${sideName} set for ${machine.name}`}
        value={value}
        onChange={(event) => {
          if (event.target.value !== "") {
            onChoose(machine.id, side, event.target.value);
          }
        }}
        className={cn(
          SELECT_CLASS,
          resolution.kind !== "set" && "border-warning text-warning"
        )}
      >
        {resolution.kind === "choose" ? (
          <option value="" disabled>
            Choose a set
          </option>
        ) : null}
        {resolution.kind === "none" ? (
          <option value="" disabled>
            No {label} set
          </option>
        ) : null}
        {choices.length > 0 ? (
          <optgroup label="Tagged">
            {choices.map((set) => (
              <option key={set.id} value={set.id}>
                {setOptionLabel(set)}
              </option>
            ))}
          </optgroup>
        ) : null}
        {machine.sets.map((set) =>
          choices.some((choice) => choice.id === set.id) ? null : (
            <option key={set.id} value={set.id}>
              {setOptionLabel(set)}
            </option>
          )
        )}
      </select>
    </span>
  );
}

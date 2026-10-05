"use client";

import type React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type {
  MachineViewFieldId,
  MachineViewRow,
  MachineViewState,
} from "~/lib/types";
import { MACHINE_VIEW_FIELDS } from "~/lib/machines/view/config";
import { cn } from "~/lib/utils";
import {
  MACHINE_VIEW_FIELD_RENDERERS,
  MachineIdentity,
  type MachineSelectionHandler,
} from "./field-catalog";

interface MachineViewTableProps {
  rows: MachineViewRow[];
  state: MachineViewState;
  mobileMode: "compact" | "table";
  onSort: (field: MachineViewFieldId) => void;
  onMachineSelect?: MachineSelectionHandler | undefined;
}

function SortHeader({
  field,
  state,
  align = "left",
  onSort,
}: {
  field: MachineViewFieldId;
  state: MachineViewState;
  align?: "left" | "right";
  onSort: (field: MachineViewFieldId) => void;
}): React.JSX.Element {
  const active = state.sort === field;
  const Icon = !active
    ? ArrowUpDown
    : state.dir === "asc"
      ? ArrowUp
      : ArrowDown;
  const isMachine = field === "machine";
  return (
    <th
      scope="col"
      aria-sort={
        active ? (state.dir === "asc" ? "ascending" : "descending") : "none"
      }
      className={cn(
        "sticky top-0 z-20 h-10 whitespace-nowrap border-b border-outline-variant bg-card px-3 text-left text-sm font-semibold text-muted-foreground",
        align === "right" && "text-right",
        // The Machine column takes the remaining width and stays pinned while
        // the narrow columns scroll (machine-views §5.2).
        isMachine
          ? "left-0 z-30 w-full max-w-0 min-w-52 border-r border-outline-variant pl-4"
          : "w-px last:pr-4"
      )}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "group inline-flex items-center rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          align === "right" && "justify-end"
        )}
      >
        {MACHINE_VIEW_FIELDS[field].label}
        <Icon
          className={cn(
            "ml-1.5 size-3.5",
            active ? "text-primary" : "opacity-30 group-hover:opacity-100"
          )}
        />
      </button>
    </th>
  );
}

export function MachineViewTable({
  rows,
  state,
  mobileMode,
  onSort,
  onMachineSelect,
}: MachineViewTableProps): React.JSX.Element {
  const fields = state.columns.filter(
    (field): field is Exclude<MachineViewFieldId, "machine"> =>
      field !== "machine"
  );
  const table = (
    // The List View list box draws the card (list-views §3.1, §7.7).
    <div className="relative">
      {mobileMode === "table" && fields.length > 1 ? (
        <div className="flex items-center justify-end border-b border-outline-variant px-3 py-1.5 text-xs text-muted-foreground md:hidden">
          Scroll for more&nbsp;→
        </div>
      ) : null}
      <div
        role="region"
        aria-label="Machine table"
        className="max-h-[65vh] overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Machines with selected status and activity fields
          </caption>
          <thead>
            <tr>
              <SortHeader field="machine" state={state} onSort={onSort} />
              {fields.map((field) => (
                <SortHeader
                  key={field}
                  field={field}
                  state={state}
                  align={MACHINE_VIEW_FIELD_RENDERERS[field].align}
                  onSort={onSort}
                />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="group hover:bg-muted/50">
                {/* The pinned cell keeps its opaque card background on hover
                    and layers the row's muted tint over it as an image, so
                    cells scrolled beneath it never show through. */}
                <th
                  scope="row"
                  className="sticky left-0 z-10 h-14 w-full max-w-0 min-w-52 border-r border-outline-variant bg-card py-1 pr-3 pl-4 text-left font-normal group-hover:bg-linear-to-r group-hover:from-muted/50 group-hover:to-muted/50"
                >
                  <MachineIdentity
                    row={row}
                    variant="table"
                    onMachineSelect={onMachineSelect}
                  />
                </th>
                {fields.map((field) => {
                  const renderer = MACHINE_VIEW_FIELD_RENDERERS[field];
                  return (
                    <td
                      key={field}
                      className={cn(
                        "h-14 w-px whitespace-nowrap px-3 py-1 last:pr-4",
                        renderer.align === "right" && "text-right",
                        renderer.tableClassName
                      )}
                    >
                      {renderer.render(row)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mobileMode === "table" && fields.length > 1 ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-card to-transparent md:hidden"
        />
      ) : null}
    </div>
  );

  return (
    <div className={cn(mobileMode === "compact" && "hidden md:block")}>
      {table}
    </div>
  );
}

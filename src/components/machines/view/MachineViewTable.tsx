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
  sticky = false,
  align = "left",
  onSort,
}: {
  field: MachineViewFieldId;
  state: MachineViewState;
  sticky?: boolean;
  align?: "left" | "center" | "right";
  onSort: (field: MachineViewFieldId) => void;
}): React.JSX.Element {
  const active = state.sort === field;
  const Icon = !active
    ? ArrowUpDown
    : state.dir === "asc"
      ? ArrowUp
      : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={
        active ? (state.dir === "asc" ? "ascending" : "descending") : "none"
      }
      className={cn(
        "sticky top-0 z-20 whitespace-nowrap border-b border-outline-variant bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground",
        align === "center" && "text-center",
        align === "right" && "text-right",
        sticky && "left-0 z-30 min-w-72 border-r"
      )}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "inline-flex min-h-8 items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          align === "center" && "justify-center",
          align === "right" && "justify-end"
        )}
      >
        {MACHINE_VIEW_FIELDS[field].label}
        <Icon className={cn("size-3.5", !active && "opacity-40")} />
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
    <div className="relative overflow-hidden rounded-lg border border-outline-variant bg-card shadow-sm">
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
        <table className="w-full min-w-max border-collapse text-sm">
          <caption className="sr-only">
            Machines with selected status and activity fields
          </caption>
          <thead>
            <tr>
              <SortHeader
                field="machine"
                state={state}
                sticky
                onSort={onSort}
              />
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
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="group border-b border-outline-variant last:border-b-0 hover:bg-muted/40"
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 min-w-72 border-r border-outline-variant bg-card px-4 py-2 text-left group-hover:bg-muted"
                >
                  <MachineIdentity
                    row={row}
                    onMachineSelect={onMachineSelect}
                  />
                </th>
                {fields.map((field) => {
                  const renderer = MACHINE_VIEW_FIELD_RENDERERS[field];
                  return (
                    <td
                      key={field}
                      className={cn(
                        "whitespace-nowrap px-4 py-2",
                        renderer.align === "center" && "text-center",
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

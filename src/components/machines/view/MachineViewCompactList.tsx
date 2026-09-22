"use client";

import type React from "react";
import type { MachineViewFieldId, MachineViewRow } from "~/lib/types";
import {
  MACHINE_VIEW_FIELD_RENDERERS,
  MachineIdentity,
  type MachineSelectionHandler,
} from "./field-catalog";

interface MachineViewCompactListProps {
  rows: MachineViewRow[];
  columns: MachineViewFieldId[];
  onMachineSelect?: MachineSelectionHandler | undefined;
}

export function MachineViewCompactList({
  rows,
  columns,
  onMachineSelect,
}: MachineViewCompactListProps): React.JSX.Element {
  const fields = columns.filter(
    (field): field is Exclude<MachineViewFieldId, "machine"> =>
      field !== "machine"
  );
  return (
    <ul className="divide-y divide-outline-variant overflow-hidden rounded-lg border border-outline-variant bg-card md:hidden">
      {rows.map((row) => (
        <li key={row.id} className="space-y-3 px-4 py-3">
          <MachineIdentity row={row} onMachineSelect={onMachineSelect} />
          {fields.length > 0 ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              {fields.map((field) => {
                const renderer = MACHINE_VIEW_FIELD_RENDERERS[field];
                return (
                  <div key={field} className="min-w-0">
                    <dt className="text-xs font-medium text-muted-foreground">
                      {renderer.label}
                    </dt>
                    <dd className="mt-0.5 truncate text-sm text-foreground">
                      {renderer.render(row)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

"use client";

import type React from "react";
import type { MachineViewFieldId, MachineViewRow } from "~/lib/types";
import { cn } from "~/lib/utils";
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

function compactFieldSpans(count: number): string[] {
  const spans: string[] = [];
  let remaining = count;

  while (remaining > 0) {
    if (remaining === 1) {
      spans.push("@min-[336px]:col-span-12");
      remaining = 0;
    } else if (remaining === 2 || remaining === 4) {
      spans.push("@min-[336px]:col-span-6", "@min-[336px]:col-span-6");
      remaining -= 2;
    } else {
      spans.push(
        "@min-[336px]:col-span-5",
        "@min-[336px]:col-span-3",
        "@min-[336px]:col-span-4"
      );
      remaining -= 3;
    }
  }

  return spans;
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
  const wideSpans = compactFieldSpans(fields.length);
  return (
    <ul className="@container divide-y divide-outline-variant overflow-hidden rounded-lg border border-outline-variant bg-card md:hidden">
      {rows.map((row) => (
        <li key={row.id} className="space-y-2.5 px-4 py-3">
          <MachineIdentity row={row} onMachineSelect={onMachineSelect} />
          {fields.length > 0 ? (
            <dl className="grid grid-cols-12 gap-x-2 gap-y-2">
              {fields.map((field, index) => {
                const renderer = MACHINE_VIEW_FIELD_RENDERERS[field];
                return (
                  <div
                    key={field}
                    className={cn(
                      "min-w-0 col-span-6",
                      fields.length % 2 === 1 && index === 0 && "col-span-12",
                      wideSpans[index]
                    )}
                  >
                    <dt className="text-xs font-medium text-muted-foreground">
                      {renderer.label}
                    </dt>
                    <dd className="mt-0.5 break-words text-sm text-foreground">
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

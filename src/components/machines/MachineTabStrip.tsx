"use client";

import type React from "react";
import { RouteTabStrip } from "~/components/layout/RouteTabStrip";
import type { MachineStatus } from "~/lib/machines/status";

interface MachineTabStripProps {
  initials: string;
  /** Open-issue count + derived status for the Service tab badge. */
  maintenance: {
    openCount: number;
    status: MachineStatus;
  };
  /** Viewer holds `machines.edit` — see the Manage tab note below. */
  canEdit: boolean;
}

export function MachineTabStrip({
  initials,
  maintenance,
  canEdit,
}: MachineTabStripProps): React.JSX.Element {
  return (
    <RouteTabStrip
      basePath={`/m/${initials}`}
      ariaLabel="Machine sections"
      testIdPrefix="machine-tab"
      tabs={[
        { slug: "", label: "Info" },
        { slug: "settings", label: "Settings" },
        // URL slug stays `maintenance` (folder name + existing routes/tests);
        // the visible label is "Service" — shorter, matches the
        // `needs_service` status vocabulary used elsewhere in the app.
        {
          slug: "maintenance",
          label: "Service",
          badge: { count: maintenance.openCount, status: maintenance.status },
        },
        { slug: "timeline", label: "Timeline" },
        // URL slug stays `edit`; the visible label is "Manage". The tab holds
        // the machine's RECORD — name, model, availability, PBM listing,
        // ownership, deletion — while the Settings tab holds the machine's
        // DIP switches, software settings, and Jones plugs. Calling this one
        // "Edit" invited "do I change availability in Edit or Settings?".
        //
        // Permission-gated, and therefore LAST: appending it keeps every other
        // tab at the same index for every role, so the strip doesn't reflow
        // depending on who is looking at it.
        ...(canEdit ? [{ slug: "edit", label: "Manage" }] : []),
      ]}
    />
  );
}

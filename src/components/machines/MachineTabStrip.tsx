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
  /** Viewer holds `machines.edit` — see the Edit tab note below. */
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
        // Edit is permission-gated and therefore LAST: appending it keeps every
        // other tab at the same index for every role, so the strip doesn't
        // reflow depending on who is looking at it.
        ...(canEdit ? [{ slug: "edit", label: "Edit" }] : []),
      ]}
    />
  );
}

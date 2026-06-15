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
}

export function MachineTabStrip({
  initials,
  maintenance,
}: MachineTabStripProps): React.JSX.Element {
  return (
    <RouteTabStrip
      basePath={`/m/${initials}`}
      ariaLabel="Machine sections"
      testIdPrefix="machine-tab"
      tabs={[
        { slug: "", label: "Info" },
        // URL slug stays `maintenance` (folder name + existing routes/tests);
        // the visible label is "Service" — shorter, matches the
        // `needs_service` status vocabulary used elsewhere in the app.
        {
          slug: "maintenance",
          label: "Service",
          badge: { count: maintenance.openCount, status: maintenance.status },
        },
        { slug: "timeline", label: "Timeline" },
      ]}
    />
  );
}

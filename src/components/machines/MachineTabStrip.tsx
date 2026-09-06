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
  /** Viewer may open Manage to edit the machine or read Pinball Map status. */
  canManage: boolean;
}

export function MachineTabStrip({
  initials,
  maintenance,
  canManage,
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
        // Access-gated, and therefore LAST: appending it keeps every other tab
        // at the same index for every role. Editors get the full page; members
        // without edit access get its read-only Pinball Map section (spec 4.9).
        ...(canManage ? [{ slug: "edit", label: "Manage" }] : []),
      ]}
    />
  );
}

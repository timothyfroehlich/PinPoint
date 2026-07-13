"use client";
import type React from "react";
import type { MachineOption } from "~/components/machines/MachineCombobox";

interface BulkReportGridProps {
  machines: MachineOption[];
  assignees: { id: string; name: string | null }[];
}

export function BulkReportGrid(_props: BulkReportGridProps): React.JSX.Element {
  return <div data-testid="bulk-report-grid" />;
}

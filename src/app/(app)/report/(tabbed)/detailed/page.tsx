import type React from "react";
import { getViewer } from "~/lib/auth/viewer";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import {
  getRecentIssuesAction,
  type RecentIssueData,
} from "~/app/(app)/report/actions";
import { resolveDefaultMachineId } from "~/app/(app)/report/default-machine";
import {
  getReportAssignees,
  getReportMachines,
} from "~/app/(app)/report/report-data";
import { UnifiedReportForm } from "~/app/(app)/report/unified-report-form";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function DetailedReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[];
    machine?: string | string[];
    machineId?: string | string[];
    source?: string | string[];
  }>;
}): Promise<React.JSX.Element> {
  const machinesListPromise = getReportMachines();
  const { userId, role } = await getViewer();

  const accessLevel = getAccessLevel(role);
  const assignees = await getReportAssignees(accessLevel);
  const machinesList = await machinesListPromise;
  const params = await searchParams;
  const defaultMachineId = resolveDefaultMachineId(
    machinesList,
    params.machineId,
    params.machine
  );
  const selectedMachine = machinesList.find(
    (machine) => machine.id === defaultMachineId
  );
  let initialIssues: RecentIssueData[] | null = null;
  if (selectedMachine) {
    const result = await getRecentIssuesAction(selectedMachine.initials, 5);
    initialIssues = result.ok ? result.value : null;
  }

  return (
    <UnifiedReportForm
      machinesList={machinesList}
      defaultMachineId={defaultMachineId}
      userAuthenticated={userId !== undefined}
      accessLevel={accessLevel}
      assignees={assignees}
      initialError={typeof params.error === "string" ? params.error : undefined}
      initialIssues={initialIssues}
      initialMachineInitials={selectedMachine?.initials ?? ""}
      source={params.source === "apron" ? "apron" : undefined}
      canMultiple={
        userId !== undefined &&
        checkPermission("issues.report.quick", accessLevel)
      }
    />
  );
}

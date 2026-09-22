import type React from "react";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { createClient } from "~/lib/supabase/server";
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
  }>;
}): Promise<React.JSX.Element> {
  const machinesListPromise = getReportMachines();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userProfile;
  if (user) {
    userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { role: true },
    });
  }

  const accessLevel = getAccessLevel(userProfile?.role);
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
      userAuthenticated={Boolean(user)}
      accessLevel={accessLevel}
      assignees={assignees}
      initialError={
        typeof params.error === "string"
          ? decodeURIComponent(params.error)
          : undefined
      }
      initialIssues={initialIssues}
      initialMachineInitials={selectedMachine?.initials ?? ""}
      canMultiple={
        Boolean(user) && checkPermission("issues.report.quick", accessLevel)
      }
    />
  );
}

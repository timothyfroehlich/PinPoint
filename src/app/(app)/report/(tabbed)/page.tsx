import type React from "react";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { resolveDefaultMachineId } from "../default-machine";
import { createClient } from "~/lib/supabase/server";
import { getAccessLevel } from "~/lib/permissions/helpers";
import { getRecentIssuesAction, type RecentIssueData } from "../actions";
import { getReportMachines } from "../report-data";
import { QuickReportForm } from "~/app/(app)/report/quick-report-form";
import { checkPermission } from "~/lib/permissions/helpers";

// Avoid SSG hitting Supabase during builds that run parallel to db resets
export const dynamic = "force-dynamic";

// Bound the route (which hosts the report Server Action) so a slow submission
// fails fast as a deterministic 504 rather than an opaque platform SIGKILL —
// giving submitPublicIssueAction's catch + Sentry.flush a chance to run. This
// is the interim guard for the silent-failure class (incident: Doodle Bug).
// (PP-2053.1)
export const maxDuration = 60;

export default async function PublicReportPage({
  searchParams,
}: {
  // Every one of these arrives as `string[]` when the key is repeated
  // (`?machine=afm&machine=bbh`), so they are typed the way the App Router
  // actually delivers them rather than the way they are normally used.
  searchParams: Promise<{
    error?: string | string[];
    machine?: string | string[];
    machineId?: string | string[];
    source?: string | string[];
  }>;
}): Promise<React.JSX.Element> {
  const machinesListPromise = getReportMachines();

  // Auth context for the form
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
  const canMultiple =
    Boolean(user) && checkPermission("issues.report.quick", accessLevel);

  const machinesList = await machinesListPromise;

  const params = await searchParams;
  const errorMessage =
    typeof params.error === "string" ? params.error : undefined;

  const machineIdFromQuery = params.machineId;
  const machineInitialsFromQuery = params.machine;

  const defaultMachineId = resolveDefaultMachineId(
    machinesList,
    machineIdFromQuery,
    machineInitialsFromQuery
  );

  const selectedMachine = machinesList.find((m) => m.id === defaultMachineId);

  // Pre-fetch initial issues for the selected machine (avoids first-load skeleton flash)
  let initialIssues: RecentIssueData[] | null = null;
  if (selectedMachine) {
    const result = await getRecentIssuesAction(selectedMachine.initials, 3);
    initialIssues = result.ok ? result.value : null;
  }

  return (
    <QuickReportForm
      machinesList={machinesList}
      defaultMachineId={defaultMachineId}
      canMultiple={canMultiple}
      initialError={errorMessage}
      initialIssues={initialIssues}
      initialMachineInitials={selectedMachine?.initials ?? ""}
    />
  );
}

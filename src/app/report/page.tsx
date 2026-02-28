import type React from "react";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { machines, userProfiles } from "~/server/db/schema";
import { MainLayout } from "~/components/layout/MainLayout";
import { resolveDefaultMachineId } from "./default-machine";
import { UnifiedReportForm } from "./unified-report-form";
import { createClient } from "~/lib/supabase/server";
import { getAccessLevel } from "~/lib/permissions/helpers";
import { getRecentIssuesAction, type RecentIssueData } from "./actions";

// Avoid SSG hitting Supabase during builds that run parallel to db resets
export const dynamic = "force-dynamic";

export default async function PublicReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    machine?: string;
    machineId?: string;
    source?: string;
  }>;
}): Promise<React.JSX.Element> {
  const machinesListPromise = db.query.machines.findMany({
    orderBy: asc(machines.name),
    columns: { id: true, name: true, initials: true },
  });

  // Auth context for the form
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userProfile;
  let assignees: { id: string; name: string | null }[] = [];
  if (user) {
    userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { role: true },
    });
  }

  const accessLevel = getAccessLevel(userProfile?.role);

  if (accessLevel === "admin" || accessLevel === "member") {
    assignees = await db.query.userProfiles.findMany({
      where: (profile) =>
        sql`${profile.role} = 'admin' OR ${profile.role} = 'member'`,
      columns: { id: true, name: true },
      orderBy: asc(userProfiles.name),
    });
  }

  const [machinesList] = await Promise.all([machinesListPromise]);

  const params = await searchParams;
  const errorMessage = params.error
    ? decodeURIComponent(params.error)
    : undefined;

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
    const result = await getRecentIssuesAction(selectedMachine.initials, 5);
    initialIssues = result.ok ? result.value : null;
  }

  return (
    <MainLayout>
      <div className="container mx-auto max-w-5xl py-4 px-2 md:py-8 md:px-4">
        {/* CORE-SEC-006: Pass minimal user shape, not full Supabase user */}
        <UnifiedReportForm
          machinesList={machinesList}
          defaultMachineId={defaultMachineId}
          userAuthenticated={Boolean(user)}
          accessLevel={accessLevel}
          assignees={assignees}
          initialError={errorMessage}
          initialIssues={initialIssues}
          initialMachineInitials={selectedMachine?.initials ?? ""}
        />
      </div>
    </MainLayout>
  );
}

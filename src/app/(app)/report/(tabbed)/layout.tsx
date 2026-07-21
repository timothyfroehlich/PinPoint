import type React from "react";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { createClient } from "~/lib/supabase/server";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { ReportDraftProvider } from "../report-draft-store";
import { ReportTabs } from "../report-tabs";
import { getReportMachines, getReportAssignees } from "../report-data";

// Avoid SSG hitting Supabase during builds that run parallel to db resets, and
// keep the report Server Actions bounded so a slow submit fails fast (PP-2053.1).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Shared layout for the tabbed report page (PP-idrb). Fetches machines +
 * assignees once (both child routes used to fetch their own) and hosts the
 * client `ReportDraftProvider` so the shared draft survives `/report ↔
 * /report/quick` navigation without a remount, plus the boxed tab bar. The two
 * children — `/report` (Single) and `/report/quick` (Multiple) — render inside
 * the provider.
 */
export default async function ReportLayout({
  children,
}: {
  children: React.ReactNode;
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
  const canQuick = checkPermission("issues.report.quick", accessLevel);

  // Assignees for whoever can assign (matrix-gated — includes technicians, who
  // the old hand-rolled admin/member check dropped). Deduped with page.tsx's
  // call via React cache(); anonymous reporters get [] and no assignee control.
  const assignees = await getReportAssignees(accessLevel);

  const machinesList = await machinesListPromise;
  const machineOptions = machinesList.map((m) => ({
    value: m.id,
    name: m.name,
    initials: m.initials,
  }));

  return (
    <ReportDraftProvider machines={machineOptions} assignees={assignees}>
      <PageContainer size="wide">
        <PageHeader title="Report an Issue" />
        <ReportTabs canQuick={canQuick} />
        {children}
      </PageContainer>
    </ReportDraftProvider>
  );
}

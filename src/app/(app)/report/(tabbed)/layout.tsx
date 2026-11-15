import type React from "react";
import { getViewer } from "~/lib/auth/viewer";
import { getAccessLevel } from "~/lib/permissions/helpers";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { ReportDraftProvider } from "../report-draft-store";
import { getReportMachines, getReportAssignees } from "../report-data";

// Avoid SSG hitting Supabase during builds that run parallel to db resets, and
// keep the report Server Actions bounded so a slow submit fails fast (PP-2053.1).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Shared layout for the progressive report flow. The draft provider stays
 * mounted while Quick, Detailed, and Multiple navigate between sibling routes,
 * so the first report carries forward without tab-like mode chrome.
 */
export default async function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const machinesListPromise = getReportMachines();

  const { role } = await getViewer();

  const accessLevel = getAccessLevel(role);
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
        <PageHeader
          title={
            <h1 className="text-balance text-2xl font-bold tracking-tight md:text-3xl">
              Report an Issue
            </h1>
          }
        />
        {children}
      </PageContainer>
    </ReportDraftProvider>
  );
}

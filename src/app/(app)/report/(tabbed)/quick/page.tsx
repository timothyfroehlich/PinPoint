import type React from "react";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { checkPermission } from "~/lib/permissions/helpers";
import { getUserAccessLevel } from "~/lib/permissions/access";
import { getLoginUrl } from "~/lib/url";
import { QuickReportGrid } from "./quick-report-grid";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function QuickReportPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(getLoginUrl("/report/quick"));

  const accessLevel = await getUserAccessLevel(user.id);

  if (!checkPermission("issues.report.quick", accessLevel)) {
    redirect("/report");
  }

  return (
    /* Page chrome (container, header, tab bar) + machines/assignees are owned by
       report/layout.tsx; the grid reads them from the shared ReportDraftProvider. */
    <>
      <p className="text-sm text-muted-foreground">
        Log several machine issues at once, then submit them individually or all
        together.
      </p>
      <QuickReportGrid />
    </>
  );
}

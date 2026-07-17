import type React from "react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { createClient } from "~/lib/supabase/server";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
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

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  const accessLevel = getAccessLevel(profile?.role);

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

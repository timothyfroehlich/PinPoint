import type React from "react";
import { asc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "~/server/db";
import { machines, userProfiles } from "~/server/db/schema";
import { createClient } from "~/lib/supabase/server";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { getLoginUrl } from "~/lib/url";
import { Forbidden } from "~/components/errors/Forbidden";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { BulkReportGrid } from "./bulk-report-grid";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function BulkReportPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(getLoginUrl("/report/bulk"));

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  const accessLevel = getAccessLevel(profile?.role);

  if (!checkPermission("issues.report.bulk", accessLevel)) {
    return <Forbidden role={profile?.role ?? null} />;
  }

  const [machinesList, assignees] = await Promise.all([
    db.query.machines.findMany({
      orderBy: asc(machines.name),
      columns: { id: true, name: true, initials: true },
    }),
    db.query.userProfiles.findMany({
      where: (p) =>
        sql`${p.role} = 'admin' OR ${p.role} = 'member' OR ${p.role} = 'technician'`,
      columns: { id: true, name: true },
      orderBy: asc(userProfiles.name),
    }),
  ]);

  return (
    <PageContainer size="wide">
      <PageHeader title="Bulk Report" />
      <p className="mb-4 text-sm text-muted-foreground">
        Log several machine issues at once, then submit them individually or all
        together.
      </p>
      <BulkReportGrid machines={machinesList} assignees={assignees} />
    </PageContainer>
  );
}

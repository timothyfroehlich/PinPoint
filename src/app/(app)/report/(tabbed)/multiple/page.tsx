import type React from "react";
import { FilePenLine } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "~/components/ui/button";
import { checkPermission } from "~/lib/permissions/helpers";
import { getUserAccessLevel } from "~/lib/permissions/access";
import { createClient } from "~/lib/supabase/server";
import { getLoginUrl } from "~/lib/url";
import { QuickReportGrid } from "~/app/(app)/report/(tabbed)/quick/quick-report-grid";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function MultipleReportPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(getLoginUrl("/report/multiple"));
  const accessLevel = await getUserAccessLevel(user.id);
  if (!checkPermission("issues.report.quick", accessLevel)) redirect("/report");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Log several machine issues at once, then submit them individually or
          all together.
        </p>
        <Button asChild variant="outline">
          <Link href="/report/detailed">
            <FilePenLine aria-hidden="true" />
            Detailed report
          </Link>
        </Button>
      </div>
      <QuickReportGrid />
    </div>
  );
}

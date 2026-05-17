import type React from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { WatchMachineButton } from "~/components/machines/WatchMachineButton";
import { checkPermission, getAccessLevel } from "~/lib/permissions/index";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import { IssuesExpando } from "../issues-expando";
import { getMachineForLayout } from "../_data";

/**
 * Machine Maintenance Tab (/m/[initials]/maintenance)
 *
 * Hosts the open-issues list (and, in future iterations, full issue history +
 * scheduled maintenance). The data fetch shares a `cache()`-wrapped query with
 * the sibling layout so this is a free read within the same request.
 */
export default async function MachineMaintenanceTab({
  params,
}: {
  params: Promise<{ initials: string }>;
}): Promise<React.JSX.Element> {
  const { initials } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const currentUserProfile = user
    ? await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
        columns: { role: true },
      })
    : null;

  const accessLevel = getAccessLevel(currentUserProfile?.role);
  const canWatch = checkPermission("machines.watch", accessLevel);

  const { machine } = await getMachineForLayout(initials);
  if (!machine) {
    notFound();
  }

  const currentUserWatch = user
    ? machine.watchers.find((w) => w.userId === user.id)
    : undefined;
  const isWatching = !!currentUserWatch;
  const watchMode = currentUserWatch?.watchMode ?? "notify";

  const watchButton = canWatch ? (
    <WatchMachineButton
      machineId={machine.id}
      initialIsWatching={isWatching}
      initialWatchMode={watchMode}
    />
  ) : null;

  // Show only OPEN issues in the section — matches the tab badge's open
  // count + status color. Closed-issue visibility returns when the filter
  // bar lands (bead PP-0kta).
  const closedSet: ReadonlySet<string> = new Set(CLOSED_STATUSES);
  const openIssues = machine.issues.filter((i) => !closedSet.has(i.status));

  return (
    <div className="space-y-6">
      <IssuesExpando
        issues={openIssues}
        machineName={machine.name}
        machineInitials={machine.initials}
        watchButton={watchButton}
      />
    </div>
  );
}

import type React from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { WatchMachineButton } from "~/components/machines/WatchMachineButton";
import { MachineRecentActivity } from "~/components/machines/timeline/MachineRecentActivity";
import { checkPermission, getAccessLevel } from "~/lib/permissions/index";
import { MachineIssuesCard } from "~/app/(app)/m/[initials]/machine-issues-card";
import {
  getMachineForLayout,
  getMachineAllIssues,
} from "~/app/(app)/m/[initials]/_data";

/**
 * Machine Maintenance / Service Tab (/m/[initials]/maintenance) — the
 * maintainer's workbench (redesign PP-5sgt.3).
 *
 * Open Issues card (default) with a ⋯ menu (Open/All toggle, View-all link,
 * Export). The `?view=` search param drives the in-card list so the choice is
 * shareable and survives a reload. The data fetch shares a `cache()`-wrapped
 * query with the sibling layout so the open-issue read is free within the
 * request; the all-issues read is loaded lazily only when `?view=all`.
 */
export default async function MachineMaintenanceTab({
  params,
  searchParams,
}: {
  params: Promise<{ initials: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const { initials } = await params;
  const { view: viewParam } = await searchParams;
  const view = viewParam === "all" ? "all" : "open";

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
  const canCompose = checkPermission(
    "machines.timeline.comment.add",
    accessLevel
  );

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

  // Open is the default; the All view is loaded lazily only when requested.
  const issuesToShow =
    view === "all" ? await getMachineAllIssues(initials) : machine.issues;

  return (
    <div className="space-y-6">
      {watchButton ? (
        <div className="flex justify-end">{watchButton}</div>
      ) : null}
      <MachineIssuesCard
        issues={issuesToShow}
        machineName={machine.name}
        machineInitials={machine.initials}
        view={view}
      />
      {/* Activity feed (implements PP-7mjy) — reuses the real machine-timeline
          rows (comment / issue-event / lifecycle) and the "+ Add note"
          composer. The composer's server action (`addMachineCommentAction`) is
          already machine-id-parameterized, so it is reusable for the collection
          timeline (PP-slrd.2) without further factoring. */}
      <MachineRecentActivity
        machineId={machine.id}
        machineInitials={machine.initials}
        machineName={machine.name}
        canCompose={canCompose}
      />
    </div>
  );
}

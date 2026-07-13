import type React from "react";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { WatchMachineButton } from "~/components/machines/WatchMachineButton";
import { MachineRecentActivity } from "~/components/machines/timeline/MachineRecentActivity";
import {
  checkPermission,
  getAccessLevel,
  type OwnershipContext,
} from "~/lib/permissions/index";
import { deriveMachineStatus } from "~/lib/machines/status";
import { resolveRequestUrl } from "~/lib/url";
import { buildMachineReportUrl } from "~/lib/machines/report-url";
import { generateQrPngDataUrl } from "~/lib/machines/qr";
import { MachineIssuesCard } from "~/app/(app)/m/[initials]/machine-issues-card";
import { MachineOpsBox } from "~/app/(app)/m/[initials]/machine-ops-box";
import { MachineQrCard } from "~/app/(app)/m/[initials]/machine-qr-card";
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

  const ownershipContext: OwnershipContext = {
    userId: user?.id,
    machineOwnerId: machine.ownerId ?? undefined,
  };
  const canEditGeneral = checkPermission(
    "machines.edit",
    accessLevel,
    ownershipContext
  );
  const canViewOwnerRequirements = checkPermission(
    "machines.view.ownerRequirements",
    accessLevel
  );

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

  const machineStatus = deriveMachineStatus(machine.issues);

  // QR sticker → the machine's report page (relocated off the Info tab).
  const headersList = await headers();
  const reportUrl = buildMachineReportUrl({
    siteUrl: resolveRequestUrl(headersList),
    machineInitials: machine.initials,
    source: "qr",
  });

  // Open is the default; the All view is loaded lazily only when requested.
  // Resolve the QR PNG concurrently with the (optional) all-issues read.
  const [qrDataUrl, issuesToShow] = await Promise.all([
    generateQrPngDataUrl(reportUrl),
    view === "all"
      ? getMachineAllIssues(initials)
      : Promise.resolve(machine.issues),
  ]);

  // Two independent columns (design §4 / service-desktop mockup `.col`s): the
  // main column flows Open Issues → Activity; the 320px right rail stacks the
  // Machine box → QR. Each column sizes to its own content, so a short Open
  // Issues card no longer stretches to the tall Machine box — the previous 2×2
  // grid placed all four cards on shared rows, coupling their heights and
  // leaving dead space below the shorter card. On mobile the two columns
  // collapse into one flex stack in DOM reading order: Open Issues → Activity →
  // Machine box → QR.
  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_320px] md:items-start md:gap-6">
      <div className="flex flex-col gap-6 md:col-start-1">
        <MachineIssuesCard
          issues={issuesToShow}
          machineName={machine.name}
          machineInitials={machine.initials}
          view={view}
        />
        {/* Activity feed (implements PP-7mjy) — reuses the real machine-timeline
            rows (comment / issue-event / lifecycle) and the "+ Add note"
            composer. The composer's server action (`addMachineCommentAction`) is
            already machine-id-parameterized, so it is reusable for the
            collection timeline (PP-slrd.2) without further factoring. */}
        <MachineRecentActivity
          machineId={machine.id}
          machineInitials={machine.initials}
          machineName={machine.name}
          canCompose={canCompose}
        />
      </div>
      <div className="flex flex-col gap-6 md:col-start-2">
        <MachineOpsBox
          machineId={machine.id}
          machineStatus={machineStatus}
          presenceStatus={machine.presenceStatus}
          canEditPresence={canEditGeneral}
          watchButton={watchButton}
          ownerRequirements={machine.ownerRequirements}
          canViewOwnerRequirements={canViewOwnerRequirements}
          canEditGeneral={canEditGeneral}
        />
        <MachineQrCard
          machineName={machine.name}
          machineInitials={machine.initials}
          qrDataUrl={qrDataUrl}
          reportUrl={reportUrl}
        />
      </div>
    </div>
  );
}

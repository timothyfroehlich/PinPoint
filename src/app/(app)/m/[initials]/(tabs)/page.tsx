import type React from "react";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getUnifiedUsers } from "~/lib/users/queries";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { deriveMachineStatus } from "~/lib/machines/status";
import { resolveRequestUrl } from "~/lib/url";
import { buildMachineReportUrl } from "~/lib/machines/report-url";
import { generateQrPngDataUrl } from "~/lib/machines/qr";
import { EditButtonWithTooltip } from "../edit-button-tooltip";
import { EditMachineDialog } from "../update-machine-form";
import { QrCodeDialog } from "../qr-code-dialog";
import {
  MachineDescriptionField,
  MachineTextFields,
} from "../machine-text-fields";
import { MachineRecentActivity } from "~/components/machines/timeline/MachineRecentActivity";
import {
  getAccessLevel,
  checkPermission,
  getPermissionDeniedReason,
  type OwnershipContext,
} from "~/lib/permissions/index";
import { getMachineForLayout } from "../_data";
import { InfoHero } from "./info-hero";
import { InfoRail } from "./info-rail";

/**
 * Machine Info Tab (default route for /m/[initials]/) — the QR-scanning
 * player's landing (redesign PP-5sgt.2).
 *
 * Reading order (both breakpoints): Description (plain prose, no label) → Hero
 * (status + presence + Report button + known-issues peek) → reference cluster
 * (Tags / Owner / PinballMap) → recent-activity peek. Desktop is a main column
 * + 320px rail; mobile folds the rail inline after the hero.
 *
 * NOTE (PP-5sgt.3): the maintainer tools at the bottom — Edit dialog, QR code,
 * owner requirements/notes — are kept here temporarily. The Service-tab rework
 * relocates QR to Service and Edit/owner-fields to Settings/Service; remove
 * this block then.
 */
export default async function MachineInfoTab({
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

  const { machine } = await getMachineForLayout(initials);
  if (!machine) {
    notFound();
  }
  // `machine.issues` is open-only (filtered at the DB layer in `_data.ts`).
  const openIssues = machine.issues;

  const ownershipContext: OwnershipContext = {
    userId: user?.id,
    machineOwnerId: machine.ownerId ?? undefined,
  };

  const canEdit = checkPermission(
    "machines.edit",
    accessLevel,
    ownershipContext
  );
  const editDeniedReason = getPermissionDeniedReason(
    "machines.edit",
    accessLevel,
    ownershipContext
  );
  const canEditAnyMachine =
    accessLevel === "admin" || accessLevel === "technician";
  const isOwner =
    !!user &&
    (user.id === machine.ownerId || user.id === machine.invitedOwnerId);

  const canEditOwnerNotes = checkPermission(
    "machines.edit.ownerNotes",
    accessLevel,
    ownershipContext
  );
  const canViewOwnerRequirements = checkPermission(
    "machines.view.ownerRequirements",
    accessLevel
  );
  const canViewOwnerNotes = checkPermission(
    "machines.view.ownerNotes",
    accessLevel,
    ownershipContext
  );
  const canCompose = checkPermission(
    "machines.timeline.comment.add",
    accessLevel
  );

  const allUsersRaw = canEdit
    ? await getUnifiedUsers({ includeEmails: false })
    : [];
  const allUsers = allUsersRaw.map((u) => ({
    id: u.id,
    name: u.name,
    lastName: u.lastName,
    machineCount: u.machineCount,
    status: u.status,
    role: u.role,
  }));

  const machineStatus = deriveMachineStatus(openIssues);

  const headersList = await headers();
  const dynamicSiteUrl = resolveRequestUrl(headersList);
  const reportUrl = buildMachineReportUrl({
    siteUrl: dynamicSiteUrl,
    machineInitials: machine.initials,
    source: "qr",
  });
  const qrDataUrl = await generateQrPngDataUrl(reportUrl);

  const showOwnerFields = canViewOwnerRequirements || canViewOwnerNotes;

  const rail = (
    <InfoRail
      owner={machine.owner}
      invitedOwner={machine.invitedOwner}
      addedAt={machine.createdAt}
    />
  );

  return (
    <div className="md:grid md:grid-cols-[minmax(0,1fr)_320px] md:items-start md:gap-6">
      {/* Main column: Description → Hero → (mobile rail fold) → Recent
          activity → maintainer tools. */}
      <div className="flex flex-col gap-6">
        <MachineDescriptionField
          machineId={machine.id}
          description={machine.description}
          canEdit={canEdit}
        />

        <InfoHero
          machineInitials={machine.initials}
          machineStatus={machineStatus}
          presenceStatus={machine.presenceStatus}
          openIssues={openIssues}
          reportHref={`/report?machine=${machine.initials}`}
          serviceHref={`/m/${machine.initials}/maintenance`}
        />

        {/* Mobile: rail folds inline after the hero (Tags → Owner → PBM). */}
        <div className="flex flex-col gap-6 md:hidden">{rail}</div>

        <MachineRecentActivity
          machineId={machine.id}
          machineInitials={machine.initials}
          machineName={machine.name}
          canCompose={canCompose}
        />

        {/* Maintainer tools (QR shown to everyone, matching pre-redesign
            behavior; Edit + owner fields are permission-gated). */}
        <div className="space-y-4 border-t border-outline-variant pt-6">
          {showOwnerFields && (
            <MachineTextFields
              machineId={machine.id}
              description={machine.description}
              ownerRequirements={machine.ownerRequirements}
              ownerNotes={machine.ownerNotes}
              canEditGeneral={canEdit}
              canEditOwnerNotes={canEditOwnerNotes}
              canViewOwnerRequirements={canViewOwnerRequirements}
              canViewOwnerNotes={canViewOwnerNotes}
              showDescription={false}
            />
          )}
          <div className="flex flex-wrap gap-3">
            {canEdit && user ? (
              <EditMachineDialog
                machine={{
                  id: machine.id,
                  name: machine.name,
                  initials: machine.initials,
                  presenceStatus: machine.presenceStatus,
                  ownerId: machine.ownerId,
                  invitedOwnerId: machine.invitedOwnerId,
                  owner: machine.owner ? { name: machine.owner.name } : null,
                  invitedOwner: machine.invitedOwner
                    ? { name: machine.invitedOwner.name }
                    : null,
                }}
                allUsers={allUsers}
                canEditAnyMachine={canEditAnyMachine}
                isOwner={isOwner}
              />
            ) : user && editDeniedReason !== null ? (
              <EditButtonWithTooltip reason={editDeniedReason} />
            ) : null}
            <QrCodeDialog
              machineName={machine.name}
              machineInitials={machine.initials}
              qrDataUrl={qrDataUrl}
              reportUrl={reportUrl}
            />
          </div>
        </div>
      </div>

      {/* Desktop rail (hidden on mobile, where the fold above renders it). */}
      <aside className="hidden md:flex md:flex-col md:gap-6">{rail}</aside>
    </div>
  );
}

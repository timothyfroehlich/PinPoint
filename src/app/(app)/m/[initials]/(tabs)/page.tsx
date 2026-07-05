import type React from "react";
import { notFound } from "next/navigation";
import { getUnifiedUsers } from "~/lib/users/queries";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles, pinballmapCatalog } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { Calendar } from "lucide-react";
import { deriveMachineStatus } from "~/lib/machines/status";
import { MachineStatusBadge } from "~/components/machines/MachineStatusBadge";
import { MachinePresenceBadge } from "~/components/machines/MachinePresenceBadge";
import { formatDate } from "~/lib/dates";
import { headers } from "next/headers";
import { resolveRequestUrl } from "~/lib/url";
import { EditButtonWithTooltip } from "../edit-button-tooltip";
import { EditMachineDialog } from "../update-machine-form";
import { QrCodeDialog } from "../qr-code-dialog";
import { buildMachineReportUrl } from "~/lib/machines/report-url";
import { generateQrPngDataUrl } from "~/lib/machines/qr";
import { MachineTextFields } from "../machine-text-fields";
import { MachineRecentActivity } from "~/components/machines/timeline/MachineRecentActivity";
import {
  getAccessLevel,
  checkPermission,
  getPermissionDeniedReason,
  type OwnershipContext,
} from "~/lib/permissions/index";
import { getMachineForLayout } from "../_data";
import { PersonHoverCard } from "~/components/people/PersonHoverCard";

/**
 * Machine Info Tab (default route for /m/[initials]/)
 *
 * Renders the machine info card with metadata and text fields. The persistent
 * header zone + tab strip live in the sibling layout.tsx, and the open-issues
 * list lives in the sibling Maintenance tab (`./maintenance/page.tsx`).
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

  const { machine, totalIssuesCount } = await getMachineForLayout(initials);
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

  const canViewOwnerRequirements = checkPermission(
    "machines.view.ownerRequirements",
    accessLevel
  );
  const canCompose = checkPermission(
    "machines.timeline.comment.add",
    accessLevel
  );

  // PinballMap linking (bead B / PP-o355.2): the edit dialog exposes the picker
  // only to users who may link, and needs the linked title's display name (the
  // machine row stores only the PBM id + metadata, not the catalog name).
  const canLink = checkPermission(
    "machines.pinballmap.link",
    accessLevel,
    ownershipContext
  );
  let pinballmapTitleName: string | null = null;
  if (canLink && machine.pinballmapMachineId !== null) {
    const linkedTitle = await db.query.pinballmapCatalog.findFirst({
      where: eq(
        pinballmapCatalog.pinballmapMachineId,
        machine.pinballmapMachineId
      ),
      columns: { name: true },
    });
    pinballmapTitleName = linkedTitle?.name ?? null;
  }

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

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {/* All identity + stats in one 2-col grid: Owner / Added Date,
            Availability / Status, Open Issues / Total Issues. */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <div data-testid="owner-display">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Machine Owner
              </p>
              {machine.owner || machine.invitedOwner ? (
                <div className="flex items-center gap-2">
                  {/* Activated owners link to their collection view
                      (PP-slrd.1); invited owners have no userProfile, so
                      no collection page exists for them yet. */}
                  {machine.owner ? (
                    <PersonHoverCard
                      userId={machine.owner.id}
                      displayName={machine.owner.name}
                      className="text-sm font-medium text-foreground hover:text-primary hover:underline"
                    />
                  ) : (
                    <p className="text-sm font-medium text-foreground">
                      {machine.invitedOwner?.name}
                    </p>
                  )}
                  {machine.invitedOwner && !machine.owner && (
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      (Invited)
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No owner assigned
                </p>
              )}
            </div>

            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Added Date
              </p>
              <div className="flex items-center gap-1.5 text-foreground">
                <Calendar className="size-3 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {formatDate(machine.createdAt)}
                </p>
              </div>
            </div>

            {machine.manufacturer && (
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Manufacturer
                </p>
                <p className="text-sm font-medium text-foreground">
                  {machine.manufacturer}
                </p>
              </div>
            )}

            {machine.year !== null && (
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Year
                </p>
                <p className="text-sm font-medium text-foreground">
                  {machine.year}
                </p>
              </div>
            )}

            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Availability
              </p>
              <MachinePresenceBadge status={machine.presenceStatus} size="sm" />
            </div>

            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Status
              </p>
              <MachineStatusBadge status={machineStatus} size="xs" />
            </div>

            <div data-testid="detail-open-issues">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Open Issues
              </p>
              <p
                className="text-xl font-bold text-foreground"
                data-testid="detail-open-issues-count"
              >
                {openIssues.length}
              </p>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Total Issues
              </p>
              <p className="text-xl font-bold text-foreground">
                {totalIssuesCount}
              </p>
            </div>
          </div>

          {/* Machine actions — Edit + QR. Sit at the bottom of the left column
            so identity + stats read first. QR shows for everyone; Edit shows
            as enabled for owner/admin, or as a disabled tooltip for other
            auth'd users (guest / non-owner member). */}
          <div className="space-y-3">
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
                  pinballmapMachineId: machine.pinballmapMachineId,
                  pinballmapExcluded: machine.pinballmapExcluded,
                  pinballmapExcludedReason: machine.pinballmapExcludedReason,
                  pinballmapTitleName,
                }}
                allUsers={allUsers}
                canEditAnyMachine={canEditAnyMachine}
                isOwner={isOwner}
                canLink={canLink}
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

        <div className="border-t border-outline-variant/50 pt-4 lg:border-t-0 lg:pt-0">
          <MachineTextFields
            machineId={machine.id}
            description={machine.description}
            ownerRequirements={machine.ownerRequirements}
            canEditGeneral={canEdit}
            canViewOwnerRequirements={canViewOwnerRequirements}
          />
        </div>
      </div>
      <MachineRecentActivity
        machineId={machine.id}
        machineInitials={machine.initials}
        machineName={machine.name}
        canCompose={canCompose}
      />
    </div>
  );
}

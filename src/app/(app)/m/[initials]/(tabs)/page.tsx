import type React from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getUnifiedUsers } from "~/lib/users/queries";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles, pinballmapCatalog } from "~/server/db/schema";
import { deriveMachineStatus } from "~/lib/machines/status";
import { EditButtonWithTooltip } from "../edit-button-tooltip";
import { EditMachineDialog } from "../update-machine-form";
import { RichTextDisplay } from "~/components/editor/RichTextDisplay";
import { docIsEmpty } from "~/lib/tiptap/types";
import { MachineRecentActivity } from "~/components/machines/timeline/MachineRecentActivity";
import {
  getAccessLevel,
  checkPermission,
  getPermissionDeniedReason,
  type OwnershipContext,
} from "~/lib/permissions/index";
import { getMachineForLayout } from "../_data";
import { pinballmapLocationUrl } from "~/lib/pinballmap/public-url";
import { getPinballMapState } from "~/lib/pinballmap/state";
import { derivePbmMachineStatus } from "~/lib/pinballmap/sync";
import { InfoHero } from "./info-hero";
import { InfoRail } from "./info-rail";
import { MachinePinballmapCard } from "./machine-pinballmap-card";

/**
 * Machine Info Tab (default route for /m/[initials]/) — the QR-scanning
 * player's landing (redesign PP-5sgt.2).
 *
 * Reading order (both breakpoints): Hero (status + presence + Report button +
 * known-issues peek) → reference cluster (Details card: machine description +
 * owner, then Tags / PinballMap placeholders) → recent-activity peek. Desktop
 * is a main column + 320px rail; mobile folds the rail inline after the hero.
 *
 * Maintainer/owner-private tools (QR code, Owner's Requirements) live on the
 * Service tab (the maintainer's workbench, PP-5sgt.3) — not here. The player
 * landing carries only player-facing content; Edit lives in the Details card.
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
  const machineStatus = deriveMachineStatus(openIssues);

  // Both reads are independent — resolve them concurrently so the QR-scan
  // landing doesn't stack the PinballMap lookup and the unified-user list.
  const pinballmapTitlePromise: Promise<string | null> =
    canLink && machine.pinballmapMachineId !== null
      ? db.query.pinballmapCatalog
          .findFirst({
            where: eq(
              pinballmapCatalog.pinballmapMachineId,
              machine.pinballmapMachineId
            ),
            columns: { name: true },
          })
          .then((linkedTitle) => linkedTitle?.name ?? null)
      : Promise.resolve(null);
  const allUsersPromise: Promise<Awaited<ReturnType<typeof getUnifiedUsers>>> =
    canEdit ? getUnifiedUsers({ includeEmails: false }) : Promise.resolve([]);
  // The stored PBM snapshot drives the desync signal, which is a maintainer-
  // facing alert (it points at a mismatch to resolve). Only read it when the
  // viewer may act on it (`canLink`) AND the machine is linked — so the public
  // QR-scan landing never pays for (or shows) it. Location-wide singleton.
  const pbmStatePromise: Promise<
    Awaited<ReturnType<typeof getPinballMapState>>
  > =
    canLink && machine.pinballmapMachineId !== null
      ? getPinballMapState()
      : Promise.resolve(null);

  const [pinballmapTitleName, allUsersRaw, pbmState] = await Promise.all([
    pinballmapTitlePromise,
    allUsersPromise,
    pbmStatePromise,
  ]);
  const allUsers = allUsersRaw.map((u) => ({
    id: u.id,
    name: u.name,
    lastName: u.lastName,
    machineCount: u.machineCount,
    status: u.status,
    role: u.role,
  }));

  // Description renders read-only inside the Details card; editing happens in
  // the Edit Machine dialog (not inline). Gate on docIsEmpty rather than just
  // `!== null`: a legacy or semantically-empty ProseMirror doc renders nothing
  // in RichTextDisplay, but a truthy slot still paints an empty prose block and
  // a stray divider above the owner row. docIsEmpty covers null, undefined, and
  // whitespace-only docs.
  const descriptionSlot = !docIsEmpty(machine.description) ? (
    <RichTextDisplay content={machine.description} />
  ) : null;

  // Edit-machine control lives in the owner card. PP-o355.2 PinballMap fields
  // are wired through the dialog for users who may link.
  const editControl =
    canEdit && user ? (
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
          pinballmapListed: machine.pinballmapListed,
          pinballmapTitleName,
          description: machine.description,
        }}
        allUsers={allUsers}
        canEditAnyMachine={canEditAnyMachine}
        isOwner={isOwner}
        canLink={canLink}
      />
    ) : user && editDeniedReason !== null ? (
      <EditButtonWithTooltip reason={editDeniedReason} />
    ) : null;

  // PinballMap card (PP-o355.3 + desync PP-o355.11): everyone sees the plain
  // "View on PinballMap" card for listed machines. The desync alert is
  // maintainer-only (`canLink`) — for those users the card also appears on a
  // desynced-but-not-listed machine (e.g. on PBM but not marked listed here),
  // so the mismatch surfaces where it can be acted on. `pbmState` is null for
  // non-maintainers, so `desynced` is false for them regardless.
  const pbmStatus = derivePbmMachineStatus({
    pinballmapMachineId: machine.pinballmapMachineId,
    pinballmapListed: machine.pinballmapListed,
    pinballmapLmxId: machine.pinballmapLmxId,
    snapshot: pbmState?.snapshotJson ?? null,
  });
  const showDesync = canLink && pbmStatus.desynced;
  const pinballmapCard =
    machine.pinballmapListed || showDesync ? (
      <MachinePinballmapCard
        locationUrl={pinballmapLocationUrl()}
        desynced={showDesync}
        desyncReason={pbmStatus.reason}
      />
    ) : null;

  const rail = (
    <InfoRail
      owner={machine.owner}
      invitedOwner={machine.invitedOwner}
      addedAt={machine.createdAt}
      descriptionSlot={descriptionSlot}
      editSlot={editControl}
      pinballmapSlot={pinballmapCard}
    />
  );

  // Single grid in DOM reading order: Hero → reference rail (Details card:
  // description + owner, then Tags / PinballMap) → recent activity. On mobile
  // it's one flex column (the rail folds inline after the hero). On desktop the
  // rail is pinned to the 320px right column, spanning the main column's rows;
  // everything else auto-flows down column 1. Rendered once so test ids stay
  // unique.
  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_320px] md:gap-6">
      <InfoHero
        machineInitials={machine.initials}
        machineStatus={machineStatus}
        presenceStatus={machine.presenceStatus}
        openIssues={openIssues}
        reportHref={`/report?machine=${machine.initials}`}
        serviceHref={`/m/${machine.initials}/maintenance`}
      />

      <aside className="flex flex-col gap-6 md:col-start-2 md:row-start-1 md:row-span-6">
        {rail}
      </aside>

      <MachineRecentActivity
        machineId={machine.id}
        machineInitials={machine.initials}
        machineName={machine.name}
        canCompose={canCompose}
      />
    </div>
  );
}

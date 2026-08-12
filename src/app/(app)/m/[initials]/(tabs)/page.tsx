import type React from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { deriveMachineStatus } from "~/lib/machines/status";
import { RichTextDisplay } from "~/components/editor/RichTextDisplay";
import { docIsEmpty } from "~/lib/tiptap/types";
import { MachineRecentActivity } from "~/components/machines/timeline/MachineRecentActivity";
import {
  getAccessLevel,
  checkPermission,
  type OwnershipContext,
} from "~/lib/permissions/index";
import { getMachineForLayout } from "../_data";
import { pinballmapLocationUrl } from "~/lib/pinballmap/public-url";
import { getPinballMapState } from "~/lib/pinballmap/state";
import {
  derivePbmMachineStatus,
  isActionableDesync,
} from "~/lib/pinballmap/status";
import { listAbandonedForMachine } from "~/lib/pinballmap/abandoned-listings";
import { getCatalogEntry } from "~/lib/pinballmap/catalog";
import { InfoHero } from "./info-hero";
import { InfoRail } from "./info-rail";

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

  const canCompose = checkPermission(
    "machines.timeline.comment.add",
    accessLevel
  );

  const machineStatus = deriveMachineStatus(openIssues);

  // Description renders read-only inside the Details card; editing happens on
  // the Edit Machine page (not inline). Gate on docIsEmpty rather than just
  // `!== null`: a legacy or semantically-empty ProseMirror doc renders nothing
  // in RichTextDisplay, but a truthy slot still paints an empty prose block and
  // a stray divider above the owner row. docIsEmpty covers null, undefined, and
  // whitespace-only docs.
  const descriptionSlot = !docIsEmpty(machine.description) ? (
    <RichTextDisplay content={machine.description} />
  ) : null;

  // Model — the game's identity, shown to everyone. Unlike the PinballMap card
  // this replaces (PP-o355.21), it is not permission-gated: what game a cabinet
  // is is public. It is also catalog data rather than location data, so it
  // carries no CORE-PBM-001 link obligation of its own — the Pinball Map row
  // beneath it does, and always links.
  //
  // The catalog row can be missing (never refreshed, or the title retired) for
  // a machine that is nonetheless linked. Naming the id beats claiming there is
  // no model at all; "Not specified" is reserved for a machine with no catalog
  // match, which is a different and correctable state (PP-3bbr).
  //
  // Two sources, never both at once — the DB CHECK
  // `machines_model_name_requires_excluded` is what makes "never both" a fact
  // rather than a convention, so there is no precedence rule to get wrong: a
  // linked machine reads the catalog, an off-catalog one reads its own column
  // (PP-3bbr).
  const linkedTitleEntry =
    machine.pinballmapMachineId !== null
      ? await getCatalogEntry(machine.pinballmapMachineId)
      : null;
  const modelName =
    machine.pinballmapMachineId === null
      ? machine.modelName
      : (linkedTitleEntry?.name ??
        `Pinball Map title #${String(machine.pinballmapMachineId)}`);

  // The Config-issue warning. Two unrelated disagreements raise it, which is
  // why its label is generic: an entry left live on the public map under a
  // title this machine no longer uses (PP-l81u), or an actionable desync
  // between our records and the stored snapshot (PP-o355.11).
  //
  // Gated on `machines.pinballmap.diagnose` rather than `machines.pinballmap.
  // link` because a member holds `link` only for machines they own, and a wrong
  // entry on a public map is something any member may be the one to notice. The
  // warning is read-only — it links to the Manage tab, where the controls
  // re-check `link` and `push`.
  const canDiagnose = checkPermission(
    "machines.pinballmap.diagnose",
    accessLevel,
    ownershipContext
  );
  // Both reads are skipped for viewers who would not see the result, so the
  // public QR-scan landing pays for neither. The snapshot is a location-wide
  // singleton; the abandonment query is machine-scoped.
  const pbmState = canDiagnose ? await getPinballMapState() : null;
  const desynced = isActionableDesync(
    derivePbmMachineStatus({
      pinballmapMachineId: machine.pinballmapMachineId,
      pinballmapListed: machine.pinballmapListed,
      pinballmapLmxId: machine.pinballmapLmxId,
      snapshot: pbmState?.snapshotJson ?? null,
    })
  );
  const configIssue =
    canDiagnose &&
    (desynced || (await listAbandonedForMachine(machine.id)).length > 0);

  const rail = (
    <InfoRail
      owner={machine.owner}
      invitedOwner={machine.invitedOwner}
      addedAt={machine.createdAt}
      descriptionSlot={descriptionSlot}
      modelName={modelName}
      pinballmap={{
        locationUrl: pinballmapLocationUrl(),
        listed: machine.pinballmapListed,
        configIssue,
        manageHref: `/m/${machine.initials}/edit`,
      }}
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

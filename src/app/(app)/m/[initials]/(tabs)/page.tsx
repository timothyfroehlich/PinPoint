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
import { derivePbmMachineStatus } from "~/lib/pinballmap/sync";
import { listAbandonedForMachine } from "~/lib/pinballmap/abandoned-listings";
import { getCatalogEntry } from "~/lib/pinballmap/catalog";
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

  const canCompose = checkPermission(
    "machines.timeline.comment.add",
    accessLevel
  );

  // PinballMap linking (bead B / PP-o355.2) gates the maintainer-facing desync
  // signal below. The catalog picker itself moved to the edit page
  // (PP-o355.19), so this landing no longer resolves the linked title's display
  // name or the unified-user list — both were dialog-only reads.
  const canLink = checkPermission(
    "machines.pinballmap.link",
    accessLevel,
    ownershipContext
  );
  const machineStatus = deriveMachineStatus(openIssues);

  // The stored PBM snapshot drives the desync signal, which is a maintainer-
  // facing alert (it points at a mismatch to resolve). Only read it when the
  // viewer may act on it (`canLink`) AND the machine is linked — so the public
  // QR-scan landing never pays for (or shows) it. Location-wide singleton.
  const pbmState =
    canLink && machine.pinballmapMachineId !== null
      ? await getPinballMapState()
      : null;

  // Description renders read-only inside the Details card; editing happens on
  // the Edit Machine page (not inline). Gate on docIsEmpty rather than just
  // `!== null`: a legacy or semantically-empty ProseMirror doc renders nothing
  // in RichTextDisplay, but a truthy slot still paints an empty prose block and
  // a stray divider above the owner row. docIsEmpty covers null, undefined, and
  // whitespace-only docs.
  const descriptionSlot = !docIsEmpty(machine.description) ? (
    <RichTextDisplay content={machine.description} />
  ) : null;

  // PinballMap card (PP-o355.3 + desync PP-o355.11 + abandoned listings
  // PP-l81u): everyone sees the plain "View on PinballMap" card for listed
  // machines. The desync alert and the abandoned-listing notice are both
  // maintainer-only (`canLink`) — for those users the card also appears on a
  // desynced-but-not-listed machine (e.g. on PBM but not marked listed here)
  // or on an unlisted machine with something abandoned still live under its
  // old title, so the mismatch surfaces where it can be acted on. `pbmState`
  // is null for non-maintainers, so `desynced` is false for them regardless;
  // the abandoned-listing query is likewise skipped for them.
  const pbmStatus = derivePbmMachineStatus({
    pinballmapMachineId: machine.pinballmapMachineId,
    pinballmapListed: machine.pinballmapListed,
    pinballmapLmxId: machine.pinballmapLmxId,
    snapshot: pbmState?.snapshotJson ?? null,
  });
  const showDesync = canLink && pbmStatus.desynced;

  const abandonedRows = canLink
    ? await listAbandonedForMachine(machine.id)
    : [];
  const abandoned = await Promise.all(
    abandonedRows.map(async (row) => {
      const entry = await getCatalogEntry(row.pinballmapMachineId);
      return {
        lmxId: row.lmxId,
        // The catalog row can disappear; the entry on PBM does not. The card
        // falls back to naming the id so the notice still points at something.
        title: entry?.name ?? null,
      };
    })
  );

  // The machine's own current standing, stated above any alert. The abandoned
  // notice necessarily names a DIFFERENT title than this machine's, so without
  // this line the reader's first thought is "wrong machine", not "task to do".
  const linkedTitleEntry =
    machine.pinballmapMachineId === null
      ? null
      : await getCatalogEntry(machine.pinballmapMachineId);
  // A machine that just abandoned an entry is by definition not listed, and
  // `derivePbmMachineStatus` reports it `ok` (it points at a new title and
  // correctly has no listing under it) — so without this disjunct the card
  // would never render for the one case this bead exists to surface.
  const showAbandoned = canLink && abandoned.length > 0;
  const pinballmapCard =
    machine.pinballmapListed || showDesync || showAbandoned ? (
      <MachinePinballmapCard
        locationUrl={pinballmapLocationUrl()}
        desynced={showDesync}
        desyncReason={pbmStatus.reason}
        linkedTitle={linkedTitleEntry?.name ?? null}
        listed={machine.pinballmapListed}
        abandoned={abandoned}
      />
    ) : null;

  const rail = (
    <InfoRail
      owner={machine.owner}
      invitedOwner={machine.invitedOwner}
      addedAt={machine.createdAt}
      descriptionSlot={descriptionSlot}
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

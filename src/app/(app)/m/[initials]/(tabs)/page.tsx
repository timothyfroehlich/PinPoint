import type React from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { machines, userProfiles } from "~/server/db/schema";
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
  derivePbmListingView,
  type PbmSiblingInput,
} from "~/lib/pinballmap/listing-state";
import { listSurfacingAbandonedForMachine } from "~/lib/pinballmap/abandoned-listings";
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
  // Derived once in `getMachineForLayout` rather than here, because the header
  // above this card renders the same fact and the two disagreeing would be a
  // bug nobody could see (PP-3bbr.1). That loader is `cache()`d, so reading it
  // here costs nothing the layout has not already paid.
  const modelName = machine.modelTitle;

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
  // The lineup is read for EVERYONE, not just diagnosers: the rail's one
  // Pinball Map line says whether the location's lineup carries this title, and
  // that sentence is shown to the signed-out visitor who scanned the QR code.
  // Gating it would make that line read "Not on Pinball Map" for every machine
  // whenever the viewer lacked the capability — the same confident wrong answer
  // the old control gave APC's whole fleet (CORE-ARCH-012). It is one
  // location-wide singleton row.
  const pbmState = await getPinballMapState();
  const configured = pbmState?.locationId != null;
  const snapshot = configured ? (pbmState.snapshotJson ?? null) : null;

  // The same-title group is diagnose-only, because coverage feeds nothing but
  // the Config-issue warning. It has to be read for THAT, though: coverage is
  // what separates Covered (quiet) from Lingering (out of sync), so deriving
  // without it would raise a warning on a machine whose entry a sibling covers
  // — and send the reader to a Manage tab that says everything is fine.
  const sameTitle: PbmSiblingInput[] =
    canDiagnose && machine.pinballmapMachineId !== null
      ? await db
          .select({
            id: machines.id,
            initials: machines.initials,
            name: machines.name,
            intent: machines.pinballmapIntent,
          })
          .from(machines)
          .where(eq(machines.pinballmapMachineId, machine.pinballmapMachineId))
      : [];

  const listingView = derivePbmListingView({
    machineId: machine.id,
    pinballmapMachineId: machine.pinballmapMachineId,
    pinballmapExcluded: machine.pinballmapExcluded,
    intent: machine.pinballmapIntent,
    presenceStatus: machine.presenceStatus,
    configured,
    snapshot,
    siblings: sameTitle,
  });
  const configIssue =
    canDiagnose &&
    configured &&
    (listingView.outOfSync ||
      // The SAME filter the Manage tab's alert applies (spec 2.5). The chip's
      // only job is to send a reader there, so an unfiltered count here fires
      // on entries the alert then hides and points at a page showing nothing
      // wrong.
      (await listSurfacingAbandonedForMachine(machine.id)).length > 0);

  // The Manage tab gates on `machines.edit`, which is a narrower grant than
  // `diagnose` — so a member who can see the warning may not be able to open
  // the page it would link to.
  const canOpenManage = checkPermission(
    "machines.edit",
    accessLevel,
    ownershipContext
  );

  const rail = (
    <InfoRail
      owner={machine.owner}
      invitedOwner={machine.invitedOwner}
      addedAt={machine.createdAt}
      descriptionSlot={descriptionSlot}
      modelName={modelName}
      manufacturer={machine.manufacturer}
      year={machine.year}
      pinballmap={{
        locationUrl:
          pbmState?.locationId != null
            ? pinballmapLocationUrl(pbmState.locationId)
            : null,
        // `observed` is false both for "the lineup does not carry it" and for
        // "there is no lineup yet", and the rail would render the first as a
        // fact. Waiting reports unknown instead.
        onLineup: listingView.name === "waiting" ? null : listingView.observed,
        configIssue,
        manageHref: canOpenManage ? `/m/${machine.initials}/edit` : null,
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

import type React from "react";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles, pinballmapCatalog, machines } from "~/server/db/schema";
import {
  getAccessLevel,
  checkPermission,
  type OwnershipContext,
} from "~/lib/permissions/index";
import { pinballmapLocationUrl } from "~/lib/pinballmap/public-url";
import { APC_LOCATION_ID } from "~/lib/pinballmap/config";
import {
  getPinballMapState,
  getRefreshAllowance,
} from "~/lib/pinballmap/state";
import {
  derivePbmListingView,
  type PbmSiblingInput,
} from "~/lib/pinballmap/listing-state";
import { findLmxForMachine } from "~/lib/pinballmap/resolve-lmx";
import { listSurfacingAbandonedForMachine } from "~/lib/pinballmap/abandoned-listings";
import { getCatalogEntry } from "~/lib/pinballmap/catalog";
import { PinballmapListingControl } from "~/components/machines/PinballmapListingControl";
import { PinballmapAbandonedEntries } from "~/components/machines/PinballmapAbandonedEntries";
import { getUnifiedUsers } from "~/lib/users/queries";
import { getMachineForLayout } from "~/app/(app)/m/[initials]/_data";
import { MachineDetailsForm } from "./machine-details-form";
import { MachineOwnerTransfer } from "./machine-owner-transfer";

/**
 * Machine Manage tab (/m/[initials]/edit) — PP-o355.19.
 *
 * URL slug stays `edit`; the visible tab label is "Manage" (see
 * MachineTabStrip for why).
 *
 * Replaces the Edit Machine modal. The driver was never size alone: **a route
 * lets sections have different save models.** Details fields belong to one
 * Save; ownership transfer is its own deliberate act; PinballMap operations
 * write to a third-party service, can fail, and need to report — none of which
 * a modal that dismisses on save can do.
 *
 * Lives INSIDE the `(tabs)` group, so the machine header, tab strip, and
 * translite come from the shared layout and this file renders only the panel.
 * The Manage tab itself is hidden from viewers who lack `machines.edit`, so the
 * redirect below is the deep-link guard, not the primary gate.
 *
 * Removing the Dialog wrapper also removes PP-o355.13's repro path — a Radix
 * popover portalled to <body> being read as an outside-click and dismissing the
 * whole modal.
 */
export default async function MachineEditPage({
  params,
}: {
  params: Promise<{ initials: string }>;
}): Promise<React.JSX.Element> {
  const { initials } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { machine } = await getMachineForLayout(initials);
  if (!machine) {
    notFound();
  }

  // `getMachineForLayout` spreads `PBM_METADATA_PLACEHOLDER` over the row, which
  // forces `manufacturer` and `year` to null — it predates those columns
  // existing and is still right for the header, which has no real source for
  // `edition`/`backboxImageUrl` either. It is wrong for THIS form: the
  // hand-entered model fields (PP-3bbr) would open blank on a machine that has
  // them, and saving that blank state writes the nulls back. `modelName` is not
  // in the placeholder, so it survives — which is exactly what made the
  // inconsistency easy to miss. Read the three together, from the row.
  const modelFields = await db.query.machines.findFirst({
    where: eq(machines.initials, initials),
    columns: { modelName: true, manufacturer: true, year: true },
  });

  const currentUserProfile = user
    ? await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
        columns: { role: true },
      })
    : null;

  const accessLevel = getAccessLevel(currentUserProfile?.role);
  const ownershipContext: OwnershipContext = {
    userId: user?.id,
    machineOwnerId: machine.ownerId ?? undefined,
  };

  // Send anyone who may not edit back to the machine's Info tab. They never see
  // the Manage tab, so this only fires on a deep link or a stale bookmark. A bare
  // 404 would be a lie — the machine exists, the viewer just cannot edit it.
  if (
    !user ||
    !checkPermission("machines.edit", accessLevel, ownershipContext)
  ) {
    redirect(`/m/${initials}`);
  }

  // The three Pinball Map capabilities, spec 8.1 / 8.2 / 8.3. `link` and `push`
  // resolve to the same tier today and `sync` is wider than both, but they are
  // checked separately because they answer different questions and the matrix
  // is free to move one without the others (CORE-ARCH-008).
  const canSetIntent = checkPermission(
    "machines.pinballmap.link",
    accessLevel,
    ownershipContext
  );
  const canRefresh = checkPermission(
    "machines.pinballmap.sync",
    accessLevel,
    ownershipContext
  );
  const canPush = checkPermission(
    "machines.pinballmap.push",
    accessLevel,
    ownershipContext
  );

  const pinballmapTitlePromise: Promise<string | null> =
    machine.pinballmapMachineId !== null
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

  // Every cabinet sharing this title — what decides coverage (spec §1, 4.7).
  // Small by construction: the group is keyed on one catalog title, so it is one
  // cabinet in almost every case and a handful in the worst. Skipped for an
  // unmatched machine, which has no title to share.
  const sameTitlePromise: Promise<PbmSiblingInput[]> =
    machine.pinballmapMachineId !== null
      ? db
          .select({
            id: machines.id,
            initials: machines.initials,
            name: machines.name,
            intent: machines.pinballmapIntent,
          })
          .from(machines)
          .where(eq(machines.pinballmapMachineId, machine.pinballmapMachineId))
      : Promise.resolve([]);

  const [pinballmapTitleName, pbmState, allUsersRaw, sameTitle, allowance] =
    await Promise.all([
      pinballmapTitlePromise,
      getPinballMapState(),
      getUnifiedUsers({ includeEmails: false }),
      sameTitlePromise,
      getRefreshAllowance(),
    ]);

  const allUsers = allUsersRaw.map((u) => ({
    id: u.id,
    name: u.name,
    lastName: u.lastName,
    machineCount: u.machineCount,
    status: u.status,
    role: u.role,
  }));

  const snapshot = pbmState?.snapshotJson ?? null;

  // The control's whole view is DERIVED here and handed down — nothing in it
  // discovers state by calling Pinball Map (CORE-PBM-001, PP-o355.21).
  const listingView = derivePbmListingView({
    machineId: machine.id,
    pinballmapMachineId: machine.pinballmapMachineId,
    pinballmapExcluded: machine.pinballmapExcluded,
    intent: machine.pinballmapIntent,
    presenceStatus: machine.presenceStatus,
    snapshot,
    siblings: sameTitle,
  });

  // The remove confirm's comment count (spec 4.6). Null when there is no entry
  // to count comments on, which the confirm says outright rather than showing a
  // zero it cannot stand behind.
  const commentCount =
    snapshot !== null && machine.pinballmapMachineId !== null
      ? (findLmxForMachine(snapshot, machine.pinballmapMachineId)?.conditions
          .length ?? null)
      : null;

  // Whether an operator credential exists at all — read off the two columns the
  // state row already carries, never by decrypting the token. Without one the
  // outbound writes cannot run, so Add / Remove are absent rather than present
  // and failing (CORE-ARCH-012).
  const writeEnabled =
    pbmState?.outboundEmail != null && pbmState.outboundTokenVaultId != null;

  // Entries left on the public lineup by an earlier re-match (PP-l81u).
  //
  // **Only the ones whose title has left the fleet entirely** (spec 2.5). While
  // any cabinet is still matched to the old title, the entry is that title's
  // ordinary business and already shows through those cabinets' own states —
  // surfacing it here as well would put the same entry on two pages with two
  // different explanations, and this is the page whose explanation is wrong
  // (the machine here is not the one that title belongs to any more).
  //
  // Note the test is MATCHED, not covered: a sibling matched to the old title
  // with intent Off renders Lingering and offers the same Remove, so it is
  // already handled even though nothing covers the entry.
  //
  // The catalog row can disappear while the entry on Pinball Map outlives it,
  // so a null title falls back to naming the entry by id rather than inventing
  // one.
  const abandonedRows = await listSurfacingAbandonedForMachine(machine.id);
  const abandoned = await Promise.all(
    abandonedRows.map(async (row) => ({
      lmxId: row.lmxId,
      title: (await getCatalogEntry(row.pinballmapMachineId))?.name ?? null,
      commentCount:
        snapshot?.lmxes.find((l) => l.id === row.lmxId)?.conditions.length ??
        null,
    }))
  );

  const canEditAnyMachine =
    accessLevel === "admin" || accessLevel === "technician";
  const isOwner =
    user.id === machine.ownerId || user.id === machine.invitedOwnerId;

  const locationUrl = pinballmapLocationUrl(
    pbmState?.locationId ?? APC_LOCATION_ID
  );

  return (
    // Capped at 4xl rather than filling the tab strip's width: these are form
    // fields, and a full-width text input on a wide monitor is a worse target
    // than a measured column. `@container` is what lets the fields inside pair
    // up two-up at `@xl` — they respond to THIS panel's width, not the
    // viewport's (CORE-RESP-001..004), so the pairing behaves the same whether
    // or not a future layout puts something beside it.
    <div className="@container max-w-4xl space-y-5">
      {/* Details — these fields save together. */}
      <section className="space-y-4" aria-labelledby="section-details">
        <h2 id="section-details" className="text-base font-semibold">
          Details
        </h2>
        <MachineDetailsForm
          machineId={machine.id}
          name={machine.name}
          presenceStatus={machine.presenceStatus}
          description={machine.description}
          canLink={canSetIntent}
          pinballmapMachineId={machine.pinballmapMachineId}
          pinballmapExcluded={machine.pinballmapExcluded}
          pinballmapExcludedReason={machine.pinballmapExcludedReason}
          pinballmapTitleName={pinballmapTitleName}
          modelName={modelFields?.modelName ?? null}
          manufacturer={modelFields?.manufacturer ?? null}
          year={modelFields?.year ?? null}
        />
      </section>

      {/* Pinball Map — no save bar: every control here acts on its own, and
          the section heading lives inside the control (its header carries the
          location name, the refresh state and the out-of-sync alert). */}
      <section
        className="space-y-4 border-t border-outline-variant pt-6"
        aria-labelledby="section-pinballmap"
      >
        <h2 id="section-pinballmap" className="sr-only">
          Pinball Map
        </h2>

        <PinballmapListingControl
          machineId={machine.id}
          view={listingView}
          locationName={snapshot?.name ?? null}
          locationUrl={locationUrl}
          lastRefreshedAt={pbmState?.lastSyncedAt ?? null}
          refreshRemaining={allowance.remaining}
          refreshAvailableAt={allowance.nextRefillAt}
          canSetIntent={canSetIntent}
          canPush={canPush}
          canRefresh={canRefresh}
          writeEnabled={writeEnabled}
          modelName={pinballmapTitleName}
          commentCount={commentCount}
        />

        {/* Entries this machine walked away from that are still live on the
            public map (PP-l81u). Spec 2.5 routes them here only once NO cabinet
            carries the old title any more — while one does, the entry is that
            title's ordinary business and shows through those cabinets' own
            states. The Info tab's "Config issue" warning links here, so this is
            where that trail has to end. */}
        {abandoned.length > 0 ? (
          <PinballmapAbandonedEntries
            machineId={machine.id}
            entries={abandoned}
            locationUrl={locationUrl}
            canPush={canPush && writeEnabled}
          />
        ) : null}
      </section>

      {/* Danger zone — applies immediately. Machine deletion joins this
          section in PP-o355.25. */}
      <section
        className="space-y-4 border-t border-outline-variant pt-6"
        aria-labelledby="section-danger"
      >
        <h2 id="section-danger" className="text-base font-semibold">
          Danger zone
        </h2>
        <div className="rounded-lg border border-destructive/35 px-4 py-2">
          <MachineOwnerTransfer
            machineId={machine.id}
            machineName={machine.name}
            ownerId={machine.ownerId}
            invitedOwnerId={machine.invitedOwnerId}
            ownerName={machine.owner?.name ?? null}
            invitedOwnerName={machine.invitedOwner?.name ?? null}
            allUsers={allUsers}
            canEditAnyMachine={canEditAnyMachine}
            isOwner={isOwner}
          />
        </div>
      </section>
    </div>
  );
}

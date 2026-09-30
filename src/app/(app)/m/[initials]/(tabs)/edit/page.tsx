import type React from "react";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles, machines } from "~/server/db/schema";
import {
  getAccessLevel,
  checkPermission,
  canAccessMachineManage,
  type OwnershipContext,
} from "~/lib/permissions/index";
import { pinballmapLocationUrl } from "~/lib/pinballmap/public-url";
import {
  getPinballMapState,
  getRefreshAllowance,
} from "~/lib/pinballmap/state";
import {
  derivePbmListingView,
  type PbmSiblingInput,
} from "~/lib/pinballmap/listing-state";
import { listSurfacingAbandonedForMachine } from "~/lib/pinballmap/abandoned-listings";
import { getCatalogEntry } from "~/lib/pinballmap/catalog";
import { PinballmapListingControl } from "~/components/machines/PinballmapListingControl";
import {
  deriveInsiderConnectedView,
  withInsiderConnected,
  type PbmIcIntent,
} from "~/lib/pinballmap/insider-connected";
import { PinballmapAbandonedEntries } from "~/components/machines/PinballmapAbandonedEntries";
import { getUnifiedUsers } from "~/lib/users/queries";
import { getMachineForLayout } from "~/app/(app)/m/[initials]/_data";
import { ApronCardPanel } from "~/app/(app)/m/[initials]/apron/ApronCardPanel";
import { MachineDetailsForm } from "./machine-details-form";
import { DetailsDirtyProvider } from "./details-dirty";
import { PinballmapDirtyGate } from "./pinballmap-dirty-gate";
import { MachineOwnerTransfer } from "./machine-owner-transfer";
import { SectionNavLayout } from "~/components/machines/machine-form/SectionNav";
import { SectionAnchor } from "~/components/machines/machine-form/SectionAnchor";
import { PinnedActionBarSpacer } from "~/components/machines/machine-form/MachineFormActionBar";
import {
  MACHINE_FORM_SECTION_IDS,
  type SectionNavItem,
} from "~/components/machines/machine-form/sections";
import { PBM_ADD_FAILED_PARAM } from "~/lib/pinballmap/create-flow";

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
 * Editors see the whole page. A member without `machines.edit` may still open
 * it for the read-only Pinball Map control (spec 4.9); Details and the Danger
 * zone remain absent. The redirect below is the deep-link guard for viewers who
 * hold neither route capability.
 *
 * Removing the Dialog wrapper also removes PP-o355.13's repro path — a Radix
 * popover portalled to <body> being read as an outside-click and dismissing the
 * whole modal.
 */
export default async function MachineEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ initials: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const { initials } = await params;
  // Set by the New Machine page when "Add to Pinball Map after creating" did
  // not go through (pinballmap 4.11): the machine exists and reads Out of
  // sync below; this names why.
  const pbmAddFailed = (await searchParams)[PBM_ADD_FAILED_PARAM] === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { machine } = await getMachineForLayout(initials);
  if (!machine) {
    notFound();
  }

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

  if (!user) {
    redirect(`/m/${initials}`);
  }

  const canEdit = checkPermission(
    "machines.edit",
    accessLevel,
    ownershipContext
  );
  const canViewOwnerRequirements = checkPermission(
    "machines.view.ownerRequirements",
    accessLevel
  );

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

  // A refresh-capable member gets the read-only Pinball Map section and no
  // machine mutation surfaces. Everyone else is sent back to Info: a 404 would
  // be a lie because the machine exists (CORE-SEC-001, spec 4.9 / 8.3).
  if (!canAccessMachineManage(accessLevel, ownershipContext)) {
    redirect(`/m/${initials}`);
  }

  // The matched title's display name, joined onto the machine by the loader
  // (PP-3bbr.1). This page used to query the mirror for it a second time; the
  // header above this panel renders the same title, so a separate lookup was
  // both a round-trip and a way for the two to disagree.
  const pinballmapTitleName = machine.pinballmapTitle?.name ?? null;

  // Every cabinet sharing this title — what decides coverage (spec §1, 4.7).
  // Small by construction: the group is keyed on one catalog title, so it is one
  // cabinet in almost every case and a handful in the worst. Skipped for an
  // unmatched machine, which has no title to share.
  const sameTitlePromise: Promise<
    (PbmSiblingInput & { icIntent: PbmIcIntent | null })[]
  > =
    machine.pinballmapMachineId !== null
      ? db
          .select({
            id: machines.id,
            initials: machines.initials,
            name: machines.name,
            intent: machines.pinballmapIntent,
            icIntent: machines.pinballmapIcIntent,
          })
          .from(machines)
          .where(eq(machines.pinballmapMachineId, machine.pinballmapMachineId))
      : Promise.resolve([]);

  const allUsersPromise = canEdit
    ? getUnifiedUsers({ includeEmails: false })
    : Promise.resolve([]);
  const [pbmState, allUsersRaw, sameTitle, allowance] = await Promise.all([
    getPinballMapState(),
    allUsersPromise,
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

  const configured = pbmState?.locationId != null;
  const snapshot = configured ? (pbmState.snapshotJson ?? null) : null;

  // The control's whole view is DERIVED here and handed down — nothing in it
  // discovers state by calling Pinball Map (CORE-PBM-001, PP-o355.21).
  const baseListingView = derivePbmListingView({
    machineId: machine.id,
    pinballmapMachineId: machine.pinballmapMachineId,
    pinballmapExcluded: machine.pinballmapExcluded,
    intent: machine.pinballmapIntent,
    presenceStatus: machine.presenceStatus,
    configured,
    snapshot,
    siblings: sameTitle,
  });

  // Present for every eligible title, whatever the listing intent (spec 3.8).
  // Eligibility is the catalog's flag, joined by the loader. A difference from
  // Pinball Map folds into the listing view as Out of sync plus the Update push.
  const insiderConnectedView = deriveInsiderConnectedView({
    listing: baseListingView,
    pinballmapMachineId: machine.pinballmapMachineId,
    icEligible: machine.pinballmapTitle?.icEligible ?? false,
    intent: machine.pinballmapIcIntent,
    siblingIntents: sameTitle.map((sibling) => sibling.icIntent),
    snapshot,
  });
  const listingView = withInsiderConnected(
    baseListingView,
    insiderConnectedView
  );

  // Whether an operator credential exists at all — read off the two columns the
  // state row already carries, never by decrypting the token. Without one the
  // outbound writes cannot run, so Add / Remove are absent rather than present
  // and failing (CORE-ARCH-012).
  const writeEnabled =
    configured &&
    pbmState.outboundEmail != null &&
    pbmState.outboundTokenVaultId != null;

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
  const abandonedRows = configured
    ? await listSurfacingAbandonedForMachine(machine.id)
    : [];
  const abandoned = await Promise.all(
    abandonedRows.map(async (row) => ({
      lmxId: row.lmxId,
      locationUrl: pinballmapLocationUrl(row.locationId),
      title: (await getCatalogEntry(row.pinballmapMachineId))?.name ?? null,
      currentLocation: row.locationId === pbmState?.locationId,
      commentCount:
        row.locationId === pbmState?.locationId
          ? (snapshot?.lmxes.find((l) => l.id === row.lmxId)?.conditions
              .length ?? null)
          : null,
    }))
  );

  const canEditAnyMachine = checkPermission("machines.edit", accessLevel);
  const isOwner =
    user.id === machine.ownerId || user.id === machine.invitedOwnerId;

  const locationUrl =
    pbmState?.locationId != null
      ? pinballmapLocationUrl(pbmState.locationId)
      : null;

  // The Pinball Map block inside Integrations. Manual Entry has no control —
  // the Integrations box says why instead (machine-editing 3.6) — but the
  // abandoned-entry alert still surfaces: the machine that just switched away
  // from a catalog title is exactly the one that may have left an entry on the
  // public lineup (PP-3bbr.3, pinballmap 4.2 Uncataloged).
  const listingControl = machine.pinballmapExcluded ? null : (
    <PinballmapDirtyGate>
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
        insiderConnected={insiderConnectedView}
      />
    </PinballmapDirtyGate>
  );
  const abandonedEntries =
    locationUrl !== null && abandoned.length > 0 ? (
      <PinballmapAbandonedEntries
        machineId={machine.id}
        entries={abandoned}
        canPush={canPush}
        writeEnabled={writeEnabled}
      />
    ) : null;
  const addFailedNote = pbmAddFailed ? (
    <div
      className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive-text"
      role="status"
      data-testid="pbm-add-after-create-failed"
    >
      Add to Pinball Map failed during creation
    </div>
  ) : null;
  const pinballmapBlock =
    listingControl === null &&
    abandonedEntries === null &&
    addFailedNote === null ? null : (
      <div className="space-y-3">
        {addFailedNote}
        {listingControl}
        {abandonedEntries}
      </div>
    );

  // The section list beside the form (machine-editing 5.1), in page order.
  // Data-driven: the Apron card section joins between Integrations and Danger
  // zone in PP-wqit.14.3.
  const sections: SectionNavItem[] = [
    { id: MACHINE_FORM_SECTION_IDS.details, label: "Details" },
    ...(canSetIntent
      ? [{ id: MACHINE_FORM_SECTION_IDS.modelDetails, label: "Model Details" }]
      : []),
    { id: MACHINE_FORM_SECTION_IDS.integrations, label: "Integrations" },
    { id: MACHINE_FORM_SECTION_IDS.dangerZone, label: "Danger zone" },
  ];

  // A member without `machines.edit` may still open the tab for the read-only
  // Pinball Map control (pinballmap 4.9): no form, no Danger zone, and so no
  // section list. The provider stays: the Pinball Map block reads it, and
  // with no form it never reports unsaved changes.
  if (!canEdit) {
    return (
      <DetailsDirtyProvider>
        <div className="@container max-w-4xl space-y-5">
          <section className="space-y-4" aria-labelledby="section-pinballmap">
            <h2 id="section-pinballmap" className="sr-only">
              Pinball Map
            </h2>
            {machine.pinballmapExcluded ? (
              <p
                className="text-sm text-muted-foreground"
                data-testid="pbm-listing-collapsed"
              >
                <span className="font-semibold text-foreground">
                  Pinball Map
                </span>{" "}
                — integration disabled. Requires a model listed in their
                catalog.
              </p>
            ) : null}
            {pinballmapBlock}
          </section>
          <ApronCardPanel
            machine={machine}
            variant="row"
            canEdit={canEdit}
            canExport={checkPermission("machines.apron.export", accessLevel)}
          />
        </div>
      </DetailsDirtyProvider>
    );
  }

  return (
    // The form and the immediate-acting controls share one dirty flag: while
    // the form has unsaved edits, Pinball Map and owner transfer are held
    // inert with a note saying why (machine-editing 4.2, PP-3bbr.3).
    <DetailsDirtyProvider>
      <SectionNavLayout sections={sections}>
        <div className="space-y-6">
          {/* Details — every field of the machine form, one Save (4.1). */}
          <section className="space-y-4" aria-labelledby="section-details">
            <SectionAnchor id={MACHINE_FORM_SECTION_IDS.details} />
            <h2 id="section-details" className="text-base font-semibold">
              Details
            </h2>
            <MachineDetailsForm
              machineId={machine.id}
              name={machine.name}
              presenceStatus={machine.presenceStatus}
              description={machine.description}
              ownerRequirements={machine.ownerRequirements}
              canViewOwnerRequirements={canViewOwnerRequirements}
              canLink={canSetIntent}
              pinballmapMachineId={machine.pinballmapMachineId}
              pinballmapExcluded={machine.pinballmapExcluded}
              pinballmapTitleName={pinballmapTitleName}
              // Straight off the row: the loader carries the real hand-entered
              // values (PP-3bbr.1), so the form never opens blank on a machine
              // that has them and then writes the nulls back on save.
              modelName={machine.modelName}
              manufacturer={machine.manufacturer}
              year={machine.year}
              type={machine.type}
              display={machine.display}
              playerCount={machine.playerCount}
              designers={machine.designers}
              artists={machine.artists}
              iscoredGameId={machine.iscoredGameId}
              pinballmap={pinballmapBlock}
            />
          </section>

          {/* Apron card — still edited in its own dialog, the same one the
              Service tab opens (apron-cards spec §3.1), until PP-wqit.14.3
              brings it into the form. */}
          <ApronCardPanel
            machine={machine}
            variant="row"
            canEdit={canEdit}
            canExport={checkPermission("machines.apron.export", accessLevel)}
          />

          {/* Danger zone — applies immediately, so it waits while the form has
              unsaved changes (4.2). Machine deletion joins this section in
              PP-o355.25. */}
          <section
            className="space-y-4 border-t border-outline-variant pt-6"
            aria-labelledby="section-danger"
          >
            <SectionAnchor id={MACHINE_FORM_SECTION_IDS.dangerZone} />
            <h2 id="section-danger" className="text-base font-semibold">
              Danger zone
            </h2>
            <PinballmapDirtyGate testId="owner-transfer-gated">
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
            </PinballmapDirtyGate>
          </section>
          <PinnedActionBarSpacer />
        </div>
      </SectionNavLayout>
    </DetailsDirtyProvider>
  );
}

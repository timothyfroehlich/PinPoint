import type React from "react";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles, pinballmapCatalog } from "~/server/db/schema";
import {
  getAccessLevel,
  checkPermission,
  type OwnershipContext,
} from "~/lib/permissions/index";
import { pinballmapLocationUrl } from "~/lib/pinballmap/public-url";
import { getPinballMapState } from "~/lib/pinballmap/state";
import { derivePbmListingState } from "~/lib/pinballmap/status";
import { listAbandonedForMachine } from "~/lib/pinballmap/abandoned-listings";
import { getCatalogEntry } from "~/lib/pinballmap/catalog";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { PinballmapListingControl } from "~/components/machines/PinballmapListingControl";
import { formatDateTime } from "~/lib/dates";
import { getUnifiedUsers } from "~/lib/users/queries";
import { getMachineForLayout } from "~/app/(app)/m/[initials]/_data";
import { MachineDetailsForm } from "./machine-details-form";
import { PinballmapSyncNow } from "./pinballmap-sync-now";
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

  const canLink = checkPermission(
    "machines.pinballmap.link",
    accessLevel,
    ownershipContext
  );
  // Sync is a stricter grant than Link — "machines.pinballmap.link" allows the
  // owning member, but "machines.pinballmap.sync" is technician/admin only.
  // Gating "Sync now" on `canLink` would show a button that 403s for an
  // owner-only member (PP-o355.19 review).
  const canSync = checkPermission(
    "machines.pinballmap.sync",
    accessLevel,
    ownershipContext
  );
  // Stricter still: `push` is what writes to the public map, and it is admin
  // only. Add / Remove hang off this; Claim and Accept — which write nothing
  // outward — hang off `canLink` above.
  const canPush = checkPermission(
    "machines.pinballmap.push",
    accessLevel,
    ownershipContext
  );

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

  const [pinballmapTitleName, pbmState, allUsersRaw] = await Promise.all([
    pinballmapTitlePromise,
    canLink ? getPinballMapState() : Promise.resolve(null),
    getUnifiedUsers({ includeEmails: false }),
  ]);

  const allUsers = allUsersRaw.map((u) => ({
    id: u.id,
    name: u.name,
    lastName: u.lastName,
    machineCount: u.machineCount,
    status: u.status,
    role: u.role,
  }));

  // The listing control's state is DERIVED here and handed down — nothing in it
  // discovers state by calling Pinball Map (CORE-PBM-001, PP-o355.21).
  const listingState = derivePbmListingState({
    pinballmapMachineId: machine.pinballmapMachineId,
    pinballmapExcluded: machine.pinballmapExcluded,
    pinballmapListed: machine.pinballmapListed,
    pinballmapLmxId: machine.pinballmapLmxId,
    snapshot: pbmState?.snapshotJson ?? null,
  });

  // Whether an operator credential exists at all — read off the two columns the
  // state row already carries, never by decrypting the token. Without one the
  // outbound writes cannot run, so Add / Remove are absent rather than present
  // and failing (CORE-ARCH-012).
  const writeEnabled =
    pbmState?.outboundEmail != null && pbmState.outboundTokenVaultId != null;

  // Entries left live on the public map by an earlier retitle (PP-l81u). The
  // catalog row can disappear while the entry on Pinball Map outlives it, so a
  // null title falls back to naming the entry by id rather than inventing one.
  const abandoned = await Promise.all(
    (canLink ? await listAbandonedForMachine(machine.id) : []).map(
      async (row) => ({
        lmxId: row.lmxId,
        title: (await getCatalogEntry(row.pinballmapMachineId))?.name ?? null,
      })
    )
  );

  const canEditAnyMachine =
    accessLevel === "admin" || accessLevel === "technician";
  const isOwner =
    user.id === machine.ownerId || user.id === machine.invitedOwnerId;

  const locationUrl = pinballmapLocationUrl();

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
          canLink={canLink}
          pinballmapMachineId={machine.pinballmapMachineId}
          pinballmapExcluded={machine.pinballmapExcluded}
          pinballmapExcludedReason={machine.pinballmapExcludedReason}
          pinballmapTitleName={pinballmapTitleName}
          modelName={machine.modelName}
          manufacturer={machine.manufacturer}
          year={machine.year}
        />
      </section>

      {/* Pinball Map — no save bar: each control here acts on its own.
          PP-o355.21 rebuilds the listing control and moves the catalog title
          row in from Details, where it currently rides the Details save. */}
      <section
        className="space-y-4 border-t border-outline-variant pt-6"
        aria-labelledby="section-pinballmap"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="section-pinballmap" className="text-base font-semibold">
            <a
              href={locationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:no-underline"
            >
              Pinball Map
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </h2>
          {canLink && (
            <div className="text-sm text-muted-foreground">
              {pbmState?.lastSyncedAt
                ? `last synced ${formatDateTime(pbmState.lastSyncedAt)}`
                : "never synced"}
              {canSync && (
                <>
                  {" · "}
                  <PinballmapSyncNow />
                </>
              )}
            </div>
          )}
        </div>

        {canLink ? (
          <>
            <PinballmapListingControl
              machineId={machine.id}
              state={listingState}
              listed={machine.pinballmapListed}
              canLink={canLink}
              canPush={canPush}
              writeEnabled={writeEnabled}
              modelName={pinballmapTitleName}
            />

            {/* Entries this machine walked away from that are still live on the
                public map (PP-l81u). The Info tab's "Config issue" warning
                links here, so this is where that trail has to end — a warning
                that sends you to a page saying nothing about it is worse than
                no warning. Cleanup from inside PinPoint is PP-o355.32; until
                then the only person who can take the old entry down is someone
                with a pinballmap.com account, and saying so is the honest
                version (CORE-ARCH-012). */}
            {abandoned.length > 0 ? (
              <Alert
                variant="warning"
                data-testid="machine-pinballmap-abandoned"
              >
                <AlertTriangle className="size-4" aria-hidden="true" />
                <AlertDescription>
                  {abandoned.map((entry) => (
                    <span key={entry.lmxId} className="block">
                      Previous listing still live:{" "}
                      {entry.title === null
                        ? `Pinball Map entry #${String(entry.lmxId)}`
                        : `“${entry.title}”`}
                    </span>
                  ))}
                  {/* GOV.UK Details pattern: expands in place, no navigation,
                      and it works on touch where a tooltip does not. Named for
                      its topic rather than "Learn more", which NN/G flags as
                      poor information scent. Native `<details>`, so this stays
                      a server component. */}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">
                      Why is this here?
                    </summary>
                    <p className="mt-1 text-xs text-muted-foreground">
                      This machine was listed on Pinball Map under that title,
                      and changing its model left the old entry behind. Only
                      someone with a pinballmap.com account can take it down.
                    </p>
                  </details>
                </AlertDescription>
              </Alert>
            ) : null}
          </>
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

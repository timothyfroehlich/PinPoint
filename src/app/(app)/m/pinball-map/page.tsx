import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Forbidden } from "~/components/errors/Forbidden";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { LineupComparisonView } from "~/components/pinballmap/LineupComparisonView";
import { LineupHeader } from "~/components/pinballmap/LineupHeader";
import type { LineupActionContext } from "~/components/pinballmap/LineupRowActions";
import { getViewer } from "~/lib/collections/viewer";
import { formatDate } from "~/lib/dates";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { loadLineupData } from "~/lib/pinballmap/lineup-data";
import { pinballmapLocationUrl } from "~/lib/pinballmap/public-url";
import { getRefreshAllowance } from "~/lib/pinballmap/state";
import { getLoginUrl } from "~/lib/url";

export const metadata: Metadata = {
  title: "Pinball Map lineup",
};

/**
 * The Pinball Map lineup page (`docs/feature-specs/pinballmap-lineup.md`,
 * PP-o355.65): PinPoint's intended lineup against what Pinball Map shows for
 * the tracked location, grouped by the action that resolves each difference.
 *
 * Renders from stored data only — the state singleton, machines, catalog rows
 * and abandoned-entry records. Opening it never calls Pinball Map
 * (CORE-PBM-001, §2.3); Refresh and the row pushes are explicit clicks.
 *
 * Viewing needs signed-in membership, the tier that reads the listing control
 * and presses its Refresh (`machines.pinballmap.sync`, pinballmap §8.3, lineup
 * §2.2). Every row action re-checks its own capability (§8.2).
 */
export default async function PinballMapLineupPage(): Promise<React.JSX.Element> {
  const viewer = await getViewer();
  if (viewer.userId === undefined) redirect(getLoginUrl("/m/pinball-map"));

  const accessLevel = getAccessLevel(viewer.role);
  if (!checkPermission("machines.pinballmap.sync", accessLevel)) {
    return <Forbidden role={viewer.role} backUrl="/m" />;
  }

  const [{ state, comparison, machines }, allowance] = await Promise.all([
    loadLineupData(),
    getRefreshAllowance(),
  ]);

  const header = <PageHeader title="Pinball Map lineup" />;

  // Not configured: say so, and render no comparison, Refresh, or retained
  // snapshot as current (§2.4, pinballmap §10.6).
  if (comparison.status === "not_configured" || state?.locationId == null) {
    const canConfigure = checkPermission(
      "admin.integrations.manage",
      accessLevel
    );
    return (
      <PageContainer size="wide">
        {header}
        <p
          className="text-sm text-muted-foreground"
          data-testid="pbm-lineup-not-configured"
        >
          Pinball Map is not configured.{" "}
          {canConfigure ? (
            <Link
              href="/admin/integrations"
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              Set the tracked location
            </Link>
          ) : null}
        </p>
      </PageContainer>
    );
  }

  const snapshot = state.snapshotJson ?? null;
  const locationUrl = pinballmapLocationUrl(state.locationId);
  const lineupHeader = (
    <LineupHeader
      locationName={snapshot?.name ?? null}
      locationUrl={locationUrl}
      entryCount={snapshot?.lmxes.length ?? null}
      pinballMapUpdated={
        snapshot?.dateLastUpdated == null
          ? null
          : formatPinballMapDate(snapshot.dateLastUpdated)
      }
      lastRefreshedAt={state.lastSyncedAt}
      lastRefreshFailed={state.lastSyncStatus === "error"}
      refreshRemaining={allowance.remaining}
      refreshAvailableAt={allowance.nextRefillAt}
    />
  );

  // Waiting: the header with its Refresh and error marker, no comparison
  // (§2.5, pinballmap §3.5).
  if (comparison.status === "waiting") {
    return (
      <PageContainer size="wide">
        {header}
        {lineupHeader}
        <p
          className="text-sm text-muted-foreground"
          data-testid="pbm-lineup-waiting"
        >
          Waiting for the first Pinball Map refresh.
        </p>
      </PageContainer>
    );
  }

  // Push is owner-scoped for members, so it is resolved per machine here and
  // re-checked by every server action (CORE-ARCH-008). Only ids cross to the
  // client (CORE-SEC-006).
  const pushableMachineIds = machines
    .filter((m) =>
      checkPermission("machines.pinballmap.push", accessLevel, {
        userId: viewer.userId,
        machineOwnerId: m.ownerId,
      })
    )
    .map((m) => m.id);
  const context: LineupActionContext = {
    pushableMachineIds,
    canPushUnowned: checkPermission("machines.pinballmap.push", accessLevel),
    canCreateMachine: checkPermission("machines.create", accessLevel),
    // Whether an operator credential exists, read off the state row's columns
    // and never by decrypting the token — the listing control's own test.
    writeEnabled:
      state.outboundEmail != null && state.outboundTokenVaultId != null,
    locationUrl,
  };

  return (
    <PageContainer size="wide">
      {header}
      {lineupHeader}
      <LineupComparisonView comparison={comparison} context={context} />
    </PageContainer>
  );
}

/** Pinball Map's `date_last_updated` is a calendar date (YYYY-MM-DD). */
function formatPinballMapDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return value;
  // Local noon, so no timezone offset can move it to a neighbouring day.
  return formatDate(
    new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
  );
}

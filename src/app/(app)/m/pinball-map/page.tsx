import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { Forbidden } from "~/components/errors/Forbidden";
import { RelativeTime } from "~/components/issues/RelativeTime";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { LineupHeader } from "~/components/pinballmap/LineupHeader";
import {
  LineupLinkOptionsProvider,
  type LineupLinkOption,
} from "~/components/pinballmap/LineupRowActions";
import {
  LineupSections,
  type LineupViewContext,
} from "~/components/pinballmap/LineupSections";
import { getViewer } from "~/lib/collections/viewer";
import { formatDate, formatDateTime } from "~/lib/dates";
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
 * the tracked location, sorted into the sections whose actions resolve each
 * difference.
 *
 * Renders from stored data only — the state singleton, machines and catalog
 * rows. Opening it never calls Pinball Map (CORE-PBM-001, §2.3); Refresh and
 * the row actions are explicit clicks.
 *
 * Viewing needs signed-in membership, the tier that reads the listing control
 * and presses its Refresh (`machines.pinballmap.sync`, pinballmap §8.3, lineup
 * §2.2). Every row action re-checks its own capability (§8.2).
 *
 * Desktop layout only (§2.6): the app shell clips horizontal overflow at the
 * body, so the page carries its own horizontal scroll area with a minimum
 * width rather than rearranging on a narrow screen (CORE-RESP-004).
 */
export default async function PinballMapLineupPage(): Promise<React.JSX.Element> {
  const viewer = await getViewer();
  if (viewer.userId === undefined) redirect(getLoginUrl("/m/pinball-map"));
  const userId = viewer.userId;

  const accessLevel = getAccessLevel(viewer.role);
  if (!checkPermission("machines.pinballmap.sync", accessLevel)) {
    return <Forbidden role={viewer.role} backUrl="/m" />;
  }

  const [{ state, comparison, machines, catalog, abandoned }, allowance] =
    await Promise.all([loadLineupData(), getRefreshAllowance()]);

  const header = <PageHeader title="Pinball Map lineup" />;

  // Not configured: say so, and render no comparison, Refresh, or retained
  // snapshot as current (§2.4, pinballmap §10.6).
  if (comparison.status === "not_configured" || state?.locationId == null) {
    const canConfigure = checkPermission(
      "admin.integrations.manage",
      accessLevel
    );
    return (
      <PageContainer size="full">
        {header}
        <div
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
        </div>
      </PageContainer>
    );
  }

  const snapshot = state.snapshotJson ?? null;
  const locationUrl = pinballmapLocationUrl(state.locationId);
  const lastRefreshFailed = state.lastSyncStatus === "error";
  // Whether an operator credential exists, read off the state row's columns
  // and never by decrypting the token — the listing control's own test.
  const writeEnabled =
    state.outboundEmail != null && state.outboundTokenVaultId != null;
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
      lastRefreshFailed={lastRefreshFailed}
      refreshRemaining={allowance.remaining}
      refreshAvailableAt={allowance.nextRefillAt}
      canConfirm={
        comparison.status === "ready" &&
        writeEnabled &&
        checkPermission("machines.pinballmap.confirm", accessLevel)
      }
    />
  );

  // Waiting: the header with its Refresh and error marker, no comparison
  // (§2.5, pinballmap §3.5).
  if (comparison.status === "waiting") {
    return (
      <PageContainer size="full">
        {header}
        <div className="overflow-x-auto">
          <div className="min-w-[68rem] space-y-4">
            {lineupHeader}
            <div
              className="text-sm text-muted-foreground"
              data-testid="pbm-lineup-waiting"
            >
              Waiting for the first Pinball Map refresh.
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  // Push is owner-scoped for members, so it is resolved per machine here and
  // re-checked by every server action (CORE-ARCH-008). Only ids and names
  // cross to the client (CORE-SEC-006).
  const ownerOf = new Map(machines.map((m) => [m.id, m.ownerId]));
  const mayPush = (machineId: string): boolean =>
    checkPermission("machines.pinballmap.push", accessLevel, {
      userId,
      machineOwnerId: ownerOf.get(machineId) ?? null,
    });
  const mayLink = (machineId: string): boolean =>
    checkPermission("machines.pinballmap.link", accessLevel, {
      userId,
      machineOwnerId: ownerOf.get(machineId) ?? null,
    });
  const canPushUnowned = checkPermission(
    "machines.pinballmap.push",
    accessLevel
  );

  // A member may remove an unlinked entry their own machine walked away from
  // (pinballmap §2.5), the allowlist the removal action re-checks.
  const walkedAwayBy = new Map<number, string[]>();
  for (const record of abandoned) {
    const ids = walkedAwayBy.get(record.lmxId) ?? [];
    ids.push(record.machineId);
    walkedAwayBy.set(record.lmxId, ids);
  }

  const titleName = new Map(
    catalog.map((row) => [row.pinballmapMachineId, row.name])
  );

  const linkOptions: LineupLinkOption[] = machines
    .filter(
      (m) =>
        m.presenceStatus !== "removed" && !m.pinballmapExcluded && mayLink(m.id)
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => ({
      id: m.id,
      initials: m.initials,
      name: m.name,
      linkedTitle:
        m.pinballmapMachineId === null
          ? null
          : (titleName.get(m.pinballmapMachineId) ?? "another title"),
    }));

  const context: LineupViewContext = {
    writeEnabled,
    locationUrl,
    pushActor: (row) => {
      // The cabinet whose own listing control offers the same push.
      const wanted = row.tag === "to_remove" ? "off" : "on";
      return (
        row.cabinets.find((c) => c.intent === wanted && mayPush(c.id))?.id ??
        null
      );
    },
    canRemoveEntry: (row) =>
      canPushUnowned ||
      (walkedAwayBy.get(row.lmxId) ?? []).some((id) => mayPush(id)),
    canLink: linkOptions.length > 0,
    canCreate: checkPermission("machines.create", accessLevel),
  };

  return (
    <PageContainer size="full">
      {header}
      <div className="overflow-x-auto pb-1" data-testid="pbm-lineup">
        <div className="min-w-[68rem] space-y-4">
          {lineupHeader}
          {lastRefreshFailed && state.lastSyncedAt !== null ? (
            <div
              className="flex items-center gap-2.5 rounded-lg border border-warning-container bg-warning-container/25 px-3.5 py-2.5 text-sm text-on-warning-container"
              role="status"
              data-testid="pbm-lineup-refresh-failed"
            >
              <TriangleAlert
                aria-hidden="true"
                className="size-4 shrink-0 text-warning"
              />
              <span>
                The last refresh failed
                {state.lastSyncError ? ` (${state.lastSyncError})` : ""}. This
                page shows the lineup from{" "}
                <RelativeTime
                  value={state.lastSyncedAt}
                  fallback={formatDateTime(state.lastSyncedAt)}
                />
                .
              </span>
            </div>
          ) : null}
          <LineupLinkOptionsProvider options={linkOptions}>
            <LineupSections comparison={comparison} context={context} />
          </LineupLinkOptionsProvider>
        </div>
      </div>
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

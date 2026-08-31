import { cache } from "react";
import { eq, notInArray, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { machines, issues } from "~/server/db/schema";
import { CLOSED_STATUSES } from "~/lib/issues/status";

/**
 * Shared layout data for `/m/[initials]/*`.
 *
 * Returns the machine + only its OPEN issues (status filter applied at the
 * DB layer to avoid loading unbounded closed-issue history on every request)
 * + a separate `count(*)` for total issues. Both tabs consume this via React
 * `cache()` — the layout's call dedupes with the tab page's call within a
 * single request.
 *
 *   - Info tab: derives status from `machine.issues`, shows open + total counts.
 *   - Service tab: renders `machine.issues` directly. A richer filter bar
 *     (bead PP-0kta) will be the access point for closed-issue history; until
 *     then, "All / Closed" views are deliberately not exposed in the UI.
 */
/**
 * The one piece of display metadata that still has no source anywhere.
 *
 * This started as a four-field frame for the enriched machine header
 * (PP-5sgt.1, June 2026), written when none of `manufacturer`, `year`,
 * `edition` or `backboxImageUrl` existed as columns — the nulls let the header
 * be built ahead of its data and render its empty fallback. Two of the four
 * became real columns underneath it and the spread kept overwriting them with
 * null, so the header's sub-line was blank on every machine that had the data
 * (found by review on PR #1875; fixed in PP-3bbr.1). `edition` was deleted
 * outright — it was never stored, and Pinball Map bakes it into the catalog
 * title, which the Info tab's Model row already shows in full.
 *
 * `backboxImageUrl` is genuinely absent: `MachineBackboxTranslite` is complete
 * and tested but has returned `null` on every page load since it shipped,
 * because nothing fetches translite art. **PP-o355.43 either gives it a source
 * or deletes it** — and has to answer OPDB's image licensing first, since
 * hotlinking their CDN is out and re-hosting is a separate rights question
 * from CORE-PBM-001. Until then the field exists so the component's prop has
 * something to read.
 */
const PBM_METADATA_PLACEHOLDER: {
  backboxImageUrl: string | null;
} = {
  backboxImageUrl: null,
};

export const getMachineForLayout = cache(async (initials: string) => {
  const [machine, totalIssuesCountResult] = await Promise.all([
    db.query.machines.findFirst({
      where: eq(machines.initials, initials),
      with: {
        issues: {
          where: notInArray(issues.status, [...CLOSED_STATUSES]),
          columns: {
            id: true,
            issueNumber: true,
            title: true,
            status: true,
            severity: true,
            priority: true,
            frequency: true,
            machineInitials: true,
            createdAt: true,
            reporterName: true,
          },
          orderBy: (issues, { desc }) => [desc(issues.createdAt)],
        },
        owner: {
          columns: { id: true, name: true, avatarUrl: true },
        },
        invitedOwner: {
          columns: { id: true, name: true },
        },
        watchers: {
          columns: { userId: true, watchMode: true },
        },
        // Joined rather than looked up afterwards. A second PK query would be
        // sequential — it needs the machine row to know the id — so every one
        // of the five `/m/[initials]/*` surfaces would pay a round-trip for a
        // field two of them read. `with` folds it into the query already going
        // out. Null here for an unmatched machine, and also for a matched one
        // whose title has left the mirror; `resolveModelTitle` separates those.
        pinballmapTitle: {
          columns: { name: true },
        },
      },
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(issues)
      .where(eq(issues.machineInitials, initials)),
  ]);

  return {
    machine: machine
      ? {
          ...machine,
          ...PBM_METADATA_PLACEHOLDER,
          modelTitle: resolveModelTitle(machine),
        }
      : undefined,
    totalIssuesCount: totalIssuesCountResult[0]?.count ?? 0,
  };
});

/**
 * What game this machine IS, as one display string — the Pinball Map catalog
 * title when it is matched, the hand-entered `modelName` when it is not.
 *
 * Two sources and never both at once: the DB CHECK
 * `machines_model_name_requires_excluded` forbids a hand-entered model on a
 * matched machine, so there is no precedence rule to get wrong here (PP-3bbr).
 *
 * Null means nobody has said yet — an unmatched, un-declared machine. A matched
 * machine whose catalog row has since vanished falls back to naming the id
 * rather than reading as "no model": the match is a real, recorded decision and
 * hiding it would misreport the machine as unmatched (CORE-ARCH-012).
 *
 * Pure. The catalog row arrives on the machine through the `pinballmapTitle`
 * relation, so this costs no query of its own — deriving it here rather than in
 * each page is what keeps the header and the Info tab's Model row saying the
 * same thing. They rendered the same fact from two independent lookups before
 * PP-3bbr.1, which could have disagreed with nobody able to see it.
 */
function resolveModelTitle(machine: {
  pinballmapMachineId: number | null;
  pinballmapExcluded: boolean;
  name: string;
  modelName: string | null;
  pinballmapTitle: { name: string } | null;
}): string | null {
  if (machine.pinballmapMachineId === null) {
    // Model name is optional under Manual Entry (Tim, 2026-08-27): leaving it
    // blank means "same as what we call the cabinet", so it FOLLOWS a later
    // rename instead of freezing the name as it was the day the source was
    // switched. Only the declared case falls back — a machine that is neither
    // matched nor hand-entered has genuinely had nothing said about it, and
    // "Not specified" is the honest answer there (PP-3bbr.3).
    if (machine.pinballmapExcluded) return machine.modelName ?? machine.name;
    return machine.modelName;
  }
  return (
    machine.pinballmapTitle?.name ??
    `Pinball Map title #${String(machine.pinballmapMachineId)}`
  );
}

export type MachineForLayout = NonNullable<
  Awaited<ReturnType<typeof getMachineForLayout>>["machine"]
>;

/**
 * All issues (every status) for a machine, newest first — the "All" view of
 * the Service tab's Open Issues card (`?view=all`). Selects the same columns
 * the `IssueCard` needs so the card renders identically to the open-only view.
 * Loaded lazily (only when the ⋯ menu switches to All) so the default open
 * view stays cheap. `cache()`-wrapped for request-level dedupe.
 */
export const getMachineAllIssues = cache(async (initials: string) => {
  return db.query.issues.findMany({
    where: eq(issues.machineInitials, initials),
    columns: {
      id: true,
      issueNumber: true,
      title: true,
      status: true,
      severity: true,
      priority: true,
      frequency: true,
      machineInitials: true,
      createdAt: true,
      reporterName: true,
    },
    orderBy: (issues, { desc }) => [desc(issues.createdAt)],
  });
});

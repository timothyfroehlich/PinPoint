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
      },
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(issues)
      .where(eq(issues.machineInitials, initials)),
  ]);

  return {
    machine,
    totalIssuesCount: totalIssuesCountResult[0]?.count ?? 0,
  };
});

export type MachineForLayout = NonNullable<
  Awaited<ReturnType<typeof getMachineForLayout>>["machine"]
>;

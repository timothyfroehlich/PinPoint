import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";

/**
 * Shared layout data for `/m/[initials]/*`.
 *
 * Returns the machine + ALL issues (no status filter). Both tabs consume this
 * via React `cache()` — the layout's call dedupes with the tab page's call
 * within a single request. Tabs are responsible for filtering issues to the
 * subset they want to show:
 *   - Info tab: derives status from open issues, shows open + total counts
 *   - Service tab: currently renders only open issues (the section badge +
 *     count are open-only); a richer filter bar is planned (bead PP-0kta)
 *     that will let users switch between open / closed / all.
 */
export const getMachineForLayout = cache(async (initials: string) => {
  const machine = await db.query.machines.findFirst({
    where: eq(machines.initials, initials),
    with: {
      issues: {
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
  });

  return { machine };
});

export type MachineForLayout = NonNullable<
  Awaited<ReturnType<typeof getMachineForLayout>>["machine"]
>;

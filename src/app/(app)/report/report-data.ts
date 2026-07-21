import "server-only";
import { cache } from "react";
import { asc, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { machines, userProfiles } from "~/server/db/schema";
import { checkPermission } from "~/lib/permissions/helpers";
import type { AccessLevel } from "~/lib/permissions/matrix";

/**
 * Shared, request-deduped data loaders for the tabbed report page (PP-idrb).
 *
 * `report/(tabbed)/layout.tsx` (which hydrates the ReportDraftProvider) and
 * `report/(tabbed)/page.tsx` (the Single form, which also needs machines
 * server-side to resolve `?machine=` + prefetch recent issues) both need this
 * data. Wrapping the queries in React `cache()` collapses the layout's call and
 * the page's call for the same request into a single DB round-trip each, so
 * `/report` no longer fetches machines + assignees twice (PP-2m17 #3).
 */

/** All machines, id/name/initials, ordered by name. */
export const getReportMachines = cache(async () =>
  db.query.machines.findMany({
    orderBy: asc(machines.name),
    columns: { id: true, name: true, initials: true },
  })
);

/**
 * Assignable users for the report forms, or `[]` when the viewer can't assign.
 *
 * Gated on the `issues.report.assignee` matrix permission rather than a
 * hand-rolled role list — the previous `accessLevel === "admin" || "member"`
 * check silently excluded technicians, who DO hold that permission, so a
 * technician saw an empty assignee dropdown (PP-2m17 #1, CORE-ARCH-008). The
 * assignable pool itself is every admin/member/technician.
 */
export const getReportAssignees = cache(
  async (
    accessLevel: AccessLevel
  ): Promise<{ id: string; name: string | null }[]> => {
    if (!checkPermission("issues.report.assignee", accessLevel)) return [];
    return db.query.userProfiles.findMany({
      where: (profile) =>
        sql`${profile.role} = 'admin' OR ${profile.role} = 'member' OR ${profile.role} = 'technician'`,
      columns: { id: true, name: true },
      orderBy: asc(userProfiles.name),
    });
  }
);

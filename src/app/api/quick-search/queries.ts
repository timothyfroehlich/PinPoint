import { and, asc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import { machineNotRemoved } from "~/lib/machines/queries";
import {
  QUICK_SEARCH_MAX_QUERY_LENGTH,
  QUICK_SEARCH_MIN_QUERY_LENGTH,
  QUICK_SEARCH_RESULT_LIMIT,
  normalizeQuickSearchQuery,
} from "~/lib/quick-search/match";
import type {
  QuickSearchIssueResults,
  QuickSearchMachineIndex,
} from "~/lib/quick-search/types";
import { db } from "~/server/db";
import { issues, machines, pinballmapCatalog } from "~/server/db/schema";

const EMPTY_ISSUE_RESULTS: QuickSearchIssueResults = { issues: [] };

export const quickSearchQuerySchema = z
  .string()
  .max(QUICK_SEARCH_MAX_QUERY_LENGTH * 4)
  .transform(normalizeQuickSearchQuery);

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/**
 * Every machine the quick search viewer can find, for matching in the browser
 * (spec 5.9, 7.5). Removed machines are left out (spec 3.4).
 */
export async function listQuickSearchMachines(): Promise<QuickSearchMachineIndex> {
  const modelIdentity = sql<
    string | null
  >`coalesce(${pinballmapCatalog.name}, ${machines.modelName})`;
  // The current manufacturer (spec collections-and-tags 8.1), matching what
  // the machine page and Machine View display.
  const modelManufacturer = sql<string | null>`case
    when ${machines.pinballmapMachineId} is not null then
      case when ${pinballmapCatalog.pinballmapMachineId} is not null
        then ${pinballmapCatalog.manufacturer}
        else ${machines.manufacturer}
      end
    when ${machines.pinballmapExcluded} then ${machines.manufacturer}
  end`;
  const modelYear = sql<
    string | null
  >`coalesce(${pinballmapCatalog.year}, ${machines.year})::text`;

  const machineRows = await db
    .select({
      id: machines.id,
      initials: machines.initials,
      name: machines.name,
      modelName: modelIdentity,
      manufacturer: modelManufacturer,
      year: modelYear,
    })
    .from(machines)
    .leftJoin(
      pinballmapCatalog,
      eq(machines.pinballmapMachineId, pinballmapCatalog.pinballmapMachineId)
    )
    .where(machineNotRemoved())
    .orderBy(asc(machines.name));

  return { machines: machineRows };
}

export async function searchQuickIssues(
  rawQuery: string
): Promise<QuickSearchIssueResults> {
  const query = normalizeQuickSearchQuery(rawQuery);
  if (query.length < QUICK_SEARCH_MIN_QUERY_LENGTH) return EMPTY_ISSUE_RESULTS;

  const escapedQuery = escapeLikePattern(query);
  const prefix = `${escapedQuery}%`;
  const contains = `%${escapedQuery}%`;

  const issueIdentifier = sql<string>`upper(${issues.machineInitials}) || '-' || lpad(${issues.issueNumber}::text, greatest(2, length(${issues.issueNumber}::text)), '0')`;
  const issueRank = sql<number>`case
    when lower(${issueIdentifier}) = lower(${query}) then 0
    when ${issueIdentifier} ilike ${prefix} then 1
    when ${issues.title} ilike ${prefix} then 2
    when lower(${issues.machineInitials}) = lower(${query}) then 3
    when ${machines.name} ilike ${prefix} then 4
    else 5
  end`;
  const closedStatuses = sql.join(
    CLOSED_STATUSES.map((status) => sql`${status}`),
    sql`, `
  );
  const closedRank = sql<number>`case when ${issues.status} in (${closedStatuses}) then 1 else 0 end`;

  const issueRows = await db
    .select({
      id: issues.id,
      issueNumber: issues.issueNumber,
      machineInitials: issues.machineInitials,
      machineName: machines.name,
      status: issues.status,
      title: issues.title,
    })
    .from(issues)
    .innerJoin(machines, eq(issues.machineInitials, machines.initials))
    .where(
      and(
        machineNotRemoved(),
        or(
          sql`${issueIdentifier} ilike ${contains}`,
          sql`${issues.title} ilike ${contains}`,
          sql`${issues.machineInitials} ilike ${contains}`,
          sql`${machines.name} ilike ${contains}`
        )
      )
    )
    .orderBy(issueRank, closedRank, asc(issues.title))
    .limit(QUICK_SEARCH_RESULT_LIMIT);

  return { issues: issueRows };
}

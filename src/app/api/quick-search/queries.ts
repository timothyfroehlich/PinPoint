import { asc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import type { QuickSearchResults } from "~/lib/quick-search/types";
import { db } from "~/server/db";
import { issues, machines, pinballmapCatalog } from "~/server/db/schema";

export const QUICK_SEARCH_MIN_QUERY_LENGTH = 2;
export const QUICK_SEARCH_MAX_QUERY_LENGTH = 80;
export const QUICK_SEARCH_RESULT_LIMIT = 5;

const EMPTY_RESULTS: QuickSearchResults = { machines: [], issues: [] };

export function normalizeQuickSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, QUICK_SEARCH_MAX_QUERY_LENGTH);
}

export const quickSearchQuerySchema = z
  .string()
  .max(QUICK_SEARCH_MAX_QUERY_LENGTH * 4)
  .transform(normalizeQuickSearchQuery);

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function searchQuickNavigation(
  rawQuery: string
): Promise<QuickSearchResults> {
  const query = normalizeQuickSearchQuery(rawQuery);
  if (query.length < QUICK_SEARCH_MIN_QUERY_LENGTH) return EMPTY_RESULTS;

  const escapedQuery = escapeLikePattern(query);
  const prefix = `${escapedQuery}%`;
  const contains = `%${escapedQuery}%`;
  const modelIdentity = sql<
    string | null
  >`coalesce(${pinballmapCatalog.name}, ${machines.modelName})`;
  const machineRank = sql<number>`case
    when lower(${machines.initials}) = lower(${query}) then 0
    when ${machines.initials} ilike ${prefix} then 1
    when ${machines.name} ilike ${prefix} then 2
    when ${modelIdentity} ilike ${prefix} then 3
    else 4
  end`;

  const issueIdentifier = sql<string>`upper(${issues.machineInitials}) || '-' || lpad(${issues.issueNumber}::text, 2, '0')`;
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

  const [machineRows, issueRows] = await Promise.all([
    db
      .select({
        id: machines.id,
        initials: machines.initials,
        name: machines.name,
        modelName: modelIdentity,
      })
      .from(machines)
      .leftJoin(
        pinballmapCatalog,
        eq(machines.pinballmapMachineId, pinballmapCatalog.pinballmapMachineId)
      )
      .where(
        or(
          sql`${machines.initials} ilike ${contains}`,
          sql`${machines.name} ilike ${contains}`,
          sql`${modelIdentity} ilike ${contains}`
        )
      )
      .orderBy(machineRank, asc(machines.name))
      .limit(QUICK_SEARCH_RESULT_LIMIT),
    db
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
        or(
          sql`${issueIdentifier} ilike ${contains}`,
          sql`${issues.title} ilike ${contains}`,
          sql`${issues.machineInitials} ilike ${contains}`,
          sql`${machines.name} ilike ${contains}`
        )
      )
      .orderBy(issueRank, closedRank, asc(issues.title))
      .limit(QUICK_SEARCH_RESULT_LIMIT),
  ]);

  return { machines: machineRows, issues: issueRows };
}

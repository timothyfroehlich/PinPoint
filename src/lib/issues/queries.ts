import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { eq, and, desc, isNull, type SQL } from "drizzle-orm";
import { isIssueStatus, isIssueSeverity } from "~/lib/issues/status";

export interface IssueFilters {
  machineId?: string | undefined;
  status?: string | undefined;
  severity?: string | undefined;
  assignedTo?: string | undefined;
}


export async function getIssues(
  filters: IssueFilters
): Promise<IssueWithRelations[]> {
  const { machineId, status, severity, assignedTo } = filters;

  // Build where conditions for filtering
  const conditions: SQL[] = [];

  if (machineId) {
    conditions.push(eq(issues.machineId, machineId));
  }

  if (status && isIssueStatus(status)) {
    conditions.push(eq(issues.status, status));
  }

  if (severity && isIssueSeverity(severity)) {
    conditions.push(eq(issues.severity, severity));
  }

  if (assignedTo === "unassigned") {
    conditions.push(isNull(issues.assignedTo));
  } else if (assignedTo) {
    conditions.push(eq(issues.assignedTo, assignedTo));
  }

  // Query issues with filters
  return await db.query.issues.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: desc(issues.createdAt),
    with: {
      machine: {
        columns: {
          id: true,
          name: true,
        },
      },
      reportedByUser: {
        columns: {
          id: true,
          name: true,
        },
      },
      assignedToUser: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });
}

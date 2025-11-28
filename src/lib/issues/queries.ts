import { type IssueListItem } from "~/lib/types";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { eq, and, desc, isNull, type SQL } from "drizzle-orm";

export interface IssueFilters {
  machineId?: string | undefined;
  status?: string | undefined;
  severity?: string | undefined;
  priority?: string | undefined;
  assignedTo?: string | undefined;
}

export async function getIssues(
  filters: IssueFilters
): Promise<IssueListItem[]> {
  const { machineId, status, severity, priority, assignedTo } = filters;

  // Build where conditions for filtering
  const conditions: SQL[] = [];

  if (machineId) {
    conditions.push(eq(issues.machineId, machineId));
  }

  if (
    status &&
    (status === "new" || status === "in_progress" || status === "resolved")
  ) {
    conditions.push(eq(issues.status, status));
  }

  if (
    severity &&
    (severity === "minor" ||
      severity === "playable" ||
      severity === "unplayable")
  ) {
    conditions.push(eq(issues.severity, severity));
  }

  if (
    priority &&
    (priority === "low" || priority === "medium" || priority === "high")
  ) {
    conditions.push(eq(issues.priority, priority));
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

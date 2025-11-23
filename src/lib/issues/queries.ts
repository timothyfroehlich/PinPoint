import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { eq, and, desc, isNull, type SQL } from "drizzle-orm";

export interface IssueFilters {
  machineId?: string | undefined;
  status?: string | undefined;
  severity?: string | undefined;
  assignedTo?: string | undefined;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function getIssues(filters: IssueFilters) {
  const { machineId, status, severity, assignedTo } = filters;

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

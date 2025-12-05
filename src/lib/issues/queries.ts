import { cache } from "react";
import { type IssueListItem } from "~/lib/types";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { eq, and, desc, isNull, type SQL } from "drizzle-orm";

export interface IssueFilters {
  machineInitials?: string | undefined;
  status?: string | undefined;
  severity?: string | undefined;
  priority?: string | undefined;
  assignedTo?: string | undefined;
}

export const getIssues = cache(
  async (filters: IssueFilters): Promise<IssueListItem[]> => {
    const { machineInitials, status, severity, priority, assignedTo } = filters;

    // Build where conditions for filtering
    const conditions: SQL[] = [];

    if (machineInitials) {
      conditions.push(eq(issues.machineInitials, machineInitials));
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
            initials: true,
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
);

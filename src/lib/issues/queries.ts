import { cache } from "react";
import type {
  IssueListItem,
  IssueStatus,
  IssueSeverity,
  IssuePriority,
} from "~/lib/types";
import { ALL_ISSUE_STATUSES } from "~/lib/issues/status";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { eq, and, desc, isNull, inArray, type SQL } from "drizzle-orm";

export interface IssueFilters {
  machineInitials?: string | undefined;
  status?: string | string[] | undefined;
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

    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      // Type-safe filtering using imported constants from single source of truth
      const validStatuses = statuses.filter((s): s is IssueStatus =>
        ALL_ISSUE_STATUSES.includes(s as IssueStatus)
      );

      if (validStatuses.length > 0) {
        conditions.push(inArray(issues.status, validStatuses));
      }
    }

    if (
      severity &&
      ["cosmetic", "minor", "major", "unplayable"].includes(severity)
    ) {
      conditions.push(eq(issues.severity, severity as IssueSeverity));
    }

    if (priority && ["low", "medium", "high"].includes(priority)) {
      conditions.push(eq(issues.priority, priority as IssuePriority));
    }

    if (assignedTo === "unassigned") {
      conditions.push(isNull(issues.assignedTo));
    } else if (assignedTo) {
      conditions.push(eq(issues.assignedTo, assignedTo));
    }

    // Query issues with filters
    // Type assertion needed because Drizzle infers status as string, not IssueStatus
    return (await db.query.issues.findMany({
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
    })) as IssueListItem[];
  }
);

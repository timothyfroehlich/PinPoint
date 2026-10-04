import "server-only";

import {
  and,
  desc,
  eq,
  exists,
  inArray,
  not,
  notInArray,
  sql,
  type InferSelectModel,
} from "drizzle-orm";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import {
  issueMachineNotRemoved,
  machineNotRemoved,
} from "~/lib/machines/queries";
import type { DbTransaction } from "~/server/db";
import { issues, machines, userProfiles } from "~/server/db/schema";

type DashboardIssueColumns = Pick<
  InferSelectModel<typeof issues>,
  | "id"
  | "title"
  | "status"
  | "severity"
  | "priority"
  | "frequency"
  | "machineInitials"
  | "issueNumber"
  | "createdAt"
  | "reporterName"
>;

interface DashboardMachineRef {
  id: string;
  name: string;
  initials: string;
}

interface DashboardPersonRef {
  id: string;
  name: string;
}

export type DashboardAssignedIssue = DashboardIssueColumns & {
  machine: DashboardMachineRef;
};

export type DashboardRecentIssue = DashboardIssueColumns & {
  machine: DashboardMachineRef;
  reportedByUser: DashboardPersonRef | null;
  invitedReporter: DashboardPersonRef | null;
};

export interface DashboardData {
  userProfile: DashboardPersonRef | undefined;
  assignedIssues: DashboardAssignedIssue[];
  recentIssues: DashboardRecentIssue[];
  newestMachines: (DashboardMachineRef & { createdAt: Date })[];
  recentlyFixedMachines: (DashboardMachineRef & { fixedAt: Date | null })[];
  totalOpenIssues: number;
  machinesNeedingService: number;
  myIssuesCount: number;
}

/**
 * Every dashboard query, run in parallel. Removed machines and the issues on
 * them are left out of every list and count here (PP-s363).
 */
export async function loadDashboardData(
  tx: DbTransaction,
  userId?: string
): Promise<DashboardData> {
  // Query 1: User Profile
  // Fetch user profile to ensure existence or display name (parallelized)
  const userProfilePromise = userId
    ? tx.query.userProfiles.findFirst({
        where: eq(userProfiles.id, userId),
        columns: {
          id: true,
          name: true,
        },
      })
    : Promise.resolve(undefined);

  // Query 2: Issues assigned to current user (with machine relation)
  // Run this conditionally if userId is present, otherwise return empty array
  const assignedIssuesPromise = userId
    ? tx.query.issues.findMany({
        where: and(
          eq(issues.assignedTo, userId),
          notInArray(issues.status, [...CLOSED_STATUSES]),
          issueMachineNotRemoved()
        ),
        orderBy: desc(issues.createdAt),
        limit: 10,
        with: {
          machine: {
            columns: {
              id: true,
              name: true,
              initials: true,
            },
          },
        },
        columns: {
          id: true,
          title: true,
          status: true,
          severity: true,
          priority: true,
          frequency: true,
          machineInitials: true,
          issueNumber: true,
          createdAt: true,
          reporterName: true,
        },
      })
    : Promise.resolve([]);

  // Query 2b: Count of issues assigned to current user (Fixes capped count bug & optimizes)
  const assignedIssuesCountPromise = userId
    ? tx
        .select({ count: sql<number>`count(*)::int` })
        .from(issues)
        .where(
          and(
            eq(issues.assignedTo, userId),
            notInArray(issues.status, [...CLOSED_STATUSES]),
            issueMachineNotRemoved()
          )
        )
    : Promise.resolve([{ count: 0 }]);

  // Query 3: Recently reported issues (last 10, with machine and all reporter types)
  const recentIssuesPromise = tx.query.issues.findMany({
    where: issueMachineNotRemoved(),
    orderBy: desc(issues.createdAt),
    limit: 10,
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
      invitedReporter: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
    columns: {
      id: true,
      title: true,
      status: true,
      severity: true,
      priority: true,
      frequency: true,
      machineInitials: true,
      issueNumber: true,
      createdAt: true,
      reporterName: true,
    },
  });

  // Query 4: Newest machines (3 most recently added)
  const newestMachinesPromise = tx.query.machines.findMany({
    where: machineNotRemoved(),
    orderBy: desc(machines.createdAt),
    limit: 3,
    columns: {
      id: true,
      name: true,
      initials: true,
      createdAt: true,
    },
  });

  // Query 4b: Recently fixed machines
  // Machines that had major/unplayable issues but now have none
  // Ordered by when the last major/unplayable issue was closed
  const recentlyFixedMachinesPromise = tx
    .select({
      id: machines.id,
      name: machines.name,
      initials: machines.initials,
      fixedAt: sql<Date | null>`max(${issues.updatedAt})`.as("fixed_at"),
    })
    .from(machines)
    .innerJoin(issues, eq(issues.machineInitials, machines.initials))
    .where(
      and(
        machineNotRemoved(),
        // Issue was major or unplayable
        inArray(issues.severity, ["major", "unplayable"]),
        // Issue is now closed
        inArray(issues.status, [...CLOSED_STATUSES]),
        // Machine has NO open major/unplayable issues currently
        not(
          exists(
            tx
              .select({ one: sql`1` })
              .from(issues)
              .where(
                and(
                  eq(issues.machineInitials, machines.initials),
                  inArray(issues.severity, ["major", "unplayable"]),
                  notInArray(issues.status, [...CLOSED_STATUSES])
                )
              )
          )
        )
      )
    )
    .groupBy(machines.id, machines.name, machines.initials)
    .orderBy(sql`max(${issues.updatedAt}) DESC`)
    .limit(3);

  // Query 5: Total open issues count
  const totalOpenIssuesPromise = tx
    .select({ count: sql<number>`count(*)::int` })
    .from(issues)
    .where(
      and(
        notInArray(issues.status, [...CLOSED_STATUSES]),
        issueMachineNotRemoved()
      )
    );

  // Query 6: Machines needing service (machines with `major` or `unplayable` open issues)
  // count(distinct) on the issues table; Removed machines drop out through
  // the correlated presence check rather than a JOIN.
  const machinesNeedingServicePromise = tx
    .select({
      count: sql<number>`count(distinct ${issues.machineInitials})::int`,
    })
    .from(issues)
    .where(
      and(
        notInArray(issues.status, [...CLOSED_STATUSES]),
        inArray(issues.severity, ["major", "unplayable"]),
        issueMachineNotRemoved()
      )
    );

  // Execute all queries in parallel
  const [
    userProfile,
    assignedIssues,
    assignedIssuesCountResult,
    recentIssues,
    newestMachines,
    recentlyFixedMachines,
    totalOpenIssuesResult,
    machinesNeedingServiceResult,
  ] = await Promise.all([
    userProfilePromise,
    assignedIssuesPromise,
    assignedIssuesCountPromise,
    recentIssuesPromise,
    newestMachinesPromise,
    recentlyFixedMachinesPromise,
    totalOpenIssuesPromise,
    machinesNeedingServicePromise,
  ]);

  const totalOpenIssues = totalOpenIssuesResult[0]?.count ?? 0;
  const machinesNeedingService = machinesNeedingServiceResult[0]?.count ?? 0;
  const myIssuesCount = assignedIssuesCountResult[0]?.count ?? 0;

  return {
    userProfile,
    assignedIssues,
    recentIssues,
    newestMachines,
    recentlyFixedMachines,
    totalOpenIssues,
    machinesNeedingService,
    myIssuesCount,
  };
}

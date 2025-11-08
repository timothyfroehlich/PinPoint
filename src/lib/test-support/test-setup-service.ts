import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "~/lib/dal/shared";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function getSchemaTables() {
  return await import("~/server/db/schema");
}

export interface TestSetupState {
  machine: { qrCodeId: string | null; isPublic: boolean | null };
  organization: {
    allowAnonymousIssues: boolean;
    isPublic: boolean | null;
  };
  defaults: {
    statusId: string | null;
    priorityId: string | null;
  };
}

export async function enableAnonymousReportingMutation(params: {
  machineId: string;
  organizationId: string;
  statusId?: string;
  priorityId?: string;
}): Promise<void> {
  const { organizations, machines, issueStatuses, priorities } =
    await getSchemaTables();

  const [targetStatus, targetPriority] = await Promise.all([
    params.statusId
      ? getDb().query.issueStatuses.findFirst({
          where: and(
            eq(issueStatuses.id, params.statusId),
            eq(issueStatuses.organization_id, params.organizationId),
          ),
        })
      : undefined,
    params.priorityId
      ? getDb().query.priorities.findFirst({
          where: and(
            eq(priorities.id, params.priorityId),
            eq(priorities.organization_id, params.organizationId),
          ),
        })
      : undefined,
  ]);

  if (params.statusId && !targetStatus) {
    throw new Error("Status not found for organization");
  }

  if (params.priorityId && !targetPriority) {
    throw new Error("Priority not found for organization");
  }

  await getDb().transaction(async (tx) => {
    await tx
      .update(organizations)
      .set({
        allow_anonymous_issues: true,
        is_public: true,
        updated_at: new Date(),
      })
      .where(eq(organizations.id, params.organizationId));

    await tx
      .update(machines)
      .set({
        is_public: true,
        updated_at: new Date(),
      })
      .where(eq(machines.id, params.machineId));

    if (targetStatus) {
      await tx
        .update(issueStatuses)
        .set({ is_default: false })
        .where(eq(issueStatuses.organization_id, params.organizationId));

      await tx
        .update(issueStatuses)
        .set({ is_default: true })
        .where(eq(issueStatuses.id, targetStatus.id));
    }

    if (targetPriority) {
      await tx
        .update(priorities)
        .set({ is_default: false })
        .where(eq(priorities.organization_id, params.organizationId));

      await tx
        .update(priorities)
        .set({ is_default: true })
        .where(eq(priorities.id, targetPriority.id));
    }
  });
}

export async function ensureQrCodeMutation(
  machineId: string,
): Promise<string> {
  const { machines } = await getSchemaTables();
  const [machine] = await getDb()
    .select({ qr_code_id: machines.qr_code_id })
    .from(machines)
    .where(eq(machines.id, machineId));

  if (machine?.qr_code_id) {
    return machine.qr_code_id;
  }

  const qrCodeId = `qr-${randomUUID()}`;
  await getDb()
    .update(machines)
    .set({
      qr_code_id: qrCodeId,
      qr_code_url: null,
      qr_code_generated_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(machines.id, machineId));

  return qrCodeId;
}

export async function findIssueByTitle(title: string): Promise<string | null> {
  const { issues } = await getSchemaTables();
  const [issue] = await getDb()
    .select({ id: issues.id })
    .from(issues)
    .where(eq(issues.title, title))
    .orderBy(issues.created_at)
    .limit(1);

  return issue?.id ?? null;
}

export async function captureStateSnapshot(params: {
  machineId: string;
  organizationId: string;
}): Promise<TestSetupState> {
  const { machines, organizations, issueStatuses, priorities } =
    await getSchemaTables();
  const [machineData] = await getDb()
    .select({
      qr_code_id: machines.qr_code_id,
      is_public: machines.is_public,
    })
    .from(machines)
    .where(eq(machines.id, params.machineId));

  const [orgData] = await getDb()
    .select({
      allow_anonymous_issues: organizations.allow_anonymous_issues,
      is_public: organizations.is_public,
    })
    .from(organizations)
    .where(eq(organizations.id, params.organizationId));

  const [statusDefault] = await getDb()
    .select({ id: issueStatuses.id })
    .from(issueStatuses)
    .where(
      and(
        eq(issueStatuses.organization_id, params.organizationId),
        eq(issueStatuses.is_default, true),
      ),
    )
    .limit(1);

  const [priorityDefault] = await getDb()
    .select({ id: priorities.id })
    .from(priorities)
    .where(
      and(
        eq(priorities.organization_id, params.organizationId),
        eq(priorities.is_default, true),
      ),
    )
    .limit(1);

  return {
    machine: {
      qrCodeId: machineData?.qr_code_id ?? null,
      isPublic: machineData?.is_public ?? null,
    },
    organization: {
      allowAnonymousIssues: orgData?.allow_anonymous_issues ?? false,
      isPublic: orgData?.is_public ?? null,
    },
    defaults: {
      statusId: statusDefault?.id ?? null,
      priorityId: priorityDefault?.id ?? null,
    },
  };
}

export async function restoreStateMutation(params: {
  machineId: string;
  organizationId: string;
  state: TestSetupState;
}): Promise<void> {
  const { machines, organizations, issueStatuses, priorities } =
    await getSchemaTables();
  const machineVisibility =
    params.state.machine.isPublic === null
      ? sql`NULL`
      : params.state.machine.isPublic;
  const organizationVisibility =
    params.state.organization.isPublic === null
      ? sql`NULL`
      : params.state.organization.isPublic;
  await getDb()
    .update(machines)
    .set({
      qr_code_id: params.state.machine.qrCodeId,
      is_public: machineVisibility,
      updated_at: new Date(),
    })
    .where(eq(machines.id, params.machineId));

  await getDb()
    .update(organizations)
    .set({
      allow_anonymous_issues: params.state.organization.allowAnonymousIssues,
      is_public: organizationVisibility,
      updated_at: new Date(),
    })
    .where(eq(organizations.id, params.organizationId));

  if (params.state.defaults.statusId) {
    await getDb()
      .update(issueStatuses)
      .set({ is_default: false })
      .where(eq(issueStatuses.organization_id, params.organizationId));

    await getDb()
      .update(issueStatuses)
      .set({ is_default: true })
      .where(
        and(
          eq(issueStatuses.id, params.state.defaults.statusId),
          eq(issueStatuses.organization_id, params.organizationId),
        ),
      );
  }

  if (params.state.defaults.priorityId) {
    await getDb()
      .update(priorities)
      .set({ is_default: false })
      .where(eq(priorities.organization_id, params.organizationId));

    await getDb()
      .update(priorities)
      .set({ is_default: true })
      .where(
        and(
          eq(priorities.id, params.state.defaults.priorityId),
          eq(priorities.organization_id, params.organizationId),
        ),
      );
  }
}

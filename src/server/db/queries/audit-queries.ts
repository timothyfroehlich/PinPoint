/**
 * @fileoverview This file contains a set of reference queries that demonstrate the correct,
 * consistent use of snake_case field access when interacting with the Drizzle ORM.
 * These queries serve as a living style guide for database interactions.
 *
 * @see src/lib/utils/case-transformers.ts - for transforming results for the API layer.
 * @see src/server/services/validation-helper.ts - for validating query structures.
 */

import { getGlobalDatabaseProvider } from "~/server/db/provider";
import {
  memberships,
  users,
  roles,
  machines,
  issues,
  issueStatuses,
} from "~/server/db/schema";
// Types are used for documentation purposes in this reference file
import { eq, and } from "drizzle-orm";
import { cache } from "react";

/**
 * Demonstrates a complex join with correct snake_case field selection.
 * Note how all selected fields (`user_id`, `organization_id`, `profile_picture`, etc.)
 * are in snake_case, directly matching the database schema.
 *
 * The result of this query should be transformed to camelCase at the API boundary.
 */
export const getMembershipsWithUserAndRole = cache(
  async function getMembershipsWithUserAndRole(organizationId: string): Promise<
    {
      membership_id: string;
      user_id: string | null;
      organization_id: string;
      role_name: string | null;
      user_name: string | null;
      user_email: string | null;
      profile_picture: string | null;
    }[]
  > {
    const dbProvider = getGlobalDatabaseProvider();
    const db = dbProvider.getClient();

    const selectObject = {
      membership_id: memberships.id,
      user_id: memberships.user_id,
      organization_id: memberships.organization_id,
      role_name: roles.name,
      user_name: users.name,
      user_email: users.email,
      profile_picture: users.profile_picture,
    } as const;

    return db
      .select(selectObject)
      .from(memberships)
      .leftJoin(users, eq(memberships.user_id, users.id))
      .leftJoin(roles, eq(memberships.role_id, roles.id))
      .where(eq(memberships.organization_id, organizationId));
  },
);

/**
 * Demonstrates a simple query with a `where` clause using a snake_case field.
 * The `where` condition correctly uses `machines.qr_code_id`.
 */
export const getMachineByQrCode = cache(async function getMachineByQrCode(
  qrCodeId: string,
): Promise<
  {
    id: string;
    name: string;
    qr_code_id: string | null;
    model_id: string;
    location_id: string;
  }[]
> {
  const dbProvider = getGlobalDatabaseProvider();
  const db = dbProvider.getClient();

  const selectObject = {
    id: machines.id,
    name: machines.name,
    qr_code_id: machines.qr_code_id,
    model_id: machines.model_id,
    location_id: machines.location_id,
  } as const;

  return db
    .select(selectObject)
    .from(machines)
    .where(eq(machines.qr_code_id, qrCodeId))
    .limit(1);
});

/**
 * Demonstrates a query with a compound `where` clause, filtering by `status` and `organization_id`.
 * Both fields in the `and()` condition are snake_case.
 */
export const getIssuesByStatus = cache(async function getIssuesByStatus(
  organizationId: string,
  statusName: string,
): Promise<
  {
    issue_id: string;
    issue_title: string;
    machine_name: string | null;
    status: string | null;
    created_at: Date;
  }[]
> {
  const dbProvider = getGlobalDatabaseProvider();
  const db = dbProvider.getClient();

  const selectObject = {
    issue_id: issues.id,
    issue_title: issues.title,
    machine_name: machines.name,
    status: issueStatuses.name,
    created_at: issues.created_at,
  } as const;

  return db
    .select(selectObject)
    .from(issues)
    .leftJoin(machines, eq(issues.machine_id, machines.id))
    .leftJoin(issueStatuses, eq(issues.status_id, issueStatuses.id))
    .where(
      and(
        eq(issues.organization_id, organizationId),
        eq(issueStatuses.name, statusName),
      ),
    );
});

/**
 * This is an anti-pattern example and should not be followed.
 * It shows incorrect camelCase usage that the validation helper would catch.
 * @deprecated
 */
/*
export async function getIssuesByStatus_INCORRECT(organizationId: string) {
  return db
    .select({ issueId: issues.id, createdAt: issues.created_at }) // Incorrect: should be issue_id, created_at
    .from(issues)
    .where(eq(issues.organizationId, organizationId)); // Incorrect: should be issues.organization_id
}
*/

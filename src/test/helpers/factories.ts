/**
 * Test Data Factories
 *
 * Helper functions to create test data with sensible defaults.
 * Override specific fields as needed for your test cases.
 */

import { randomUUID } from "node:crypto";
import type { InferInsertModel } from "drizzle-orm";
import type {
  userProfiles,
  machines,
  issues,
  issueComments,
} from "~/server/db/schema";

/**
 * Create a test user profile
 */
export function createTestUser(
  overrides?: Partial<InferInsertModel<typeof userProfiles>>
): InferInsertModel<typeof userProfiles> {
  return {
    id: overrides?.id ?? randomUUID(),
    name: overrides?.name ?? "Test User",
    avatarUrl: overrides?.avatarUrl ?? null,
    role: overrides?.role ?? "member",
    createdAt: overrides?.createdAt ?? new Date(),
    updatedAt: overrides?.updatedAt ?? new Date(),
  };
}

/**
 * Create a test machine
 */
export function createTestMachine(
  overrides?: Partial<InferInsertModel<typeof machines>>
): InferInsertModel<typeof machines> {
  return {
    id: overrides?.id ?? randomUUID(),
    name: overrides?.name ?? "Test Machine",
    createdAt: overrides?.createdAt ?? new Date(),
    updatedAt: overrides?.updatedAt ?? new Date(),
  };
}

/**
 * Create a test issue
 */
export function createTestIssue(
  machineId: string,
  overrides?: Partial<InferInsertModel<typeof issues>>
): InferInsertModel<typeof issues> {
  return {
    id: overrides?.id ?? randomUUID(),
    machineId,
    title: overrides?.title ?? "Test Issue",
    description: overrides?.description ?? "Test description",
    status: overrides?.status ?? "new",
    severity: overrides?.severity ?? "playable",
    reportedBy: overrides?.reportedBy ?? null,
    assignedTo: overrides?.assignedTo ?? null,
    resolvedAt: overrides?.resolvedAt ?? null,
    createdAt: overrides?.createdAt ?? new Date(),
    updatedAt: overrides?.updatedAt ?? new Date(),
  };
}

/**
 * Create a test comment
 */
export function createTestComment(
  issueId: string,
  overrides?: Partial<InferInsertModel<typeof issueComments>>
): InferInsertModel<typeof issueComments> {
  return {
    id: overrides?.id ?? randomUUID(),
    issueId,
    authorId: overrides?.authorId ?? null,
    content: overrides?.content ?? "Test comment",
    isSystem: overrides?.isSystem ?? false,
    createdAt: overrides?.createdAt ?? new Date(),
    updatedAt: overrides?.updatedAt ?? new Date(),
  };
}

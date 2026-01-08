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

export function createTestUser(
  overrides?: Partial<InferInsertModel<typeof userProfiles>>
): InferInsertModel<typeof userProfiles> {
  return {
    id: randomUUID(),
    email: `test-${randomUUID()}@example.com`,
    firstName: "Test",
    lastName: "User",
    role: "member",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a test machine
 */
export function createTestMachine(
  overrides?: Partial<InferInsertModel<typeof machines>>
): InferInsertModel<typeof machines> {
  return {
    id: randomUUID(),
    initials: "TM",
    name: "Test Machine",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a test issue
 */
export function createTestIssue(
  machineInitials: string,
  overrides?: Partial<InferInsertModel<typeof issues>>
): InferInsertModel<typeof issues> {
  return {
    id: randomUUID(),
    machineInitials,
    issueNumber: 1,
    title: "Test Issue",
    description: "Test description",
    status: "new",
    severity: "minor",
    priority: "low",
    reportedBy: null,
    assignedTo: null,
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
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
    id: randomUUID(),
    issueId,
    authorId: null,
    content: "Test comment",
    isSystem: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

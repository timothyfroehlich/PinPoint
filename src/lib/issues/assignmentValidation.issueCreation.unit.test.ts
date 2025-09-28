/**
 * Issue Creation Validation – Unit Tests (skeleton)
 *
 * This suite covers pure validation logic for issue creation using
 * validateIssueCreation and related helpers. It enumerates happy paths and
 * edge cases (empty title, invalid email, cross-org machine, missing defaults).
 *
 * Use:
 * - SEED_TEST_IDS.MOCK_PATTERNS for stable unit-test IDs
 * - SeedBasedMockFactory (~/test/mocks/seed-based-mocks) for consistent mock entities
 * - Keep tests pure (no DB); prefer strict type checks per NON_NEGOTIABLES
 *
 * Replace the placeholder assertions with real implementations.
 */

import { describe, it, expect } from "vitest";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import {
  validateIssueCreation,
  type IssueCreationInput,
  type Machine,
  type IssueStatus,
  type Priority,
  type AssignmentValidationContext,
} from "~/lib/issues/assignmentValidation";

describe("validateIssueCreation (unit)", () => {
  it("accepts valid input with defaults present and matching org", () => {
    const input: IssueCreationInput = {
      title: "Test Issue",
      description: "Test description",
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    };
    const machine: Machine = {
      id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      name: "Medieval Madness",
      location: {
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      },
    };
    const defaultStatus: IssueStatus = {
      id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
      name: "New",
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      isDefault: true,
    };
    const defaultPriority: Priority = {
      id: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY,
      name: "Medium",
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      isDefault: true,
    };
    const context: AssignmentValidationContext = {
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      userId: SEED_TEST_IDS.USERS.ADMIN,
    };

    const result = validateIssueCreation(input, machine, defaultStatus, defaultPriority, context);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("rejects empty or whitespace-only title", () => {
    const input: IssueCreationInput = {
      title: "   \t\n   ",
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    };
    const machine: Machine = {
      id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      name: "Medieval Madness",
      location: {
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      },
    };
    const defaultStatus: IssueStatus = {
      id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
      name: "New",
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      isDefault: true,
    };
    const defaultPriority: Priority = {
      id: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY,
      name: "Medium",
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      isDefault: true,
    };
    const context: AssignmentValidationContext = {
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      userId: SEED_TEST_IDS.USERS.ADMIN,
    };

    const result = validateIssueCreation(input, machine, defaultStatus, defaultPriority, context);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/title/i);
  });

  it("rejects invalid reporterEmail format when provided", () => {
    const input: PublicIssueCreationInput = {
      title: "Valid title",
      machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
      reporterEmail: "not-an-email",
    };

    const result = validateIssueCreationInput(input);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it("rejects when machine belongs to a different organization", () => {
    const input: MachineOwnershipInput = {
      machine: {
        id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
        location: {
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
        },
      },
      expectedOrganizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    };

    const result = validateMachineOwnership(input);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/organization/i);
    expect(result.error).not.toContain("competitor"); // Should not leak org details
  });

  it("rejects when default status is missing/not default/cross-org", () => {
    const priority = {
      id: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY,
      name: "Medium",
    };

    const result = validateIssueCreationDefaults(null, priority);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/status.*not found/i);
    expect(result.error).toMatch(/administrator/i);
  });

  it("rejects when default priority is missing/not default/cross-org", () => {
    const status = {
      id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
      name: "New",
    };

    const result = validateIssueCreationDefaults(status, null);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/priority.*not found/i);
    expect(result.error).toMatch(/administrator/i);
  });
});

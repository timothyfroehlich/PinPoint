/**
 * Issue Creation Validation – Unit Tests
 *
 * Covers the pure validation helpers used during issue creation. The suite focuses on
 * the acceptance criteria captured in the issue creation spec:
 * - happy-path validation when machine + defaults align with the organization
 * - defensive checks for blank titles and malformed reporter emails
 * - hard org boundaries (machine + defaults must belong to org)
 * - administrative fallbacks when required defaults are missing or misconfigured
 */

import { describe, it, expect } from "vitest";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { SeedBasedMockFactory } from "~/test/mocks/seed-based-mocks";
import {
  validateIssueCreation,
  type AssignmentValidationContext,
  type IssueCreationInput,
  type IssueStatus,
  type Machine,
  type Priority,
} from "~/lib/issues/assignmentValidation";

const buildMachine = (overrides: Partial<Machine> = {}): Machine => {
  const seed = SeedBasedMockFactory.createMockMachine();

  const machine: Machine = {
    id: seed.id,
    name: seed.name,
    location: {
      organizationId: seed.organization_id,
    },
  };

  return {
    ...machine,
    ...overrides,
  };
};

const buildStatus = (overrides: Partial<IssueStatus> = {}): IssueStatus => {
  const seed = SeedBasedMockFactory.createMockIssueStatus({
    id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
    name: "New",
    organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
    is_default: true,
  });

  const status: IssueStatus = {
    id: seed.id,
    name: seed.name,
    organizationId: seed.organization_id,
    isDefault: seed.is_default,
  };

  return {
    ...status,
    ...overrides,
  };
};

const buildPriority = (overrides: Partial<Priority> = {}): Priority => {
  const seed = SeedBasedMockFactory.createMockPriority({
    id: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY,
    name: "Medium",
    organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
    is_default: true,
  });

  const priority: Priority = {
    id: seed.id,
    name: seed.name,
    organizationId: seed.organization_id,
    isDefault: seed.is_default,
  };

  return {
    ...priority,
    ...overrides,
  };
};

const baseContext: AssignmentValidationContext = {
  organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
  actorUserId: SEED_TEST_IDS.USERS.ADMIN,
  userPermissions: ["issue:create"],
};

const baseInput: IssueCreationInput = {
  title: "Display flickering intermittently",
  description: "Screen flashes during bonus rounds.",
  machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
  organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
  reporterEmail: "player@example.com",
  submitterName: "Test Player",
};

describe("validateIssueCreation", () => {
  it("returns valid when machine and defaults belong to the organization", () => {
    const result = validateIssueCreation(
      baseInput,
      buildMachine(),
      buildStatus(),
      buildPriority(),
      baseContext,
    );

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("rejects blank titles", () => {
    const result = validateIssueCreation(
      { ...baseInput, title: "   \n\t   " },
      buildMachine(),
      buildStatus(),
      buildPriority(),
      baseContext,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Issue title cannot be empty");
  });

  it("rejects malformed reporter emails", () => {
    const result = validateIssueCreation(
      { ...baseInput, reporterEmail: "not-an-email" },
      buildMachine(),
      buildStatus(),
      buildPriority(),
      baseContext,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid email address");
  });

  it("enforces machine organization boundaries", () => {
    const machine = buildMachine({
      location: {
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
      },
    });

    const result = validateIssueCreation(
      baseInput,
      machine,
      buildStatus(),
      buildPriority(),
      baseContext,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      "Machine not found or does not belong to this organization",
    );
    expect(result.error).not.toContain(
      SEED_TEST_IDS.ORGANIZATIONS.competitor,
    );
  });

  it("fails when default status is missing", () => {
    const result = validateIssueCreation(
      baseInput,
      buildMachine(),
      null,
      buildPriority(),
      baseContext,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      "Default issue status not found. Please contact an administrator.",
    );
  });

  it("fails when default status belongs to another organization", () => {
    const result = validateIssueCreation(
      baseInput,
      buildMachine(),
      buildStatus({
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
      }),
      buildPriority(),
      baseContext,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      "Default status does not belong to this organization",
    );
  });

  it("fails when default status is not marked default", () => {
    const result = validateIssueCreation(
      baseInput,
      buildMachine(),
      buildStatus({ isDefault: false }),
      buildPriority(),
      baseContext,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Status is not marked as default");
  });

  it("fails when default priority is missing", () => {
    const result = validateIssueCreation(
      baseInput,
      buildMachine(),
      buildStatus(),
      null,
      baseContext,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      "Default priority not found. Please contact an administrator.",
    );
  });

  it("fails when default priority belongs to another organization", () => {
    const result = validateIssueCreation(
      baseInput,
      buildMachine(),
      buildStatus(),
      buildPriority({
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
      }),
      baseContext,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      "Default priority does not belong to this organization",
    );
  });

  it("fails when default priority is not marked default", () => {
    const result = validateIssueCreation(
      baseInput,
      buildMachine(),
      buildStatus(),
      buildPriority({ isDefault: false }),
      baseContext,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Priority is not marked as default");
  });
});

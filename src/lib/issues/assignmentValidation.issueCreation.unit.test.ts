/**
 * Issue Creation Validation – Unit Tests
 *
 * This suite covers pure validation logic for issue creation using
 * validateIssueCreation and related helpers. It enumerates happy paths and
 * edge cases (empty title, invalid email, cross-org machine, missing defaults).
 *
 * Use:
 * - SEED_TEST_IDS.MOCK_PATTERNS for stable unit-test IDs
 * - SeedBasedMockFactory (~/test/mocks/seed-based-mocks) for consistent mock entities
 * - Keep tests pure (no DB); prefer strict type checks per NON_NEGOTIABLES
 */
import { describe, it, expect } from "vitest";
import { validateIssueCreation } from "~/lib/issues/assignmentValidation";
import type {
  AssignmentValidationContext,
  IssueCreationInput,
  Machine,
  IssueStatus,
  Priority,
} from "~/lib/issues/assignmentValidation";
import { SeedBasedMockFactory } from "~/test/mocks/seed-based-mocks";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

const primaryOrgId = SEED_TEST_IDS.ORGANIZATIONS.primary;
const competitorOrgId = SEED_TEST_IDS.ORGANIZATIONS.competitor;

const baseInput: IssueCreationInput = {
  title: "Test Issue",
  machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
  organizationId: primaryOrgId,
};

const baseContext: AssignmentValidationContext = {
  organizationId: primaryOrgId,
  actorUserId: SEED_TEST_IDS.USERS.ADMIN,
  userPermissions: ["issue:create"],
};

describe("validateIssueCreation (unit)", () => {
  it("accepts valid input with defaults present and matching org", () => {
    const machine = SeedBasedMockFactory.createMockMachine({
      location: { organizationId: primaryOrgId },
    });
    const status = SeedBasedMockFactory.createMockIssueStatus({
      organizationId: primaryOrgId,
      isDefault: true,
    });
    const priority = SeedBasedMockFactory.createMockPriority({
      organizationId: primaryOrgId,
      isDefault: true,
    });

    const result = validateIssueCreation(
      baseInput,
      machine,
      status,
      priority,
      baseContext,
    );

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("rejects empty or whitespace-only title", () => {
    const machine = SeedBasedMockFactory.createMockMachine({
      location: { organizationId: primaryOrgId },
    });
    const status = SeedBasedMockFactory.createMockIssueStatus({
      organizationId: primaryOrgId,
      isDefault: true,
    });
    const priority = SeedBasedMockFactory.createMockPriority({
      organizationId: primaryOrgId,
      isDefault: true,
    });

    const emptyTitleResult = validateIssueCreation(
      { ...baseInput, title: "" },
      machine,
      status,
      priority,
      baseContext,
    );
    expect(emptyTitleResult.valid).toBe(false);
    expect(emptyTitleResult.error).toBe("Issue title cannot be empty");

    const whitespaceTitleResult = validateIssueCreation(
      { ...baseInput, title: "   " },
      machine,
      status,
      priority,
      baseContext,
    );
    expect(whitespaceTitleResult.valid).toBe(false);
    expect(whitespaceTitleResult.error).toBe("Issue title cannot be empty");
  });

  it("rejects invalid reporterEmail format when provided", () => {
    const machine = SeedBasedMockFactory.createMockMachine({
      location: { organizationId: primaryOrgId },
    });
    const status = SeedBasedMockFactory.createMockIssueStatus({
      organizationId: primaryOrgId,
      isDefault: true,
    });
    const priority = SeedBasedMockFactory.createMockPriority({
      organizationId: primaryOrgId,
      isDefault: true,
    });

    const result = validateIssueCreation(
      { ...baseInput, reporterEmail: "invalid-email" },
      machine,
      status,
      priority,
      baseContext,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid email");
  });

  it("rejects when machine belongs to a different organization", () => {
    const machine = SeedBasedMockFactory.createMockMachine({
      location: { organizationId: competitorOrgId },
    });
    const status = SeedBasedMockFactory.createMockIssueStatus({
      organizationId: primaryOrgId,
      isDefault: true,
    });
    const priority = SeedBasedMockFactory.createMockPriority({
      organizationId: primaryOrgId,
      isDefault: true,
    });

    const result = validateIssueCreation(
      baseInput,
      machine,
      status,
      priority,
      baseContext,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      "Machine not found or does not belong to this organization",
    );
  });

  it("rejects when default status is missing/not default/cross-org", () => {
    const machine = SeedBasedMockFactory.createMockMachine({
      location: { organizationId: primaryOrgId },
    });
    const priority = SeedBasedMockFactory.createMockPriority({
      organizationId: primaryOrgId,
      isDefault: true,
    });

    // Missing status
    const missingResult = validateIssueCreation(
      baseInput,
      machine,
      null,
      priority,
      baseContext,
    );
    expect(missingResult.valid).toBe(false);
    expect(missingResult.error).toBe(
      "Default issue status not found. Please contact an administrator.",
    );

    // Not default
    const notDefaultStatus = SeedBasedMockFactory.createMockIssueStatus({
      organizationId: primaryOrgId,
      isDefault: false,
    });
    const notDefaultResult = validateIssueCreation(
      baseInput,
      machine,
      notDefaultStatus,
      priority,
      baseContext,
    );
    expect(notDefaultResult.valid).toBe(false);
    expect(notDefaultResult.error).toBe("Status is not marked as default");

    // Cross-org
    const crossOrgStatus = SeedBasedMockFactory.createMockIssueStatus({
      organizationId: competitorOrgId,
      isDefault: true,
    });
    const crossOrgResult = validateIssueCreation(
      baseInput,
      machine,
      crossOrgStatus,
      priority,
      baseContext,
    );
    expect(crossOrgResult.valid).toBe(false);
    expect(crossOrgResult.error).toBe(
      "Default status does not belong to this organization",
    );
  });

  it("rejects when default priority is missing/not default/cross-org", () => {
    const machine = SeedBasedMockFactory.createMockMachine({
      location: { organizationId: primaryOrgId },
    });
    const status = SeedBasedMockFactory.createMockIssueStatus({
      organizationId: primaryOrgId,
      isDefault: true,
    });

    // Missing priority
    const missingResult = validateIssueCreation(
      baseInput,
      machine,
      status,
      null,
      baseContext,
    );
    expect(missingResult.valid).toBe(false);
    expect(missingResult.error).toBe(
      "Default priority not found. Please contact an administrator.",
    );

    // Not default
    const notDefaultPriority = SeedBasedMockFactory.createMockPriority({
      organizationId: primaryOrgId,
      isDefault: false,
    });
    const notDefaultResult = validateIssueCreation(
      baseInput,
      machine,
      status,
      notDefaultPriority,
      baseContext,
    );
    expect(notDefaultResult.valid).toBe(false);
    expect(notDefaultResult.error).toBe("Priority is not marked as default");

    // Cross-org
    const crossOrgPriority = SeedBasedMockFactory.createMockPriority({
      organizationId: competitorOrgId,
      isDefault: true,
    });
    const crossOrgResult = validateIssueCreation(
      baseInput,
      machine,
      status,
      crossOrgPriority,
      baseContext,
    );
    expect(crossOrgResult.valid).toBe(false);
    expect(crossOrgResult.error).toBe(
      "Default priority does not belong to this organization",
    );
  });
});

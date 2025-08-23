import { describe, it, expect } from "vitest";

import {
  validateMachineOwnership,
  validateIssueCreationInput,
  buildIssueCreationData,
  validateIssueCreationDefaults,
  validateCompleteIssueCreation,
  getIssueCreationNotificationEffects,
} from "../creationValidation";

import type {
  MachineOwnershipInput,
  PublicIssueCreationInput,
  AuthenticatedIssueCreationInput,
  IssueCreationDefaults,
  IssueCreationContext,
} from "../creationValidation";

// Import test constants
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import {
  testValidationFunction,
  TEST_SCENARIOS,
} from "~/test/helpers/pure-function-test-utils";

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

function createMockMachine(
  overrides: Partial<MachineOwnershipInput["machine"]> = {},
): MachineOwnershipInput["machine"] {
  return {
    id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    location: {
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    },
    ...overrides,
  };
}

function createMockDefaults(
  overrides: Partial<IssueCreationDefaults> = {},
): IssueCreationDefaults {
  return {
    status: {
      id: SEED_TEST_IDS.STATUSES.NEW,
      name: "New",
    },
    priority: {
      id: SEED_TEST_IDS.PRIORITIES.MEDIUM,
      name: "Medium",
    },
    ...overrides,
  };
}

function createPublicIssueInput(
  overrides: Partial<PublicIssueCreationInput> = {},
): PublicIssueCreationInput {
  return {
    title: "Test Issue",
    machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    ...overrides,
  };
}

function createAuthenticatedIssueInput(
  overrides: Partial<AuthenticatedIssueCreationInput> = {},
): AuthenticatedIssueCreationInput {
  return {
    title: "Test Issue",
    machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    ...overrides,
  };
}

function createContext(
  overrides: Partial<IssueCreationContext> = {},
): IssueCreationContext {
  return {
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    ...overrides,
  };
}

// =============================================================================
// VALIDATION TESTS
// =============================================================================

describe("creationValidation", () => {
  describe("validateMachineOwnership", () => {
    it("should allow machine ownership within same organization", () => {
      const machine = createMockMachine();
      const input = {
        machine,
        expectedOrganizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      };

      const result = validateMachineOwnership(input);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject null machine", () => {
      const input = {
        machine: null,
        expectedOrganizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      };

      const result = validateMachineOwnership(input);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Machine not found or does not belong to this organization",
      );
    });

    it("should reject machine from different organization", () => {
      const machine = createMockMachine({
        location: { organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor },
      });
      const input = {
        machine,
        expectedOrganizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      };

      const result = validateMachineOwnership(input);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Machine not found or does not belong to this organization",
      );
    });
  });

  describe("validateIssueCreationInput", () => {
    describe("Title validation", () => {
      const validateTitle = (title: string) =>
        validateIssueCreationInput(createPublicIssueInput({ title })).valid;
      testValidationFunction(
        validateTitle,
        ["Valid Title", "A".repeat(255)],
        ["", "   ", "A".repeat(256)],
      );
    });

    describe("Description validation", () => {
      const validateDescription = (description: string) =>
        validateIssueCreationInput(createPublicIssueInput({ description }))
          .valid;
      testValidationFunction(
        validateDescription,
        ["Valid description", "", "A".repeat(2000)],
        ["A".repeat(2001)],
      );
    });

    describe("Machine ID validation", () => {
      const validateMachineId = (machineId: string) =>
        validateIssueCreationInput(createPublicIssueInput({ machineId })).valid;
      testValidationFunction(validateMachineId, ["machine-1"], ["", "   "]);
    });

    describe("Email validation for public issues", () => {
      const validateEmail = (reporterEmail: string) =>
        validateIssueCreationInput(createPublicIssueInput({ reporterEmail }))
          .valid;
      testValidationFunction(validateEmail, TEST_SCENARIOS.emails.valid, [
        ...TEST_SCENARIOS.emails.invalid.filter(
          (e) => typeof e === "string" && e.length > 0,
        ),
        "invalid-email",
      ]);
    });

    describe("Authenticated issue input", () => {
      it("should validate authenticated issue input", () => {
        const input = createAuthenticatedIssueInput({
          severity: "High",
          description: "Authenticated issue",
        });

        const result = validateIssueCreationInput(input);

        expect(result.valid).toBe(true);
      });
    });
  });

  describe("buildIssueCreationData", () => {
    const defaults = createMockDefaults();
    const context = createContext();

    it("should build basic issue data", () => {
      const input = createPublicIssueInput();

      const result = buildIssueCreationData(input, defaults, context);

      expect(result.valid).toBe(true);
      expect(result.data).toEqual({
        title: "Test Issue",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        statusId: SEED_TEST_IDS.STATUSES.NEW,
        priorityId: SEED_TEST_IDS.PRIORITIES.MEDIUM,
        createdById: null,
      });
    });

    it("should build issue data with authenticated user", () => {
      const input = createPublicIssueInput();
      const contextWithUser = createContext({
        userId: SEED_TEST_IDS.USERS.ADMIN,
      });

      const result = buildIssueCreationData(input, defaults, contextWithUser);

      expect(result.valid).toBe(true);
      expect(result.data).toEqual({
        title: "Test Issue",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        statusId: SEED_TEST_IDS.STATUSES.NEW,
        priorityId: SEED_TEST_IDS.PRIORITIES.MEDIUM,
        createdById: SEED_TEST_IDS.USERS.ADMIN,
      });
    });

    it("should include description when provided", () => {
      const input = createPublicIssueInput({
        description: "Test description",
      });

      const result = buildIssueCreationData(input, defaults, context);

      expect(result.valid).toBe(true);
      expect(result.data?.description).toBe("Test description");
    });

    it("should trim and include description", () => {
      const input = createPublicIssueInput({
        description: "  Test description  ",
      });

      const result = buildIssueCreationData(input, defaults, context);

      expect(result.valid).toBe(true);
      expect(result.data?.description).toBe("Test description");
    });

    it("should not include empty description", () => {
      const input = createPublicIssueInput({
        description: "   ",
      });

      const result = buildIssueCreationData(input, defaults, context);

      expect(result.valid).toBe(true);
      expect(result.data?.description).toBeUndefined();
    });

    it("should include reporter email when provided", () => {
      const input = createPublicIssueInput({
        reporterEmail: "test@example.com",
      });

      const result = buildIssueCreationData(input, defaults, context);

      expect(result.valid).toBe(true);
      expect(result.data?.reporterEmail).toBe("test@example.com");
    });

    it("should include submitter name when provided", () => {
      const input = createPublicIssueInput({
        submitterName: "John Doe",
      });

      const result = buildIssueCreationData(input, defaults, context);

      expect(result.valid).toBe(true);
      expect(result.data?.submitterName).toBe("John Doe");
    });

    it("should trim title", () => {
      const input = createPublicIssueInput({
        title: "  Test Issue  ",
      });

      const result = buildIssueCreationData(input, defaults, context);

      expect(result.valid).toBe(true);
      expect(result.data?.title).toBe("Test Issue");
    });
  });

  describe("validateIssueCreationDefaults", () => {
    it("should validate complete defaults", () => {
      const status = { id: SEED_TEST_IDS.STATUSES.NEW, name: "New" };
      const priority = {
        id: SEED_TEST_IDS.PRIORITIES.MEDIUM,
        name: "Medium",
      };

      const result = validateIssueCreationDefaults(status, priority);

      expect(result.valid).toBe(true);
      expect(result.data).toEqual({
        status,
        priority,
      });
    });

    it("should reject null status", () => {
      const priority = {
        id: SEED_TEST_IDS.PRIORITIES.MEDIUM,
        name: "Medium",
      };

      const result = validateIssueCreationDefaults(null, priority);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Default issue status not found. Please contact an administrator.",
      );
    });

    it("should reject null priority", () => {
      const status = { id: SEED_TEST_IDS.STATUSES.NEW, name: "New" };

      const result = validateIssueCreationDefaults(status, null);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Default priority not found. Please contact an administrator.",
      );
    });

    it("should reject both null status and priority", () => {
      const result = validateIssueCreationDefaults(null, null);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Default issue status not found. Please contact an administrator.",
      );
    });
  });

  describe("validateCompleteIssueCreation", () => {
    const machine = createMockMachine();
    const status = { id: SEED_TEST_IDS.STATUSES.NEW, name: "New" };
    const priority = {
      id: SEED_TEST_IDS.PRIORITIES.MEDIUM,
      name: "Medium",
    };
    const context = createContext();

    it("should validate complete issue creation flow", () => {
      const input = createPublicIssueInput({
        title: "Complete Test Issue",
        description: "Complete description",
        reporterEmail: "test@example.com",
      });

      const result = validateCompleteIssueCreation(
        input,
        machine,
        status,
        priority,
        context,
      );

      expect(result.valid).toBe(true);
      expect(result.data?.issueData).toEqual({
        title: "Complete Test Issue",
        description: "Complete description",
        reporterEmail: "test@example.com",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        statusId: SEED_TEST_IDS.STATUSES.NEW,
        priorityId: SEED_TEST_IDS.PRIORITIES.MEDIUM,
        createdById: null,
      });
      expect(result.data?.defaults).toEqual({
        status,
        priority,
      });
    });

    it("should fail on invalid input", () => {
      const input = createPublicIssueInput({ title: "" });

      const result = validateCompleteIssueCreation(
        input,
        machine,
        status,
        priority,
        context,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Title is required");
    });

    it("should fail on invalid machine ownership", () => {
      const input = createPublicIssueInput();
      const invalidMachine = createMockMachine({
        location: { organizationId: "other-org" },
      });

      const result = validateCompleteIssueCreation(
        input,
        invalidMachine,
        status,
        priority,
        context,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Machine not found or does not belong to this organization",
      );
    });

    it("should fail on null machine", () => {
      const input = createPublicIssueInput();

      const result = validateCompleteIssueCreation(
        input,
        null,
        status,
        priority,
        context,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Machine not found or does not belong to this organization",
      );
    });

    it("should fail on missing defaults", () => {
      const input = createPublicIssueInput();

      const result = validateCompleteIssueCreation(
        input,
        machine,
        null,
        priority,
        context,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Default issue status not found. Please contact an administrator.",
      );
    });
  });

  describe("getIssueCreationNotificationEffects", () => {
    it("should determine notification effects for public issue", () => {
      const effects = getIssueCreationNotificationEffects(
        "public",
        SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      );

      expect(effects).toEqual({
        shouldNotifyMachineOwner: true,
        shouldRecordActivity: false,
        notificationData: {
          machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
          type: "public",
        },
      });
    });

    it("should determine notification effects for authenticated issue", () => {
      const effects = getIssueCreationNotificationEffects(
        "authenticated",
        SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      );

      expect(effects).toEqual({
        shouldNotifyMachineOwner: true,
        shouldRecordActivity: true,
        notificationData: {
          machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
          type: "authenticated",
        },
      });
    });
  });

  describe("Edge Cases and Error Conditions", () => {
    it("should handle very long valid inputs", () => {
      const longTitle = "A".repeat(255);
      const longDescription = "B".repeat(2000);
      const input = createPublicIssueInput({
        title: longTitle,
        description: longDescription,
      });

      const result = validateIssueCreationInput(input);

      expect(result.valid).toBe(true);
    });

    it("should handle special characters in title", () => {
      const input = createPublicIssueInput({
        title: "Issue with @#$%^&*()! characters",
      });

      const result = validateIssueCreationInput(input);

      expect(result.valid).toBe(true);
    });

    it("should handle unicode characters", () => {
      const input = createPublicIssueInput({
        title: "Issue with 🎮 emojis and 中文",
        description: "Description with ñáéíóú accents",
      });

      const result = validateIssueCreationInput(input);

      expect(result.valid).toBe(true);
    });
  });

  describe("Business Rule Coverage", () => {
    it("should test all severity levels for authenticated issues", () => {
      const severities = ["Low", "Medium", "High", "Critical"] as const;

      for (const severity of severities) {
        const input = createAuthenticatedIssueInput({ severity });
        const result = validateIssueCreationInput(input);
        expect(result.valid).toBe(true);
      }
    });

    it("should validate complete flow for all issue types", () => {
      const machine = createMockMachine();
      const status = { id: SEED_TEST_IDS.STATUSES.NEW, name: "New" };
      const priority = {
        id: SEED_TEST_IDS.PRIORITIES.MEDIUM,
        name: "Medium",
      };

      // Public issue
      const publicInput = createPublicIssueInput({
        reporterEmail: "public@example.com",
        submitterName: "Public User",
      });
      const publicContext = createContext();

      const publicResult = validateCompleteIssueCreation(
        publicInput,
        machine,
        status,
        priority,
        publicContext,
      );

      expect(publicResult.valid).toBe(true);
      expect(publicResult.data?.issueData.createdById).toBeNull();

      // Authenticated issue
      const authInput = createAuthenticatedIssueInput({
        severity: "High",
        description: "Authenticated issue",
      });
      const authContext = createContext({
        userId: SEED_TEST_IDS.USERS.ADMIN,
      });

      const authResult = validateCompleteIssueCreation(
        authInput,
        machine,
        status,
        priority,
        authContext,
      );

      expect(authResult.valid).toBe(true);
      expect(authResult.data?.issueData.createdById).toBe(
        SEED_TEST_IDS.USERS.ADMIN,
      );
    });

    it("should validate organization boundary for all scenarios", () => {
      const organizations = [
        SEED_TEST_IDS.ORGANIZATIONS.primary,
        SEED_TEST_IDS.ORGANIZATIONS.competitor,
        "org-3",
      ];

      for (const expectedOrg of organizations) {
        for (const machineOrg of organizations) {
          const testMachine = createMockMachine({
            location: { organizationId: machineOrg },
          });

          const result = validateMachineOwnership({
            machine: testMachine,
            expectedOrganizationId: expectedOrg,
          });

          if (expectedOrg === machineOrg) {
            expect(result.valid).toBe(true);
          } else {
            expect(result.valid).toBe(false);
            expect(result.error).toBe(
              "Machine not found or does not belong to this organization",
            );
          }
        }
      }
    });
  });
});

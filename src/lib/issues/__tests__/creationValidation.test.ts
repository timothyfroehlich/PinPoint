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
import { SEED_TEST_IDS } from "../../../test/constants/seed-test-ids";
import { MOCK_IDS } from "../../../test/utils/mock-ids";

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

function createMockMachine(
  overrides: Partial<MachineOwnershipInput["machine"]> = {},
): MachineOwnershipInput["machine"] {
  return {
    id: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
    location: {
      organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
    },
    ...overrides,
  };
}

function createMockDefaults(
  overrides: Partial<IssueCreationDefaults> = {},
): IssueCreationDefaults {
  return {
    status: {
      id: SEED_TEST_IDS.MOCK_PATTERNS.STATUS,
      name: "New",
    },
    priority: {
      id: SEED_TEST_IDS.MOCK_PATTERNS.PRIORITY,
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
    machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
    ...overrides,
  };
}

function createAuthenticatedIssueInput(
  overrides: Partial<AuthenticatedIssueCreationInput> = {},
): AuthenticatedIssueCreationInput {
  return {
    title: "Test Issue",
    machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
    ...overrides,
  };
}

function createContext(
  overrides: Partial<IssueCreationContext> = {},
): IssueCreationContext {
  return {
    organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
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
        expectedOrganizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
      };

      const result = validateMachineOwnership(input);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject null machine", () => {
      const input = {
        machine: null,
        expectedOrganizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
      };

      const result = validateMachineOwnership(input);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Machine not found or does not belong to this organization",
      );
    });

    it("should reject machine from different organization", () => {
      const machine = createMockMachine({
        location: { organizationId: "other-org" },
      });
      const input = {
        machine,
        expectedOrganizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
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
      it("should allow valid title", () => {
        const input = createPublicIssueInput({ title: "Valid Title" });

        const result = validateIssueCreationInput(input);

        expect(result.valid).toBe(true);
      });

      it("should reject empty title", () => {
        const input = createPublicIssueInput({ title: "" });

        const result = validateIssueCreationInput(input);

        expect(result.valid).toBe(false);
        expect(result.error).toBe("Title is required");
      });

      it("should reject whitespace-only title", () => {
        const input = createPublicIssueInput({ title: "   " });

        const result = validateIssueCreationInput(input);

        expect(result.valid).toBe(false);
        expect(result.error).toBe("Title is required");
      });

      it("should reject title longer than 255 characters", () => {
        const longTitle = "A".repeat(256);
        const input = createPublicIssueInput({ title: longTitle });

        const result = validateIssueCreationInput(input);

        expect(result.valid).toBe(false);
        expect(result.error).toBe("Title must be 255 characters or less");
      });

      it("should allow title exactly 255 characters", () => {
        const exactTitle = "A".repeat(255);
        const input = createPublicIssueInput({ title: exactTitle });

        const result = validateIssueCreationInput(input);

        expect(result.valid).toBe(true);
      });
    });

    describe("Description validation", () => {
      it("should allow valid description", () => {
        const input = createPublicIssueInput({
          description: "Valid description",
        });

        const result = validateIssueCreationInput(input);

        expect(result.valid).toBe(true);
      });

      it("should allow empty description", () => {
        const input = createPublicIssueInput();

        const result = validateIssueCreationInput(input);

        expect(result.valid).toBe(true);
      });

      it("should reject description longer than 2000 characters", () => {
        const longDescription = "A".repeat(2001);
        const input = createPublicIssueInput({ description: longDescription });

        const result = validateIssueCreationInput(input);

        expect(result.valid).toBe(false);
        expect(result.error).toBe(
          "Description must be 2000 characters or less",
        );
      });

      it("should allow description exactly 2000 characters", () => {
        const exactDescription = "A".repeat(2000);
        const input = createPublicIssueInput({ description: exactDescription });

        const result = validateIssueCreationInput(input);

        expect(result.valid).toBe(true);
      });
    });

    describe("Machine ID validation", () => {
      it("should reject empty machine ID", () => {
        const input = createPublicIssueInput({ machineId: "" });

        const result = validateIssueCreationInput(input);

        expect(result.valid).toBe(false);
        expect(result.error).toBe("Machine ID is required");
      });

      it("should reject whitespace-only machine ID", () => {
        const input = createPublicIssueInput({ machineId: "   " });

        const result = validateIssueCreationInput(input);

        expect(result.valid).toBe(false);
        expect(result.error).toBe("Machine ID is required");
      });
    });

    describe("Email validation for public issues", () => {
      it("should allow valid email", () => {
        const input = createPublicIssueInput({
          reporterEmail: "test@example.com",
        });

        const result = validateIssueCreationInput(input);

        expect(result.valid).toBe(true);
      });

      it("should allow undefined email", () => {
        const input = createPublicIssueInput();

        const result = validateIssueCreationInput(input);

        expect(result.valid).toBe(true);
      });

      it("should reject invalid email format", () => {
        const input = createPublicIssueInput({
          reporterEmail: "invalid-email",
        });

        const result = validateIssueCreationInput(input);

        expect(result.valid).toBe(false);
        expect(result.error).toBe("Invalid email format");
      });

      it("should reject email with no domain", () => {
        const input = createPublicIssueInput({ reporterEmail: "test@" });

        const result = validateIssueCreationInput(input);

        expect(result.valid).toBe(false);
        expect(result.error).toBe("Invalid email format");
      });

      it("should reject email with no local part", () => {
        const input = createPublicIssueInput({ reporterEmail: "@example.com" });

        const result = validateIssueCreationInput(input);

        expect(result.valid).toBe(false);
        expect(result.error).toBe("Invalid email format");
      });
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
        machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
        organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        statusId: SEED_TEST_IDS.MOCK_PATTERNS.STATUS,
        priorityId: SEED_TEST_IDS.MOCK_PATTERNS.PRIORITY,
        createdById: null,
      });
    });

    it("should build issue data with authenticated user", () => {
      const input = createPublicIssueInput();
      const contextWithUser = createContext({ userId: SEED_TEST_IDS.MOCK_PATTERNS.USER });

      const result = buildIssueCreationData(input, defaults, contextWithUser);

      expect(result.valid).toBe(true);
      expect(result.data).toEqual({
        title: "Test Issue",
        machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
        organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        statusId: SEED_TEST_IDS.MOCK_PATTERNS.STATUS,
        priorityId: SEED_TEST_IDS.MOCK_PATTERNS.PRIORITY,
        createdById: SEED_TEST_IDS.MOCK_PATTERNS.USER,
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
      const status = { id: SEED_TEST_IDS.MOCK_PATTERNS.STATUS, name: "New" };
      const priority = { id: SEED_TEST_IDS.MOCK_PATTERNS.PRIORITY, name: "Medium" };

      const result = validateIssueCreationDefaults(status, priority);

      expect(result.valid).toBe(true);
      expect(result.data).toEqual({
        status,
        priority,
      });
    });

    it("should reject null status", () => {
      const priority = { id: SEED_TEST_IDS.MOCK_PATTERNS.PRIORITY, name: "Medium" };

      const result = validateIssueCreationDefaults(null, priority);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Default issue status not found. Please contact an administrator.",
      );
    });

    it("should reject null priority", () => {
      const status = { id: SEED_TEST_IDS.MOCK_PATTERNS.STATUS, name: "New" };

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
    const status = { id: SEED_TEST_IDS.MOCK_PATTERNS.STATUS, name: "New" };
    const priority = { id: SEED_TEST_IDS.MOCK_PATTERNS.PRIORITY, name: "Medium" };
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
        machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
        organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        statusId: SEED_TEST_IDS.MOCK_PATTERNS.STATUS,
        priorityId: SEED_TEST_IDS.MOCK_PATTERNS.PRIORITY,
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
        SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
      );

      expect(effects).toEqual({
        shouldNotifyMachineOwner: true,
        shouldRecordActivity: false,
        notificationData: {
          machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
          type: "public",
        },
      });
    });

    it("should determine notification effects for authenticated issue", () => {
      const effects = getIssueCreationNotificationEffects(
        "authenticated",
        SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
      );

      expect(effects).toEqual({
        shouldNotifyMachineOwner: true,
        shouldRecordActivity: true,
        notificationData: {
          machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
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

    it("should handle various email formats", () => {
      const validEmails = [
        "user@example.com",
        "user.name@example.com",
        "user+tag@example.com",
        "user123@example-domain.com",
        "user@subdomain.example.com",
      ];

      for (const email of validEmails) {
        const input = createPublicIssueInput({ reporterEmail: email });
        const result = validateIssueCreationInput(input);
        expect(result.valid).toBe(true);
      }
    });

    it("should reject various invalid email formats", () => {
      const invalidEmails = [
        "plainaddress",
        "@missingdomain.com",
        "missing@.com",
        "missing@domain",
        "spaces @domain.com",
        "user@",
        "@domain.com",
      ];

      for (const email of invalidEmails) {
        const input = createPublicIssueInput({ reporterEmail: email });
        const result = validateIssueCreationInput(input);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Invalid email format");
      }
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
      const status = { id: SEED_TEST_IDS.MOCK_PATTERNS.STATUS, name: "New" };
      const priority = { id: SEED_TEST_IDS.MOCK_PATTERNS.PRIORITY, name: "Medium" };

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
      const authContext = createContext({ userId: SEED_TEST_IDS.MOCK_PATTERNS.USER });

      const authResult = validateCompleteIssueCreation(
        authInput,
        machine,
        status,
        priority,
        authContext,
      );

      expect(authResult.valid).toBe(true);
      expect(authResult.data?.issueData.createdById).toBe(SEED_TEST_IDS.MOCK_PATTERNS.USER);
    });

    it("should validate organization boundary for all scenarios", () => {
      const organizations = [SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION, "org-2", "org-3"];

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

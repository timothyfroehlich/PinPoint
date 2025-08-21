import { describe, it, expect } from "vitest";

import {
  validateResourceOrganizationBoundary,
  validateOrganizationMembership,
  validateCrossOrganizationAccess,
  validateOrganizationId,
  validateUserId,
  validateCompleteOrganizationBoundary,
  validateIssueOrganizationBoundary,
  validateMachineOrganizationBoundary,
  validateLocationOrganizationBoundary,
  validateCommentOrganizationBoundary,
  isSameOrganization,
  extractOrganizationId,
  createOrganizationBoundaryError,
  // New router pattern functions
  validatePublicOrganizationContext,
  createOrganizationScope,
  createOrganizationScopeWith,
  validateRouterEntityOwnership,
  createEntityQuery,
  createEntityUpdateQuery,
  createEntityDeleteQuery,
  validateEntityExistsAndOwned,
  validatePublicOrganizationContextRequired,
  validateRelatedEntitiesOwnership,
  validateMultipleEntityOwnership,
} from "../organizationValidation";

import type {
  OrganizationMembership,
  ResourceOwnershipInput,
  MembershipValidationInput,
  CrossOrganizationAccessInput,
  EntityWithOrganizationId,
  OrganizationContextPublic,
  RelatedEntityCheck,
} from "../organizationValidation";

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

function createMockMembership(
  overrides: Partial<OrganizationMembership> = {},
): OrganizationMembership {
  return {
    id: SEED_TEST_IDS.MOCK_PATTERNS.MEMBERSHIP,
    userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
    organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
    roleId: SEED_TEST_IDS.MOCK_PATTERNS.ROLE,
    user: {
      id: SEED_TEST_IDS.MOCK_PATTERNS.USER,
      name: "Test User",
      email: "test@example.com",
    },
    role: {
      id: SEED_TEST_IDS.MOCK_PATTERNS.ROLE,
      name: "Member",
    },
    ...overrides,
  };
}

function createResourceOwnershipInput(
  overrides: Partial<ResourceOwnershipInput> = {},
): ResourceOwnershipInput {
  return {
  resourceId: "mock-resource-1",
  resourceOrganizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
  expectedOrganizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
    resourceType: "Test Resource",
    ...overrides,
  };
}

function createMembershipValidationInput(
  overrides: Partial<MembershipValidationInput> = {},
): MembershipValidationInput {
  return {
    membership: createMockMembership(),
  expectedOrganizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
  userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
    ...overrides,
  };
}

function createCrossOrganizationAccessInput(
  overrides: Partial<CrossOrganizationAccessInput> = {},
): CrossOrganizationAccessInput {
  return {
  userOrganizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
  resourceOrganizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
    action: "access",
    resourceType: "Test Resource",
    ...overrides,
  };
}

// =============================================================================
// VALIDATION TESTS
// =============================================================================

describe("organizationValidation", () => {
  describe("validateResourceOrganizationBoundary", () => {
    it("should allow resource access within same organization", () => {
      const input = createResourceOwnershipInput();

      const result = validateResourceOrganizationBoundary(input);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject resource from different organization", () => {
      const input = createResourceOwnershipInput({
        resourceOrganizationId: "mock-org-2",
      });

      const result = validateResourceOrganizationBoundary(input);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Test Resource not found or does not belong to this organization",
      );
    });

    it("should reject resource with missing organization ID", () => {
      const input = createResourceOwnershipInput({
        resourceOrganizationId: "",
      });

      const result = validateResourceOrganizationBoundary(input);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Test Resource organization ID is missing");
    });
  });

  describe("validateOrganizationMembership", () => {
    it("should validate correct membership", () => {
      const input = createMembershipValidationInput();

      const result = validateOrganizationMembership(input);

      expect(result.valid).toBe(true);
      expect(result.data).toEqual(input.membership);
    });

    it("should reject null membership", () => {
      const input = createMembershipValidationInput({
        membership: null,
      });

      const result = validateOrganizationMembership(input);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("User is not a member of this organization");
    });

    it("should reject membership with wrong user ID", () => {
      const input = createMembershipValidationInput({
        membership: createMockMembership({
          userId: "different-user",
        }),
      });

      const result = validateOrganizationMembership(input);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid membership: user ID mismatch");
    });

    it("should reject membership with wrong organization ID", () => {
      const input = createMembershipValidationInput({
        membership: createMockMembership({
          organizationId: "mock-org-2",
        }),
      });

      const result = validateOrganizationMembership(input);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid membership: organization mismatch");
    });
  });

  describe("validateCrossOrganizationAccess", () => {
    it("should allow access within same organization", () => {
      const input = createCrossOrganizationAccessInput();

      const result = validateCrossOrganizationAccess(input);

      expect(result.valid).toBe(true);
    });

    it("should reject cross-organization access", () => {
      const input = createCrossOrganizationAccessInput({
        userOrganizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        resourceOrganizationId: "mock-org-2",
      });

      const result = validateCrossOrganizationAccess(input);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Cannot access Test Resource from different organization",
      );
    });

    it("should provide specific action in error message", () => {
      const input = createCrossOrganizationAccessInput({
        userOrganizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        resourceOrganizationId: "mock-org-2",
        action: "edit",
        resourceType: "Issue",
      });

      const result = validateCrossOrganizationAccess(input);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Cannot edit Issue from different organization",
      );
    });
  });

  describe("validateOrganizationId", () => {
    it("should validate proper organization ID", () => {
      const result = validateOrganizationId("test-org-123");

      expect(result.valid).toBe(true);
    });

    it("should reject empty organization ID", () => {
      const result = validateOrganizationId("");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Organization ID is required");
    });

    it("should reject whitespace-only organization ID", () => {
      const result = validateOrganizationId("   ");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Organization ID is required");
    });

    it("should reject organization ID that's too short", () => {
      const result = validateOrganizationId("ab");

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Organization ID must be at least 3 characters",
      );
    });

    it("should reject organization ID that's too long", () => {
      const longId = "a".repeat(51);
      const result = validateOrganizationId(longId);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Organization ID must be 50 characters or less",
      );
    });

    it("should accept organization ID exactly 50 characters", () => {
      const exactId = "a".repeat(50);
      const result = validateOrganizationId(exactId);

      expect(result.valid).toBe(true);
    });

    it("should accept organization ID exactly 3 characters", () => {
      const result = validateOrganizationId("abc");

      expect(result.valid).toBe(true);
    });

    it("should reject organization ID with invalid characters", () => {
      const invalidChars = ["org@test", "org.test", "org test", "org/test"];

      for (const invalidId of invalidChars) {
        const result = validateOrganizationId(invalidId);
        expect(result.valid).toBe(false);
        expect(result.error).toBe(
          "Organization ID must contain only letters, numbers, hyphens, and underscores",
        );
      }
    });

    it("should accept organization ID with valid characters", () => {
      const validIds = [
        "org-test",
        "org_test",
        "ORG123",
        "org-123_test",
        "123-org_456",
      ];

      for (const validId of validIds) {
        const result = validateOrganizationId(validId);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe("validateUserId", () => {
    it("should validate proper user ID", () => {
      const result = validateUserId("user-123");

      expect(result.valid).toBe(true);
    });

    it("should reject empty user ID", () => {
      const result = validateUserId("");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("User ID is required");
    });

    it("should reject whitespace-only user ID", () => {
      const result = validateUserId("   ");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("User ID is required");
    });

    it("should reject user ID that's too short", () => {
      const result = validateUserId("ab");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("User ID must be at least 3 characters");
    });

    it("should reject user ID that's too long", () => {
      const longId = "a".repeat(51);
      const result = validateUserId(longId);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("User ID must be 50 characters or less");
    });

    it("should accept user ID exactly 50 characters", () => {
      const exactId = "a".repeat(50);
      const result = validateUserId(exactId);

      expect(result.valid).toBe(true);
    });

    it("should accept user ID exactly 3 characters", () => {
      const result = validateUserId("abc");

      expect(result.valid).toBe(true);
    });
  });

  describe("validateCompleteOrganizationBoundary", () => {
    const membership = createMockMembership();

    it("should validate complete organization boundary workflow", () => {
      const result = validateCompleteOrganizationBoundary(
        "resource-1",
        SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        membership,
        SEED_TEST_IDS.MOCK_PATTERNS.USER,
        SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        "Test Resource",
      );

      expect(result.valid).toBe(true);
      expect(result.data?.membership).toEqual(membership);
      expect(result.data?.crossOrgAccess).toBe(false);
    });

    it("should fail on invalid organization ID", () => {
      const result = validateCompleteOrganizationBoundary(
        "resource-1",
        SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        membership,
        SEED_TEST_IDS.MOCK_PATTERNS.USER,
        "", // Invalid org ID
        "Test Resource",
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Organization ID is required");
    });

    it("should fail on invalid user ID", () => {
      const result = validateCompleteOrganizationBoundary(
        "resource-1",
        SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        membership,
        "", // Invalid user ID
        SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        "Test Resource",
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe("User ID is required");
    });

    it("should fail on resource organization boundary", () => {
      const result = validateCompleteOrganizationBoundary(
        "resource-1",
        "mock-org-2", // Different org
        membership,
        SEED_TEST_IDS.MOCK_PATTERNS.USER,
        SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        "Test Resource",
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Test Resource not found or does not belong to this organization",
      );
    });

    it("should fail on invalid membership", () => {
      const result = validateCompleteOrganizationBoundary(
        "resource-1",
        SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        null, // No membership
        SEED_TEST_IDS.MOCK_PATTERNS.USER,
        SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        "Test Resource",
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe("User is not a member of this organization");
    });

    it("should detect cross-organization access attempt", () => {
      const crossOrgMembership = createMockMembership({
        organizationId: "mock-org-2",
      });

      const result = validateCompleteOrganizationBoundary(
        "resource-1",
        "mock-org-2",
        crossOrgMembership,
        SEED_TEST_IDS.MOCK_PATTERNS.USER,
        "mock-org-2",
        "Test Resource",
      );

      expect(result.valid).toBe(true);
      expect(result.data?.crossOrgAccess).toBe(false);
    });
  });

  describe("Resource-specific validators", () => {
    describe("validateIssueOrganizationBoundary", () => {
      it("should validate issue boundary", () => {
        const result = validateIssueOrganizationBoundary(
          SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        );

        expect(result.valid).toBe(true);
      });

      it("should reject cross-org issue access", () => {
        const result = validateIssueOrganizationBoundary(
          SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
          "mock-org-2",
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        );

        expect(result.valid).toBe(false);
        expect(result.error).toBe(
          "Issue not found or does not belong to this organization",
        );
      });
    });

    describe("validateMachineOrganizationBoundary", () => {
      it("should validate machine boundary", () => {
        const result = validateMachineOrganizationBoundary(
          SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        );

        expect(result.valid).toBe(true);
      });

      it("should reject cross-org machine access", () => {
        const result = validateMachineOrganizationBoundary(
          SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
          "mock-org-2",
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        );

        expect(result.valid).toBe(false);
        expect(result.error).toBe(
          "Game instance not found or does not belong to this organization",
        );
      });
    });

    describe("validateLocationOrganizationBoundary", () => {
      it("should validate location boundary", () => {
        const result = validateLocationOrganizationBoundary(
          SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        );

        expect(result.valid).toBe(true);
      });

      it("should reject cross-org location access", () => {
        const result = validateLocationOrganizationBoundary(
          SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
          "mock-org-2",
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        );

        expect(result.valid).toBe(false);
        expect(result.error).toBe(
          "Location not found or does not belong to this organization",
        );
      });
    });

    describe("validateCommentOrganizationBoundary", () => {
      it("should validate comment boundary via parent issue", () => {
        const result = validateCommentOrganizationBoundary(
          SEED_TEST_IDS.MOCK_PATTERNS.COMMENT,
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        );

        expect(result.valid).toBe(true);
      });

      it("should reject cross-org comment access", () => {
        const result = validateCommentOrganizationBoundary(
          SEED_TEST_IDS.MOCK_PATTERNS.COMMENT,
          "mock-org-2",
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        );

        expect(result.valid).toBe(false);
        expect(result.error).toBe(
          "Comment not found or does not belong to this organization",
        );
      });
    });
  });

  describe("Utility functions", () => {
    describe("isSameOrganization", () => {
      it("should return true for same organization", () => {
        const result = isSameOrganization(
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        );

        expect(result).toBe(true);
      });

      it("should return false for different organizations", () => {
        const result = isSameOrganization(
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          "mock-org-2",
        );

        expect(result).toBe(false);
      });
    });

    describe("extractOrganizationId", () => {
      it("should extract organization ID from direct property", () => {
  const resource = { organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION };

        const result = extractOrganizationId(resource);

        expect(result).toBe("org-1");
      });

      it("should extract organization ID from location property", () => {
        const resource = {
          location: { organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION },
        };

        const result = extractOrganizationId(resource);

        expect(result).toBe("org-1");
      });

      it("should extract organization ID from issue property", () => {
        const resource = {
          issue: { organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION },
        };

        const result = extractOrganizationId(resource);

        expect(result).toBe("org-1");
      });

      it("should return null for null resource", () => {
        const result = extractOrganizationId(null);

        expect(result).toBe(null);
      });

      it("should return null for resource without organization ID", () => {
        const resource = { id: "resource-1", name: "Test" } as any;

        const result = extractOrganizationId(resource);

        expect(result).toBe(null);
      });
    });

    describe("createOrganizationBoundaryError", () => {
      it("should create basic error message", () => {
        const result = createOrganizationBoundaryError("Issue");

        expect(result).toBe(
          "Issue not found or does not belong to this organization",
        );
      });

      it("should create error message with security context", () => {
        const result = createOrganizationBoundaryError("Issue", true);

        expect(result).toBe(
          "Issue not found or does not belong to this organization. This may indicate a security violation or data integrity issue.",
        );
      });

      it("should create error message without security context by default", () => {
        const result = createOrganizationBoundaryError("Machine");

        expect(result).toBe(
          "Machine not found or does not belong to this organization",
        );
      });
    });
  });

  describe("Edge Cases and Error Conditions", () => {
    it("should handle very long organization IDs", () => {
      const longId = "a".repeat(100);
      const result = validateOrganizationId(longId);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Organization ID must be 50 characters or less",
      );
    });

    it("should handle special characters in resource type", () => {
      const input = createResourceOwnershipInput({
        resourceType: "Test Resource @#$%",
        resourceOrganizationId: "mock-org-2",
      });

      const result = validateResourceOrganizationBoundary(input);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Test Resource @#$% not found or does not belong to this organization",
      );
    });

    it("should handle null membership with specific user ID", () => {
      const input = createMembershipValidationInput({
        membership: null,
        userId: "specific-user",
      });

      const result = validateOrganizationMembership(input);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("User is not a member of this organization");
    });

    it("should handle empty resource organization ID", () => {
      const input = createResourceOwnershipInput({
        resourceOrganizationId: "",
        resourceType: "Custom Resource",
      });

      const result = validateResourceOrganizationBoundary(input);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Custom Resource organization ID is missing");
    });
  });

  describe("Business Rule Coverage", () => {
    it("should test all validation steps in complete workflow", () => {
      const membership = createMockMembership();

      // Valid case
      const validResult = validateCompleteOrganizationBoundary(
        "resource-1",
        SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        membership,
        SEED_TEST_IDS.MOCK_PATTERNS.USER,
        SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        "Test Resource",
      );

      expect(validResult.valid).toBe(true);

      // Test each failure point
      const failureCases = [
        {
          name: "invalid org ID",
            test: () =>
            validateCompleteOrganizationBoundary(
              "resource-1",
              SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
              membership,
              SEED_TEST_IDS.MOCK_PATTERNS.USER,
              "",
              "Test Resource",
            ),
        },
        {
          name: "invalid user ID",
            test: () =>
            validateCompleteOrganizationBoundary(
              "resource-1",
              SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
              membership,
              "",
              SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
              "Test Resource",
            ),
        },
        {
          name: "wrong resource org",
            test: () =>
            validateCompleteOrganizationBoundary(
              "resource-1",
              "mock-org-2",
              membership,
              SEED_TEST_IDS.MOCK_PATTERNS.USER,
              SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
              "Test Resource",
            ),
        },
        {
          name: "no membership",
            test: () =>
            validateCompleteOrganizationBoundary(
              "resource-1",
              SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
              null,
              SEED_TEST_IDS.MOCK_PATTERNS.USER,
              SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
              "Test Resource",
            ),
        },
      ];

      for (const failureCase of failureCases) {
        const result = failureCase.test();
        expect(result.valid).toBe(false);
      }
    });

    it("should test all resource type validators", () => {
      const testCases = [
        {
          name: "Issue",
          validator: validateIssueOrganizationBoundary,
        },
        {
          name: "Machine",
          validator: validateMachineOrganizationBoundary,
        },
        {
          name: "Location",
          validator: validateLocationOrganizationBoundary,
        },
        {
          name: "Comment",
          validator: validateCommentOrganizationBoundary,
        },
      ];

      for (const testCase of testCases) {
        // Valid case
        const validResult = testCase.validator(
          "resource-1",
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        );
        expect(validResult.valid).toBe(true);

        // Invalid case
        const invalidResult = testCase.validator(
          "resource-1",
          "mock-org-2",
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        );
        expect(invalidResult.valid).toBe(false);
        expect(invalidResult.error).toContain(
          "not found or does not belong to this organization",
        );
      }
    });

    it("should test cross-organization access patterns", () => {
      const actions = ["access", "edit", "delete", "create"];
      const resourceTypes = ["Issue", "Machine", "Location", "Comment"];

      for (const action of actions) {
        for (const resourceType of resourceTypes) {
          const input = createCrossOrganizationAccessInput({
            userOrganizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
            resourceOrganizationId: "mock-org-2",
            action,
            resourceType,
          });

          const result = validateCrossOrganizationAccess(input);

          expect(result.valid).toBe(false);
          expect(result.error).toBe(
            `Cannot ${action} ${resourceType} from different organization`,
          );
        }
      }
    });
  });

  describe("Router Pattern Functions", () => {
    describe("validatePublicOrganizationContext", () => {
      it("should validate existing organization context", () => {
        const organization: OrganizationContextPublic = {
          id: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          name: "Test Org",
        };

        const result = validatePublicOrganizationContext(organization);

        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should reject null organization context", () => {
        const result = validatePublicOrganizationContext(null);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Organization not found");
        expect(result.errorCode).toBe("NOT_FOUND");
      });

      it("should reject undefined organization context", () => {
        const result = validatePublicOrganizationContext(undefined);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Organization not found");
        expect(result.errorCode).toBe("NOT_FOUND");
      });
    });

    describe("createOrganizationScope", () => {
      it("should create organization scope where clause", () => {
  const result = createOrganizationScope(SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION);

        expect(result).toEqual({
          organizationId: "org-1",
        });
      });
    });

    describe("createOrganizationScopeWith", () => {
      it("should create organization scope with additional conditions", () => {
        const additionalWhere = { name: "Test", active: true };
  const result = createOrganizationScopeWith(SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION, additionalWhere);

        expect(result).toEqual({
          name: "Test",
          active: true,
          organizationId: "org-1",
        });
      });
    });

    describe("validateRouterEntityOwnership", () => {
      it("should validate entity ownership", () => {
        const entity: EntityWithOrganizationId = {
          id: "entity-1",
          organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        };

        const result = validateRouterEntityOwnership(
          entity,
          "org-1",
          "Test Entity",
        );

        expect(result.isValid).toBe(true);
      });

      it("should reject null entity", () => {
        const result = validateRouterEntityOwnership(
          null,
          "org-1",
          "Test Entity",
        );

        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Test Entity not found");
        expect(result.errorCode).toBe("NOT_FOUND");
      });

      it("should reject entity from different organization", () => {
        const entity: EntityWithOrganizationId = {
          id: "entity-1",
          organizationId: "other-org",
        };

        const result = validateRouterEntityOwnership(
          entity,
          "org-1",
          "Test Entity",
        );

        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          "Access denied: Test Entity belongs to different organization",
        );
        expect(result.errorCode).toBe("FORBIDDEN");
      });

      it("should use custom error message", () => {
        const result = validateRouterEntityOwnership(
          null,
          "org-1",
          "Test Entity",
          "Custom not found message",
        );

        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Custom not found message");
      });
    });

    describe("createEntityQuery", () => {
      it("should create entity query with organization scoping", () => {
        const result = createEntityQuery("entity-1", "org-1");

        expect(result).toEqual({
          where: {
            id: "entity-1",
            organizationId: "org-1",
          },
        });
      });
    });

    describe("createEntityUpdateQuery", () => {
      it("should create entity update query with organization scoping", () => {
        const result = createEntityUpdateQuery("entity-1", "org-1");

        expect(result).toEqual({
          where: {
            id: "entity-1",
            organizationId: "org-1",
          },
        });
      });
    });

    describe("createEntityDeleteQuery", () => {
      it("should create entity delete query with organization scoping", () => {
        const result = createEntityDeleteQuery("entity-1", "org-1");

        expect(result).toEqual({
          where: {
            id: "entity-1",
            organizationId: "org-1",
          },
        });
      });
    });

    describe("validateEntityExistsAndOwned", () => {
      it("should return entity when validation passes", () => {
        const entity: EntityWithOrganizationId = {
          id: "entity-1",
          organizationId: "org-1",
        };

        const result = validateEntityExistsAndOwned(
          entity,
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          "Test Entity",
        );

        expect(result).toBe(entity);
      });

      it("should throw error when entity is null", () => {
        expect(() => {
          validateEntityExistsAndOwned(null, SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION, "Test Entity");
        }).toThrow("Test Entity not found");
      });

      it("should throw error when entity belongs to different organization", () => {
        const entity: EntityWithOrganizationId = {
          id: "entity-1",
          organizationId: "mock-org-2",
        };

        expect(() => {
          validateEntityExistsAndOwned(entity, "org-1", "Test Entity");
        }).toThrow(
          "Access denied: Test Entity belongs to different organization",
        );
      });
    });

    describe("validatePublicOrganizationContextRequired", () => {
      it("should return organization when validation passes", () => {
        const organization: OrganizationContextPublic = {
          id: "org-1",
          name: "Test Org",
        };

        const result = validatePublicOrganizationContextRequired(organization);

        expect(result).toBe(organization);
      });

      it("should throw error when organization is null", () => {
        expect(() => {
          validatePublicOrganizationContextRequired(null);
        }).toThrow("Organization not found");
      });

      it("should throw error when organization is undefined", () => {
        expect(() => {
          validatePublicOrganizationContextRequired(undefined);
        }).toThrow("Organization not found");
      });
    });

    describe("validateRelatedEntitiesOwnership", () => {
      it("should validate all entities belong to same organization", () => {
          const entities: RelatedEntityCheck[] = [
          {
            entityId: "entity-1",
            entityType: "Location",
            organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          },
          {
            entityId: "entity-2",
            entityType: "Machine",
            organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          },
        ];

        const result = validateRelatedEntitiesOwnership(entities, "org-1");

        expect(result.isValid).toBe(true);
      });

      it("should skip global entities (no organizationId)", () => {
        const entities: RelatedEntityCheck[] = [
          {
            entityId: "model-1",
            entityType: "Model",
            // No organizationId - global entity
          },
          {
            entityId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
            entityType: "Location",
            organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          },
        ];

        const result = validateRelatedEntitiesOwnership(entities, "org-1");

        expect(result.isValid).toBe(true);
      });

      it("should reject entity from different organization", () => {
        const entities: RelatedEntityCheck[] = [
          {
            entityId: "entity-1",
            entityType: "Location",
            organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          },
          {
            entityId: "entity-2",
            entityType: "Machine",
            organizationId: "mock-org-2",
          },
        ];

        const result = validateRelatedEntitiesOwnership(entities, "org-1");

        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          "Access denied: Machine belongs to different organization",
        );
        expect(result.errorCode).toBe("FORBIDDEN");
      });
    });

    describe("validateMultipleEntityOwnership", () => {
      it("should validate all entities belong to organization", () => {
          const entities: EntityWithOrganizationId[] = [
          { id: "entity-1", organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION },
          { id: "entity-2", organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION },
        ];

        const result = validateMultipleEntityOwnership(
          entities,
          "org-1",
          "Test Entity",
        );

        expect(result.isValid).toBe(true);
      });

      it("should reject when any entity is null", () => {
  const entities = [{ id: "entity-1", organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION }, null];

        const result = validateMultipleEntityOwnership(
          entities,
          "org-1",
          "Test Entity",
        );

        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Test Entity at index 1 not found");
        expect(result.errorCode).toBe("NOT_FOUND");
      });

      it("should reject when any entity belongs to different organization", () => {
        const entities: EntityWithOrganizationId[] = [
          { id: "entity-1", organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION },
          { id: "entity-2", organizationId: "mock-org-2" },
        ];

        const result = validateMultipleEntityOwnership(
          entities,
          "org-1",
          "Test Entity",
        );

        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          "Access denied: Test Entity at index 1 belongs to different organization",
        );
        expect(result.errorCode).toBe("FORBIDDEN");
      });
    });
  });
});

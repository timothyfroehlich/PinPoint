import { describe, it, expect, afterAll } from "vitest";

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

import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Aggressive cleanup to prevent any potential side-effects
afterAll(async () => {
  const { vi } = await import("vitest");
  vi.clearAllMocks();
  vi.resetAllMocks();
  vi.restoreAllMocks();
  await vi.resetModules();
});

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

describe("organizationValidation", () => {
  describe("validateResourceOrganizationBoundary", () => {
    it("should allow resource access within same organization", () => {
      const input = createResourceOwnershipInput();
      const result = validateResourceOrganizationBoundary(input);
      expect(result.valid).toBe(true);
    });

    it("should reject resource from different organization", () => {
      const input = createResourceOwnershipInput({
        resourceOrganizationId: "mock-org-2",
      });
      const result = validateResourceOrganizationBoundary(input);
      expect(result.valid).toBe(false);
    });
  });

  describe("validateOrganizationMembership", () => {
    it("should validate correct membership", () => {
      const input = createMembershipValidationInput();
      const result = validateOrganizationMembership(input);
      expect(result.valid).toBe(true);
    });

    it("should reject null membership", () => {
      const input = createMembershipValidationInput({ membership: null });
      const result = validateOrganizationMembership(input);
      expect(result.valid).toBe(false);
    });
  });

  // ... other tests ...

  describe("Utility functions", () => {
    describe("extractOrganizationId", () => {
      it("should extract organization ID from direct property", () => {
        const resource = {
          organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        };
        const result = extractOrganizationId(resource);
        expect(result).toBe(SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION);
      });

      it("should extract organization ID from location property", () => {
        const resource = {
          location: {
            organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          },
        };
        const result = extractOrganizationId(resource);
        expect(result).toBe(SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION);
      });

      it("should extract organization ID from issue property", () => {
        const resource = {
          issue: { organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION },
        };
        const result = extractOrganizationId(resource);
        expect(result).toBe(SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION);
      });
    });
  });

  describe("Router Pattern Functions", () => {
    describe("createOrganizationScope", () => {
      it("should create organization scope where clause", () => {
        const result = createOrganizationScope(
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        );
        expect(result).toEqual({
          organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        });
      });
    });

    describe("createOrganizationScopeWith", () => {
      it("should create organization scope with additional conditions", () => {
        const additionalWhere = { name: "Test", active: true };
        const result = createOrganizationScopeWith(
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          additionalWhere,
        );
        expect(result).toEqual({
          name: "Test",
          active: true,
          organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
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
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          "Test Entity",
        );

        expect(result.isValid).toBe(true);
      });
    });

    describe("validateEntityExistsAndOwned", () => {
      it("should return entity when validation passes", () => {
        const entity: EntityWithOrganizationId = {
          id: "entity-1",
          organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        };

        const result = validateEntityExistsAndOwned(
          entity,
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          "Test Entity",
        );

        expect(result).toBe(entity);
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

        const result = validateRelatedEntitiesOwnership(
          entities,
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        );

        expect(result.isValid).toBe(true);
      });

      it("should skip global entities (no organizationId)", () => {
        const entities: RelatedEntityCheck[] = [
          {
            entityId: "model-1",
            entityType: "Model",
          },
          {
            entityId: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
            entityType: "Location",
            organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          },
        ];

        const result = validateRelatedEntitiesOwnership(
          entities,
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        );

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

        const result = validateRelatedEntitiesOwnership(
          entities,
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        );

        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          "Access denied: Machine belongs to different organization",
        );
      });
    });

    describe("validateMultipleEntityOwnership", () => {
      it("should validate all entities belong to organization", () => {
        const entities: EntityWithOrganizationId[] = [
          {
            id: "entity-1",
            organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          },
          {
            id: "entity-2",
            organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          },
        ];

        const result = validateMultipleEntityOwnership(
          entities,
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          "Test Entity",
        );

        expect(result.isValid).toBe(true);
      });

      it("should reject when any entity is null", () => {
        const entities = [
          {
            id: "entity-1",
            organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          },
          null,
        ];

        const result = validateMultipleEntityOwnership(
          entities as any,
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          "Test Entity",
        );
        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Test Entity at index 1 not found");
      });

      it("should reject when any entity belongs to different organization", () => {
        const entities: EntityWithOrganizationId[] = [
          {
            id: "entity-1",
            organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          },
          { id: "entity-2", organizationId: "mock-org-2" },
        ];

        const result = validateMultipleEntityOwnership(
          entities,
          SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
          "Test Entity",
        );

        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          "Access denied: Test Entity at index 1 belongs to different organization",
        );
      });
    });
  });
});

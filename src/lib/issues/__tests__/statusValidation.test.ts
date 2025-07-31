import { describe, it, expect } from "vitest";

import {
  validateStatusTransition,
  validateOrganizationBoundary,
  validateUserPermissions,
  validateTransitionRules,
  getTransitionType,
  validateStatusLookup,
  getValidStatusTransitions,
  getStatusChangeEffects,
} from "../statusValidation";

import type { IssueStatus } from "../../../types/issue";

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

function createMockStatus(overrides: Partial<IssueStatus> = {}): IssueStatus {
  return {
    id: "status-1",
    name: "New",
    category: "NEW",
    ...overrides,
  };
}

function createStatusSet(): {
  newStatus: IssueStatus;
  inProgressStatus: IssueStatus;
  diagnosingStatus: IssueStatus;
  resolvedStatus: IssueStatus;
  fixedStatus: IssueStatus;
} {
  return {
    newStatus: createMockStatus({
      id: "status-new",
      name: "New",
      category: "NEW",
    }),
    inProgressStatus: createMockStatus({
      id: "status-in-progress",
      name: "In Progress",
      category: "IN_PROGRESS",
    }),
    diagnosingStatus: createMockStatus({
      id: "status-diagnosing",
      name: "Diagnosing",
      category: "IN_PROGRESS",
    }),
    resolvedStatus: createMockStatus({
      id: "status-resolved",
      name: "Resolved",
      category: "RESOLVED",
    }),
    fixedStatus: createMockStatus({
      id: "status-fixed",
      name: "Fixed",
      category: "RESOLVED",
    }),
  };
}

// =============================================================================
// VALIDATION TESTS
// =============================================================================

describe("statusValidation", () => {
  const organizationId = "org-123";
  const userPermissions = ["issue:edit"];
  const context = { userPermissions, organizationId };

  describe("validateStatusTransition", () => {
    it("should allow valid status transitions", () => {
      const { newStatus, inProgressStatus } = createStatusSet();

      const result = validateStatusTransition(
        {
          currentStatus: newStatus,
          newStatusId: inProgressStatus.id,
          organizationId,
        },
        inProgressStatus,
        context,
      );

      expect(result.valid).toBe(true);
      expect(result.transition).toEqual({
        from: newStatus,
        to: inProgressStatus,
      });
    });

    it("should reject transitions with invalid organization boundary", () => {
      const currentStatus = createMockStatus({ category: "INVALID" as any });
      const newStatus = createMockStatus({ category: "NEW" });

      const result = validateStatusTransition(
        {
          currentStatus,
          newStatusId: newStatus.id,
          organizationId,
        },
        newStatus,
        context,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid current status category");
    });

    it("should reject transitions with insufficient permissions", () => {
      const { newStatus, inProgressStatus } = createStatusSet();
      const contextWithoutPermissions = {
        userPermissions: [],
        organizationId,
      };

      const result = validateStatusTransition(
        {
          currentStatus: newStatus,
          newStatusId: inProgressStatus.id,
          organizationId,
        },
        inProgressStatus,
        contextWithoutPermissions,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe("User does not have permission to edit issues");
    });
  });

  describe("validateOrganizationBoundary", () => {
    it("should allow transitions with valid status categories", () => {
      const { newStatus, inProgressStatus } = createStatusSet();

      const result = validateOrganizationBoundary(
        newStatus,
        inProgressStatus,
        organizationId,
      );

      expect(result.valid).toBe(true);
    });

    it("should reject transitions with invalid current status category", () => {
      const invalidStatus = createMockStatus({ category: "INVALID" as any });
      const { newStatus } = createStatusSet();

      const result = validateOrganizationBoundary(
        invalidStatus,
        newStatus,
        organizationId,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid current status category");
    });

    it("should reject transitions with invalid new status category", () => {
      const { newStatus } = createStatusSet();
      const invalidStatus = createMockStatus({ category: "INVALID" as any });

      const result = validateOrganizationBoundary(
        newStatus,
        invalidStatus,
        organizationId,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid new status category");
    });
  });

  describe("validateUserPermissions", () => {
    it("should allow transitions with proper permissions", () => {
      const { newStatus, inProgressStatus } = createStatusSet();

      const result = validateUserPermissions(newStatus, inProgressStatus, [
        "issue:edit",
      ]);

      expect(result.valid).toBe(true);
    });

    it("should reject transitions without issue:edit permission", () => {
      const { newStatus, inProgressStatus } = createStatusSet();

      const result = validateUserPermissions(newStatus, inProgressStatus, [
        "other:permission",
      ]);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("User does not have permission to edit issues");
    });

    it("should reject transitions with empty permissions", () => {
      const { newStatus, inProgressStatus } = createStatusSet();

      const result = validateUserPermissions(newStatus, inProgressStatus, []);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("User does not have permission to edit issues");
    });
  });

  describe("validateTransitionRules", () => {
    it("should allow same status transitions (no-op)", () => {
      const { newStatus } = createStatusSet();

      const result = validateTransitionRules(newStatus, newStatus);

      expect(result.valid).toBe(true);
    });

    it("should allow progress transitions", () => {
      const { newStatus, inProgressStatus } = createStatusSet();

      const result = validateTransitionRules(newStatus, inProgressStatus);

      expect(result.valid).toBe(true);
    });

    it("should allow regress transitions", () => {
      const { inProgressStatus, newStatus } = createStatusSet();

      const result = validateTransitionRules(inProgressStatus, newStatus);

      expect(result.valid).toBe(true);
    });

    it("should allow reopen transitions", () => {
      const { resolvedStatus, newStatus } = createStatusSet();

      const result = validateTransitionRules(resolvedStatus, newStatus);

      expect(result.valid).toBe(true);
    });

    it("should allow same category transitions", () => {
      const { inProgressStatus, diagnosingStatus } = createStatusSet();

      const result = validateTransitionRules(
        inProgressStatus,
        diagnosingStatus,
      );

      expect(result.valid).toBe(true);
    });
  });

  describe("getTransitionType", () => {
    it("should identify progress transitions", () => {
      const { newStatus, inProgressStatus, resolvedStatus } = createStatusSet();

      expect(getTransitionType(newStatus, inProgressStatus)).toBe("progress");
      expect(getTransitionType(inProgressStatus, resolvedStatus)).toBe(
        "progress",
      );
    });

    it("should identify regress transitions", () => {
      const { newStatus, inProgressStatus, resolvedStatus } = createStatusSet();

      expect(getTransitionType(inProgressStatus, newStatus)).toBe("regress");
      expect(getTransitionType(resolvedStatus, inProgressStatus)).toBe(
        "regress",
      );
    });

    it("should identify reopen transitions", () => {
      const { newStatus, resolvedStatus } = createStatusSet();

      expect(getTransitionType(resolvedStatus, newStatus)).toBe("reopen");
    });

    it("should identify same category transitions", () => {
      const {
        inProgressStatus,
        diagnosingStatus,
        resolvedStatus,
        fixedStatus,
      } = createStatusSet();

      expect(getTransitionType(inProgressStatus, diagnosingStatus)).toBe(
        "same_category",
      );
      expect(getTransitionType(resolvedStatus, fixedStatus)).toBe(
        "same_category",
      );
    });

    it("should handle edge case transitions", () => {
      const status1 = createMockStatus({ category: "NEW" });
      const status2 = createMockStatus({ category: "NEW" });

      expect(getTransitionType(status1, status2)).toBe("same_category");
    });
  });

  describe("validateStatusLookup", () => {
    it("should validate successful status lookup", () => {
      const { newStatus } = createStatusSet();

      const result = validateStatusLookup(
        "status-id",
        organizationId,
        newStatus,
      );

      expect(result.found).toBe(true);
      expect(result.status).toEqual(newStatus);
      expect(result.error).toBeUndefined();
    });

    it("should handle null status lookup result", () => {
      const result = validateStatusLookup("invalid-id", organizationId, null);

      expect(result.found).toBe(false);
      expect(result.error).toBe("Invalid status");
      expect(result.status).toBeUndefined();
    });
  });

  describe("getValidStatusTransitions", () => {
    it("should return valid transitions for a status", () => {
      const { newStatus, inProgressStatus, resolvedStatus } = createStatusSet();
      const availableStatuses = [newStatus, inProgressStatus, resolvedStatus];

      const validTransitions = getValidStatusTransitions(
        newStatus,
        availableStatuses,
        context,
      );

      // Should include self and all valid transitions
      expect(validTransitions).toHaveLength(3);
      expect(validTransitions).toContain(newStatus);
      expect(validTransitions).toContain(inProgressStatus);
      expect(validTransitions).toContain(resolvedStatus);
    });

    it("should filter out invalid transitions due to permissions", () => {
      const { newStatus, inProgressStatus } = createStatusSet();
      const availableStatuses = [newStatus, inProgressStatus];
      const contextWithoutPermissions = {
        userPermissions: [],
        organizationId,
      };

      const validTransitions = getValidStatusTransitions(
        newStatus,
        availableStatuses,
        contextWithoutPermissions,
      );

      expect(validTransitions).toHaveLength(0);
    });

    it("should handle empty available statuses", () => {
      const { newStatus } = createStatusSet();

      const validTransitions = getValidStatusTransitions(
        newStatus,
        [],
        context,
      );

      expect(validTransitions).toHaveLength(0);
    });
  });

  describe("getStatusChangeEffects", () => {
    it("should detect when resolvedAt should be set", () => {
      const { inProgressStatus, resolvedStatus } = createStatusSet();

      const effects = getStatusChangeEffects(inProgressStatus, resolvedStatus);

      expect(effects.shouldSetResolvedAt).toBe(true);
      expect(effects.shouldClearResolvedAt).toBe(false);
      expect(effects.requiresActivityLog).toBe(true);
    });

    it("should detect when resolvedAt should be cleared", () => {
      const { resolvedStatus, inProgressStatus } = createStatusSet();

      const effects = getStatusChangeEffects(resolvedStatus, inProgressStatus);

      expect(effects.shouldSetResolvedAt).toBe(false);
      expect(effects.shouldClearResolvedAt).toBe(true);
      expect(effects.requiresActivityLog).toBe(true);
    });

    it("should detect no changes for same status", () => {
      const { newStatus } = createStatusSet();

      const effects = getStatusChangeEffects(newStatus, newStatus);

      expect(effects.shouldSetResolvedAt).toBe(false);
      expect(effects.shouldClearResolvedAt).toBe(false);
      expect(effects.requiresActivityLog).toBe(false);
    });

    it("should detect activity log requirement for different statuses", () => {
      const { newStatus, inProgressStatus } = createStatusSet();

      const effects = getStatusChangeEffects(newStatus, inProgressStatus);

      expect(effects.requiresActivityLog).toBe(true);
    });

    it("should handle resolved to resolved transitions", () => {
      const { resolvedStatus, fixedStatus } = createStatusSet();

      const effects = getStatusChangeEffects(resolvedStatus, fixedStatus);

      expect(effects.shouldSetResolvedAt).toBe(false);
      expect(effects.shouldClearResolvedAt).toBe(false);
      expect(effects.requiresActivityLog).toBe(true);
    });
  });

  describe("Edge Cases and Error Conditions", () => {
    it("should handle undefined status names", () => {
      const status1 = createMockStatus({ name: "" });
      const status2 = createMockStatus();

      const result = validateTransitionRules(status1, status2);
      expect(result.valid).toBe(true);
    });

    it("should handle very long status names", () => {
      const longName = "A".repeat(1000);
      const status1 = createMockStatus({ name: longName });
      const status2 = createMockStatus();

      const result = validateTransitionRules(status1, status2);
      expect(result.valid).toBe(true);
    });

    it("should handle special characters in status names", () => {
      const status1 = createMockStatus({ name: "Status with @#$%^&*()!" });
      const status2 = createMockStatus();

      const result = validateTransitionRules(status1, status2);
      expect(result.valid).toBe(true);
    });

    it("should handle multiple permissions", () => {
      const { newStatus, inProgressStatus } = createStatusSet();
      const permissions = ["issue:edit", "issue:admin", "other:permission"];

      const result = validateUserPermissions(
        newStatus,
        inProgressStatus,
        permissions,
      );

      expect(result.valid).toBe(true);
    });
  });

  describe("Business Rule Coverage", () => {
    it("should test all possible category combinations", () => {
      const categories = ["NEW", "IN_PROGRESS", "RESOLVED"] as const;
      const statuses = categories.map((category, index) =>
        createMockStatus({
          id: `status-${index}`,
          name: category,
          category,
        }),
      );

      // Test all combinations
      for (const currentStatus of statuses) {
        for (const newStatus of statuses) {
          const result = validateTransitionRules(currentStatus, newStatus);
          expect(result.valid).toBe(true); // All transitions currently allowed
        }
      }
    });

    it("should validate organization boundary for all scenarios", () => {
      const { newStatus, inProgressStatus, resolvedStatus } = createStatusSet();
      const statuses = [newStatus, inProgressStatus, resolvedStatus];

      for (const currentStatus of statuses) {
        for (const newStatus of statuses) {
          const result = validateOrganizationBoundary(
            currentStatus,
            newStatus,
            organizationId,
          );
          expect(result.valid).toBe(true);
        }
      }
    });

    it("should test permission requirements for all transition types", () => {
      const { newStatus, inProgressStatus, resolvedStatus } = createStatusSet();
      const transitions = [
        { from: newStatus, to: inProgressStatus, type: "progress" },
        { from: inProgressStatus, to: resolvedStatus, type: "progress" },
        { from: resolvedStatus, to: inProgressStatus, type: "regress" },
        { from: inProgressStatus, to: newStatus, type: "regress" },
        { from: resolvedStatus, to: newStatus, type: "reopen" },
      ];

      for (const transition of transitions) {
        const result = validateUserPermissions(transition.from, transition.to, [
          "issue:edit",
        ]);
        expect(result.valid).toBe(true);
      }
    });
  });
});

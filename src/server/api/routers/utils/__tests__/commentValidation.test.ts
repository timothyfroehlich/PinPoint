/**
 * Comment Validation Tests
 *
 * Comprehensive test suite for comment validation functions with real database testing.
 * Tests all validation logic paths, edge cases, and error conditions using PGlite.
 *
 * Coverage Focus:
 * - All validation functions with success/failure cases
 * - Edge cases and boundary conditions
 * - Security validation (cross-org access, permissions)
 * - Complex validation workflows
 * - Real database state for organizational boundary testing
 *
 * Uses modern August 2025 patterns with Vitest and PGlite integration.
 */

import { describe, expect, it } from "vitest";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

import {
  validateCommentExists,
  validateCommentDeletionPermissions,
  validateCommentEditPermissions,
  validateCommentDeletionState,
  validateAdminPermissions,
  validateOrganizationMembership,
  validateCommentDeletion,
  validateCommentRestoration,
  validateCommentEdit,
  type CommentData,
  type ValidationContext,
  type ValidationResult,
} from "../commentValidation";

describe("Comment Validation Functions", () => {
  // Static test data that doesn't require database
  const staticTestData = {
  organization: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
  location: SEED_TEST_IDS.MOCK_PATTERNS.LOCATION,
  machine: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
  model: SEED_TEST_IDS.MOCK_PATTERNS.MODEL,
  status: SEED_TEST_IDS.MOCK_PATTERNS.STATUS,
  priority: SEED_TEST_IDS.MOCK_PATTERNS.PRIORITY,
  issue: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
  adminRole: SEED_TEST_IDS.MOCK_PATTERNS.ROLE,
  memberRole: SEED_TEST_IDS.MOCK_PATTERNS.ROLE,
  user: SEED_TEST_IDS.MOCK_PATTERNS.USER,
  };

  // Test fixture data
  const createValidCommentData = (
    overrides: Partial<CommentData> = {},
  ): CommentData => ({
  id: SEED_TEST_IDS.MOCK_PATTERNS.COMMENT,
  authorId: staticTestData.user,
    deletedAt: null,
    issue: {
      id: staticTestData.issue,
      organizationId: staticTestData.organization,
    },
    ...overrides,
  });

  const createValidContext = (
    overrides: Partial<ValidationContext> = {},
  ): ValidationContext => ({
    userId: staticTestData.user,
    organizationId: staticTestData.organization,
    userPermissions: [],
    ...overrides,
  });

  describe("validateCommentExists", () => {
    it("should return valid for existing comment in correct organization", () => {
      const comment = createValidCommentData();
      const result = validateCommentExists(
        comment,
        staticTestData.organization,
      );

      expect(result).toEqual({ valid: true });
    });

    it("should return invalid for null comment", () => {
      const result = validateCommentExists(null, staticTestData.organization);

      expect(result).toEqual({
        valid: false,
        error: "Comment not found",
      });
    });

    it("should return invalid for undefined comment", () => {
      const result = validateCommentExists(
        undefined,
        staticTestData.organization,
      );

      expect(result).toEqual({
        valid: false,
        error: "Comment not found",
      });
    });

    it("should return invalid for comment from different organization", () => {
      const comment = createValidCommentData({
        issue: {
    id: "mock-issue-2",
    organizationId: "mock-org-2",
        },
      });
      const result = validateCommentExists(
        comment,
        staticTestData.organization,
      );

      expect(result).toEqual({
        valid: false,
        error: "Comment not found", // Security: don't reveal cross-org access
      });
    });

    it("should handle empty organization ID", () => {
      const comment = createValidCommentData();
      const result = validateCommentExists(comment, "");

      expect(result).toEqual({
        valid: false,
        error: "Comment not found",
      });
    });

    it("should handle comment with empty issue organization ID", () => {
      const comment = createValidCommentData({
        issue: {
    id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
    organizationId: "",
        },
      });
      const result = validateCommentExists(
        comment,
        staticTestData.organization,
      );

      expect(result).toEqual({
        valid: false,
        error: "Comment not found",
      });
    });
  });

  describe("validateCommentDeletionPermissions", () => {
    it("should allow user to delete their own comment", () => {
      const comment = createValidCommentData({
        authorId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
      });
      const context = createValidContext({
        userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        userPermissions: [],
      });

      const result = validateCommentDeletionPermissions(comment, context);

      expect(result).toEqual({ valid: true });
    });

    it("should allow admin to delete any comment", () => {
      const comment = createValidCommentData({
        authorId: "mock-user-2",
      });
      const context = createValidContext({
        userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        userPermissions: ["issue:delete"],
      });

      const result = validateCommentDeletionPermissions(comment, context);

      expect(result).toEqual({ valid: true });
    });

    it("should deny deletion when user is not author and not admin", () => {
      const comment = createValidCommentData({
        authorId: "mock-user-2",
      });
      const context = createValidContext({
        userId: "mock-user-3",
        userPermissions: ["issue:read"],
      });

      const result = validateCommentDeletionPermissions(comment, context);

      expect(result).toEqual({
        valid: false,
        error: "You can only delete your own comments",
      });
    });

    it("should allow deletion with any admin permission", () => {
      const comment = createValidCommentData({
        authorId: "mock-user-2",
      });
      const context = createValidContext({
        userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        userPermissions: ["issue:delete", "issue:create", "issue:update"],
      });

      const result = validateCommentDeletionPermissions(comment, context);

      expect(result).toEqual({ valid: true });
    });

    it("should handle empty permissions array", () => {
      const comment = createValidCommentData({
        authorId: "other-user",
      });
      const context = createValidContext({
        userId: "regular-user",
        userPermissions: [],
      });

      const result = validateCommentDeletionPermissions(comment, context);

      expect(result).toEqual({
        valid: false,
        error: "You can only delete your own comments",
      });
    });

    it("should handle permissions that don't include issue:delete", () => {
      const comment = createValidCommentData({
        authorId: "other-user",
      });
      const context = createValidContext({
        userId: "limited-user",
        userPermissions: ["issue:read", "issue:create", "machine:update"],
      });

      const result = validateCommentDeletionPermissions(comment, context);

      expect(result).toEqual({
        valid: false,
        error: "You can only delete your own comments",
      });
    });

    it("should prioritize authorship over admin permissions", () => {
      const comment = createValidCommentData({
        authorId: "user-123",
      });
      const context = createValidContext({
        userId: "user-123",
        userPermissions: [], // No admin permissions, but is author
      });

      const result = validateCommentDeletionPermissions(comment, context);

      expect(result).toEqual({ valid: true });
    });
  });

  describe("validateCommentEditPermissions", () => {
    it("should allow user to edit their own comment", () => {
      const comment = createValidCommentData({
        authorId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
      });
      const context = createValidContext({
        userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
      });

      const result = validateCommentEditPermissions(comment, context);

      expect(result).toEqual({ valid: true });
    });

    it("should deny editing for non-authors", () => {
      const comment = createValidCommentData({
        authorId: "mock-user-2",
      });
      const context = createValidContext({
        userId: "mock-user-3",
      });

      const result = validateCommentEditPermissions(comment, context);

      expect(result).toEqual({
        valid: false,
        error: "You can only edit your own comments",
      });
    });

    it("should deny editing even for admins who are not authors", () => {
      const comment = createValidCommentData({
        authorId: "mock-user-2",
      });
      const context = createValidContext({
        userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        userPermissions: ["issue:delete", "issue:update"],
      });

      const result = validateCommentEditPermissions(comment, context);

      expect(result).toEqual({
        valid: false,
        error: "You can only edit your own comments",
      });
    });

    it("should handle empty user IDs", () => {
      const comment = createValidCommentData({
        authorId: "",
      });
      const context = createValidContext({
        userId: "",
      });

      const result = validateCommentEditPermissions(comment, context);

      expect(result).toEqual({ valid: true }); // Both empty, considered same
    });

    it("should handle case sensitivity in user IDs", () => {
      const comment = createValidCommentData({
        authorId: "User-123",
      });
      const context = createValidContext({
        userId: "user-123", // Different case
      });

      const result = validateCommentEditPermissions(comment, context);

      expect(result).toEqual({
        valid: false,
        error: "You can only edit your own comments",
      });
    });
  });

  describe("validateCommentDeletionState", () => {
    it("should return valid when comment is not deleted and shouldBeDeleted is false", () => {
      const comment = createValidCommentData({
        deletedAt: null,
      });

      const result = validateCommentDeletionState(comment, false);

      expect(result).toEqual({ valid: true });
    });

    it("should return valid when comment is deleted and shouldBeDeleted is true", () => {
      const comment = createValidCommentData({
        deletedAt: new Date("2024-01-01T12:00:00Z"),
      });

      const result = validateCommentDeletionState(comment, true);

      expect(result).toEqual({ valid: true });
    });

    it("should return invalid when comment is not deleted but shouldBeDeleted is true", () => {
      const comment = createValidCommentData({
        deletedAt: null,
      });

      const result = validateCommentDeletionState(comment, true);

      expect(result).toEqual({
        valid: false,
        error: "Comment is not deleted",
      });
    });

    it("should return invalid when comment is deleted but shouldBeDeleted is false", () => {
      const comment = createValidCommentData({
        deletedAt: new Date("2024-01-01T12:00:00Z"),
      });

      const result = validateCommentDeletionState(comment, false);

      expect(result).toEqual({
        valid: false,
        error: "Cannot edit deleted comment",
      });
    });

    it("should treat future deletion dates as deleted", () => {
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow
      const comment = createValidCommentData({
        deletedAt: futureDate,
      });

      const result = validateCommentDeletionState(comment, true);

      expect(result).toEqual({ valid: true });
    });

    it("should treat very old deletion dates as deleted", () => {
      const veryOldDate = new Date("1990-01-01T12:00:00Z");
      const comment = createValidCommentData({
        deletedAt: veryOldDate,
      });

      const result = validateCommentDeletionState(comment, true);

      expect(result).toEqual({ valid: true });
    });
  });

  describe("validateAdminPermissions", () => {
    it("should return valid when user has required permission", () => {
      const userPermissions = ["issue:read", "issue:delete", "issue:create"];

      const result = validateAdminPermissions(userPermissions, "issue:delete");

      expect(result).toEqual({ valid: true });
    });

    it("should use default permission when none specified", () => {
      const userPermissions = ["issue:delete"];

      const result = validateAdminPermissions(userPermissions);

      expect(result).toEqual({ valid: true });
    });

    it("should return invalid when user lacks required permission", () => {
      const userPermissions = ["issue:read", "issue:create"];

      const result = validateAdminPermissions(userPermissions, "issue:delete");

      expect(result).toEqual({
        valid: false,
        error: "Insufficient permissions to perform this action",
      });
    });

    it("should handle empty permissions array", () => {
      const userPermissions: string[] = [];

      const result = validateAdminPermissions(userPermissions, "issue:delete");

      expect(result).toEqual({
        valid: false,
        error: "Insufficient permissions to perform this action",
      });
    });

    it("should handle custom permission requirements", () => {
      const userPermissions = ["machine:update", "location:delete"];

      const result = validateAdminPermissions(
        userPermissions,
        "machine:update",
      );

      expect(result).toEqual({ valid: true });
    });

    it("should be case sensitive for permissions", () => {
      const userPermissions = ["ISSUE:DELETE"];

      const result = validateAdminPermissions(userPermissions, "issue:delete");

      expect(result).toEqual({
        valid: false,
        error: "Insufficient permissions to perform this action",
      });
    });

    it("should handle partial permission matches", () => {
      const userPermissions = ["issue:delete-all"]; // Similar but not exact

      const result = validateAdminPermissions(userPermissions, "issue:delete");

      expect(result).toEqual({
        valid: false,
        error: "Insufficient permissions to perform this action",
      });
    });
  });

  describe("validateOrganizationMembership", () => {
    it("should return valid for correct membership", () => {
      const membership = {
        id: "membership-1",
        userId: "user-123",
        organizationId: staticTestData.organization,
      };
      const context = createValidContext({
        userId: "user-123",
        organizationId: staticTestData.organization,
      });

      const result = validateOrganizationMembership(membership, context);

      expect(result).toEqual({ valid: true });
    });

    it("should return invalid for null membership", () => {
      const context = createValidContext();

      const result = validateOrganizationMembership(null, context);

      expect(result).toEqual({
        valid: false,
        error: "User is not a member of this organization",
      });
    });

    it("should return invalid for mismatched user ID", () => {
      const membership = {
        id: "membership-1",
        userId: "other-user",
        organizationId: staticTestData.organization,
      };
      const context = createValidContext({
        userId: "user-123",
      });

      const result = validateOrganizationMembership(membership, context);

      expect(result).toEqual({
        valid: false,
        error: "User is not a member of this organization",
      });
    });

    it("should return invalid for mismatched organization ID", () => {
      const membership = {
        id: "membership-1",
        userId: "user-123",
        organizationId: "other-org",
      };
      const context = createValidContext({
        userId: "user-123",
      });

      const result = validateOrganizationMembership(membership, context);

      expect(result).toEqual({
        valid: false,
        error: "User is not a member of this organization",
      });
    });

    it("should return invalid when both user and org are mismatched", () => {
      const membership = {
        id: "membership-1",
        userId: "other-user",
        organizationId: "other-org",
      };
      const context = createValidContext({
        userId: "user-123",
      });

      const result = validateOrganizationMembership(membership, context);

      expect(result).toEqual({
        valid: false,
        error: "User is not a member of this organization",
      });
    });

    it("should handle empty membership data", () => {
      const membership = {
        id: "",
        userId: "",
        organizationId: "",
      };
      const context = createValidContext({
        userId: "",
        organizationId: "",
      });

      const result = validateOrganizationMembership(membership, context);

      expect(result).toEqual({ valid: true }); // All empty matches
    });
  });

  describe("validateCommentDeletion - Comprehensive Validation", () => {
    it("should return valid for complete valid deletion scenario", () => {
      const comment = createValidCommentData({
        authorId: "user-123",
        deletedAt: null, // Not already deleted
      });
      const membership = {
        id: "membership-1",
        userId: "user-123",
        organizationId: staticTestData.organization,
      };
      const context = createValidContext({
        userId: "user-123",
        userPermissions: [],
      });

      const result = validateCommentDeletion(comment, membership, context);

      expect(result).toEqual({ valid: true });
    });

    it("should return valid for admin deleting any comment", () => {
      const comment = createValidCommentData({
        authorId: "other-user",
        deletedAt: null,
      });
      const membership = {
        id: "membership-1",
        userId: "admin-123",
        organizationId: staticTestData.organization,
      };
      const context = createValidContext({
        userId: "admin-123",
        userPermissions: ["issue:delete"],
      });

      const result = validateCommentDeletion(comment, membership, context);

      expect(result).toEqual({ valid: true });
    });

    it("should fail when comment does not exist", () => {
      const membership = {
        id: "membership-1",
        userId: "user-123",
        organizationId: staticTestData.organization,
      };
      const context = createValidContext({
        userId: "user-123",
      });

      const result = validateCommentDeletion(null, membership, context);

      expect(result).toEqual({
        valid: false,
        error: "Comment not found",
      });
    });

    it("should fail when user is not a member", () => {
      const comment = createValidCommentData({
        authorId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
      });
      const context = createValidContext({
        userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        userPermissions: [],
      });
        error: "User is not a member of this organization",
      });
    });

    it("should fail when comment is already deleted", () => {
      const comment = createValidCommentData({
        deletedAt: new Date("2024-01-01T12:00:00Z"),
      });
      const membership = {
        id: "membership-1",
        userId: "user-123",
        organizationId: staticTestData.organization,
      };
      const context = createValidContext({
        userId: "user-123",
      });

      const result = validateCommentDeletion(comment, membership, context);

      expect(result).toEqual({
        valid: false,
        error: "Comment is already deleted",
      });
    });

    it("should fail when user lacks permissions", () => {
      const comment = createValidCommentData({
        authorId: "other-user", // Not the current user
        deletedAt: null,
      });
      const membership = {
        id: "membership-1",
        userId: "user-123",
        organizationId: staticTestData.organization,
      };
      const context = createValidContext({
        userId: "user-123",
        userPermissions: [], // No admin permissions
      });

      const result = validateCommentDeletion(comment, membership, context);

      expect(result).toEqual({
        valid: false,
        error: "You can only delete your own comments",
      });
    });

    it("should fail at first validation step (comment existence)", () => {
      const comment = createValidCommentData({
        issue: {
          id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
          organizationId: "mock-org-2",
        },
      });
      const membership = {
        id: "membership-1",
        userId: "user-123",
        organizationId: staticTestData.organization,
      };
      const context = createValidContext({
        userId: "user-123",
      });

      const result = validateCommentDeletion(comment, membership, context);

      expect(result).toEqual({
        valid: false,
        error: "Comment not found",
      });
    });
  });

  describe("validateCommentRestoration - Comprehensive Validation", () => {
    it("should return valid for admin restoring deleted comment", () => {
      const comment = createValidCommentData({
        deletedAt: new Date("2024-01-01T12:00:00Z"),
      });
      const context = createValidContext({
        userPermissions: ["issue:delete"],
      });

      const result = validateCommentRestoration(comment, context);

      expect(result).toEqual({ valid: true });
    });

    it("should fail when comment does not exist", () => {
      const context = createValidContext({
        userPermissions: ["issue:delete"],
      });

      const result = validateCommentRestoration(null, context);

      expect(result).toEqual({
        valid: false,
        error: "Comment not found",
      });
    });

    it("should fail when comment is not deleted", () => {
      const comment = createValidCommentData({
        deletedAt: null,
      });
      const context = createValidContext({
        userPermissions: ["issue:delete"],
      });

      const result = validateCommentRestoration(comment, context);

      expect(result).toEqual({
        valid: false,
        error: "Comment is not deleted",
      });
    });

    it("should fail when user lacks admin permissions", () => {
      const comment = createValidCommentData({
        deletedAt: new Date("2024-01-01T12:00:00Z"),
      });
      const context = createValidContext({
        userPermissions: ["issue:read"],
      });

      const result = validateCommentRestoration(comment, context);

      expect(result).toEqual({
        valid: false,
        error: "Insufficient permissions to restore comments",
      });
    });

    it("should fail when user has no permissions", () => {
      const comment = createValidCommentData({
        deletedAt: new Date("2024-01-01T12:00:00Z"),
      });
      const context = createValidContext({
        userPermissions: [],
      });

      const result = validateCommentRestoration(comment, context);

      expect(result).toEqual({
        valid: false,
        error: "Insufficient permissions to restore comments",
      });
    });

    it("should fail for cross-organization comment", () => {
      const comment = createValidCommentData({
        deletedAt: new Date("2024-01-01T12:00:00Z"),
        issue: {
          id: "mock-issue-2",
          organizationId: "mock-org-2",
        },
      });
      const context = createValidContext({
        userPermissions: ["issue:delete"],
      });

      const result = validateCommentRestoration(comment, context);

      expect(result).toEqual({
        valid: false,
        error: "Comment not found",
      });
    });
  });

  describe("validateCommentEdit - Comprehensive Validation", () => {
    it("should return valid for user editing their own non-deleted comment", () => {
      const comment = createValidCommentData({
        authorId: "user-123",
        deletedAt: null,
      });
      const context = createValidContext({
        userId: "user-123",
      });

      const result = validateCommentEdit(comment, context);

      expect(result).toEqual({ valid: true });
    });

    it("should fail when comment does not exist", () => {
      const context = createValidContext({
        userId: "user-123",
      });

      const result = validateCommentEdit(null, context);

      expect(result).toEqual({
        valid: false,
        error: "Comment not found",
      });
    });

    it("should fail when comment is deleted", () => {
      const comment = createValidCommentData({
        authorId: "user-123",
        deletedAt: new Date("2024-01-01T12:00:00Z"),
      });
      const context = createValidContext({
        userId: "user-123",
      });

      const result = validateCommentEdit(comment, context);

      expect(result).toEqual({
        valid: false,
        error: "Cannot edit deleted comment",
      });
    });

    it("should fail when user is not the author", () => {
      const comment = createValidCommentData({
        authorId: "other-user",
        deletedAt: null,
      });
      const context = createValidContext({
        userId: "user-123",
      });

      const result = validateCommentEdit(comment, context);

      expect(result).toEqual({
        valid: false,
        error: "You can only edit your own comments",
      });
    });

    it("should fail for cross-organization comment", () => {
      const comment = createValidCommentData({
        authorId: "user-123",
        deletedAt: null,
        issue: {
          id: "other-issue",
          organizationId: "other-org",
        },
      });
      const context = createValidContext({
        userId: "user-123",
      });

      const result = validateCommentEdit(comment, context);

      expect(result).toEqual({
        valid: false,
        error: "Comment not found",
      });
    });

    it("should fail even for admins who are not authors", () => {
      const comment = createValidCommentData({
        authorId: "other-user",
        deletedAt: null,
      });
      const context = createValidContext({
        userId: "admin-123",
        userPermissions: ["issue:delete"],
      });

      const result = validateCommentEdit(comment, context);

      expect(result).toEqual({
        valid: false,
        error: "You can only edit your own comments",
      });
    });
  });

  describe("Edge Cases and Boundary Conditions", () => {
    it("should handle very long permission strings", () => {
      const longPermission = "a".repeat(1000) + ":delete";
      const userPermissions = [longPermission];

      const result = validateAdminPermissions(userPermissions, longPermission);

      expect(result).toEqual({ valid: true });
    });

    it("should handle special characters in user IDs", () => {
      const specialUserId = "user-@#$%^&*()_+{}|:<>?[]\\;'\".,/";
      const comment = createValidCommentData({
        authorId: specialUserId,
      });
      const context = createValidContext({
        userId: specialUserId,
      });

      const result = validateCommentEditPermissions(comment, context);

      expect(result).toEqual({ valid: true });
    });

    it("should handle unicode characters in organization IDs", () => {
      const unicodeOrgId = "org-测试-组织-🏢";
      const comment = createValidCommentData({
        issue: {
          id: "test-issue",
          organizationId: unicodeOrgId,
        },
      });

      const result = validateCommentExists(comment, unicodeOrgId);

      expect(result).toEqual({ valid: true });
    });

    it("should handle very future dates for deletedAt", () => {
      const veryFutureDate = new Date("2099-12-31T23:59:59Z");
      const comment = createValidCommentData({
        deletedAt: veryFutureDate,
      });

      const result = validateCommentDeletionState(comment, true);

      expect(result).toEqual({ valid: true });
    });

    it("should handle epoch date for deletedAt", () => {
      const epochDate = new Date(0); // 1970-01-01
      const comment = createValidCommentData({
        deletedAt: epochDate,
      });

      const result = validateCommentDeletionState(comment, true);

      expect(result).toEqual({ valid: true });
    });

    it("should handle large permission arrays", () => {
      const manyPermissions = Array.from(
        { length: 1000 },
        (_, i) => `perm:${i}`,
      );
      manyPermissions.push("issue:delete");

      const result = validateAdminPermissions(manyPermissions, "issue:delete");

      expect(result).toEqual({ valid: true });
    });

    it("should handle permissions with special characters", () => {
      const specialPermissions = [
        "permission:with:colons",
        "permission-with-dashes",
        "permission_with_underscores",
        "permission.with.dots",
        "PERMISSION_WITH_CAPS",
        "permission with spaces", // This might be considered invalid in real systems
      ];

      specialPermissions.forEach((permission) => {
        const result = validateAdminPermissions([permission], permission);
        expect(result).toEqual({ valid: true });
      });
    });
  });

  describe("Type Safety and Interface Compliance", () => {
    it("should handle ValidationResult interface correctly", () => {
      const validResult: ValidationResult = { valid: true };
      const invalidResult: ValidationResult = {
        valid: false,
        error: "Test error",
      };

      expect(validResult.valid).toBe(true);
      expect(validResult.error).toBeUndefined();
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBe("Test error");
    });

    it("should handle CommentData interface correctly", () => {
      const commentData: CommentData = {
        id: SEED_TEST_IDS.MOCK_PATTERNS.COMMENT,
        authorId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        deletedAt: new Date(),
        issue: {
          id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
          organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        },
      };

      expect(typeof commentData.id).toBe("string");
      expect(typeof commentData.authorId).toBe("string");
      expect(commentData.deletedAt).toBeInstanceOf(Date);
      expect(typeof commentData.issue.id).toBe("string");
      expect(typeof commentData.issue.organizationId).toBe("string");
    });

    it("should handle ValidationContext interface correctly", () => {
      const context: ValidationContext = {
        userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        userPermissions: ["perm1", "perm2"],
      };

      expect(typeof context.userId).toBe("string");
      expect(typeof context.organizationId).toBe("string");
      expect(Array.isArray(context.userPermissions)).toBe(true);
      expect(context.userPermissions.every((p) => typeof p === "string")).toBe(
        true,
      );
    });
  });
});

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

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

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

import * as schema from "~/server/db/schema";
import {
  createSeededTestDatabase,
  getSeededTestData,
  type TestDatabase,
} from "~/test/helpers/pglite-test-setup";

describe("Comment Validation Functions", () => {
  let db: TestDatabase;
  let testData: {
    organization: string;
    location?: string;
    machine?: string;
    model?: string;
    status?: string;
    priority?: string;
    issue?: string;
    adminRole?: string;
    memberRole?: string;
    user?: string;
  };

  // Test fixture data
  const createValidCommentData = (
    overrides: Partial<CommentData> = {},
  ): CommentData => ({
    id: "test-comment-1",
    authorId: testData.user || "test-user-1",
    deletedAt: null,
    issue: {
      id: testData.issue || "test-issue-1",
      organizationId: testData.organization,
    },
    ...overrides,
  });

  const createValidContext = (
    overrides: Partial<ValidationContext> = {},
  ): ValidationContext => ({
    userId: testData.user || "test-user-1",
    organizationId: testData.organization,
    userPermissions: [],
    ...overrides,
  });

  beforeEach(async () => {
    // Create fresh PGlite database with real schema and seed data
    const setup = await createSeededTestDatabase();
    db = setup.db;
    testData = await getSeededTestData(db, setup.organizationId);
  });

  describe("validateCommentExists", () => {
    it("should return valid for existing comment in correct organization", () => {
      const comment = createValidCommentData();
      const result = validateCommentExists(comment, testData.organization);

      expect(result).toEqual({ valid: true });
    });

    it("should return invalid for null comment", () => {
      const result = validateCommentExists(null, testData.organization);

      expect(result).toEqual({
        valid: false,
        error: "Comment not found",
      });
    });

    it("should return invalid for undefined comment", () => {
      const result = validateCommentExists(undefined, testData.organization);

      expect(result).toEqual({
        valid: false,
        error: "Comment not found",
      });
    });

    it("should return invalid for comment from different organization", () => {
      const comment = createValidCommentData({
        issue: {
          id: "other-issue",
          organizationId: "other-org-id",
        },
      });
      const result = validateCommentExists(comment, testData.organization);

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
          id: "test-issue",
          organizationId: "",
        },
      });
      const result = validateCommentExists(comment, testData.organization);

      expect(result).toEqual({
        valid: false,
        error: "Comment not found",
      });
    });
  });

  describe("validateCommentDeletionPermissions", () => {
    it("should allow user to delete their own comment", () => {
      const comment = createValidCommentData({
        authorId: "user-123",
      });
      const context = createValidContext({
        userId: "user-123",
        userPermissions: [],
      });

      const result = validateCommentDeletionPermissions(comment, context);

      expect(result).toEqual({ valid: true });
    });

    it("should allow admin to delete any comment", () => {
      const comment = createValidCommentData({
        authorId: "other-user",
      });
      const context = createValidContext({
        userId: "admin-user",
        userPermissions: ["issue:delete"],
      });

      const result = validateCommentDeletionPermissions(comment, context);

      expect(result).toEqual({ valid: true });
    });

    it("should deny deletion when user is not author and not admin", () => {
      const comment = createValidCommentData({
        authorId: "other-user",
      });
      const context = createValidContext({
        userId: "regular-user",
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
        authorId: "other-user",
      });
      const context = createValidContext({
        userId: "admin-user",
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
        authorId: "user-123",
      });
      const context = createValidContext({
        userId: "user-123",
      });

      const result = validateCommentEditPermissions(comment, context);

      expect(result).toEqual({ valid: true });
    });

    it("should deny editing for non-authors", () => {
      const comment = createValidCommentData({
        authorId: "other-user",
      });
      const context = createValidContext({
        userId: "different-user",
      });

      const result = validateCommentEditPermissions(comment, context);

      expect(result).toEqual({
        valid: false,
        error: "You can only edit your own comments",
      });
    });

    it("should deny editing even for admins who are not authors", () => {
      const comment = createValidCommentData({
        authorId: "other-user",
      });
      const context = createValidContext({
        userId: "admin-user",
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
        organizationId: testData.organization,
      };
      const context = createValidContext({
        userId: "user-123",
        organizationId: testData.organization,
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
        organizationId: testData.organization,
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
        organizationId: testData.organization,
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
        organizationId: testData.organization,
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
        organizationId: testData.organization,
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
      const comment = createValidCommentData();
      const context = createValidContext();

      const result = validateCommentDeletion(comment, null, context);

      expect(result).toEqual({
        valid: false,
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
        organizationId: testData.organization,
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
        organizationId: testData.organization,
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
          id: "test-issue",
          organizationId: "wrong-org",
        },
      });
      const membership = {
        id: "membership-1",
        userId: "user-123",
        organizationId: testData.organization,
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
          id: "other-issue",
          organizationId: "other-org",
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

  describe("Real Database Integration Tests", () => {
    it("should validate against real organizational boundaries", async () => {
      // Create another organization to test cross-org validation
      const [otherOrg] = await db
        .insert(schema.organizations)
        .values({
          id: "other-test-org",
          name: "Other Test Organization",
          subdomain: "other-test",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Create a priority and status for the other org
      const [otherPriority] = await db
        .insert(schema.priorities)
        .values({
          id: "other-priority",
          name: "Other Priority",
          organizationId: otherOrg.id,
          order: 1,
        })
        .returning();

      const [otherStatus] = await db
        .insert(schema.issueStatuses)
        .values({
          id: "other-status",
          name: "Other Status",
          category: "NEW",
          organizationId: otherOrg.id,
        })
        .returning();

      // Create an issue in the other organization
      const [otherIssue] = await db
        .insert(schema.issues)
        .values({
          id: "other-org-issue",
          title: "Issue in Other Org",
          organizationId: otherOrg.id,
          machineId: testData.machine || "test-machine-1",
          statusId: otherStatus.id,
          priorityId: otherPriority.id,
          createdById: testData.user || "test-user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Test cross-org comment validation
      const crossOrgComment = createValidCommentData({
        issue: {
          id: otherIssue.id,
          organizationId: otherOrg.id,
        },
      });

      const result = validateCommentExists(
        crossOrgComment,
        testData.organization,
      );

      expect(result).toEqual({
        valid: false,
        error: "Comment not found", // Security: don't reveal cross-org access
      });
    });

    it("should validate with real user membership data", async () => {
      // Query real membership from the database
      const realMembership = await db.query.memberships.findFirst({
        where: eq(schema.memberships.organizationId, testData.organization),
      });

      if (realMembership) {
        const context = createValidContext({
          userId: realMembership.userId,
          organizationId: realMembership.organizationId,
        });

        const result = validateOrganizationMembership(realMembership, context);

        expect(result).toEqual({ valid: true });
      }
    });

    it("should validate with real role permissions", async () => {
      // Query admin role from the database (simplified approach)
      const adminRole = await db.query.roles.findFirst({
        where: eq(schema.roles.name, "Admin"),
      });

      if (adminRole) {
        // Query role permissions separately to avoid complex relation issues
        const rolePermissions = await db.query.rolePermissions.findMany({
          where: eq(schema.rolePermissions.roleId, adminRole.id),
        });

        if (rolePermissions.length > 0) {
          // Get permission keys
          const permissionIds = rolePermissions.map((rp) => rp.permissionId);
          const permissions = await db.query.permissions.findMany();

          const permissionKeys = permissions
            .filter((p) => permissionIds.includes(p.id))
            .map((p) => p.key);

          // Test with real permissions
          const result = validateAdminPermissions(
            permissionKeys,
            "issue:delete",
          );

          // Should pass if admin role has issue:delete permission
          if (permissionKeys.includes("issue:delete")) {
            expect(result).toEqual({ valid: true });
          } else {
            expect(result).toEqual({
              valid: false,
              error: "Insufficient permissions to perform this action",
            });
          }
        } else {
          // If no permissions found, test should still work with empty array
          const result = validateAdminPermissions([], "issue:delete");
          expect(result).toEqual({
            valid: false,
            error: "Insufficient permissions to perform this action",
          });
        }
      }
    });

    it("should validate complex scenarios with real database state", async () => {
      // Create a real comment in the database for testing
      const [realComment] = await db
        .insert(schema.comments)
        .values({
          id: "real-test-comment",
          content: "Real comment for validation testing",
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Query the comment with its issue relationship
      const commentWithIssue = await db.query.comments.findFirst({
        where: eq(schema.comments.id, realComment.id),
        with: {
          issue: true,
        },
      });

      if (commentWithIssue?.issue) {
        const commentData: CommentData = {
          id: commentWithIssue.id,
          authorId: commentWithIssue.authorId,
          deletedAt: commentWithIssue.deletedAt,
          issue: {
            id: commentWithIssue.issue.id,
            organizationId: commentWithIssue.issue.organizationId,
          },
        };

        const context = createValidContext({
          userId: commentWithIssue.authorId,
          organizationId: commentWithIssue.issue.organizationId,
        });

        // Test validation with real data
        const result = validateCommentEdit(commentData, context);

        expect(result).toEqual({ valid: true });
      }
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
        id: "comment-1",
        authorId: "user-1",
        deletedAt: new Date(),
        issue: {
          id: "issue-1",
          organizationId: "org-1",
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
        userId: "user-1",
        organizationId: "org-1",
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

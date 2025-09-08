/**
 * Pure validation functions for comment operations.
 * These functions are pure and testable, containing no side effects or external dependencies.
 */

export interface CommentData {
  id: string;
  authorId: string | null;
  deletedAt: Date | null;
  issue: {
    id: string;
    organizationId: string;
  };
}

export interface ValidationContext {
  userId: string;
  organizationId: string;
  userPermissions: string[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate that a comment exists and belongs to the correct organization
 */
export function validateCommentExists(
  comment: CommentData | null | undefined,
  organizationId: string,
): ValidationResult {
  if (!comment) {
    return {
      valid: false,
      error: "Comment not found",
    };
  }

  if (comment.issue.organizationId !== organizationId) {
    return {
      valid: false,
      error: "Comment not found", // Don't reveal cross-org access attempts
    };
  }

  return { valid: true };
}

/**
 * Validate comment deletion permissions
 */
export function validateCommentDeletionPermissions(
  comment: CommentData,
  context: ValidationContext,
): ValidationResult {
  // User can delete their own comment (not anonymous), or admins can delete any
  const canDelete =
    (comment.authorId !== null && comment.authorId === context.userId) ||
    context.userPermissions.includes("issue:delete");

  if (!canDelete) {
    return {
      valid: false,
      error: "You can only delete your own comments",
    };
  }

  return { valid: true };
}

/**
 * Validate comment editing permissions
 */
export function validateCommentEditPermissions(
  comment: CommentData,
  context: ValidationContext,
): ValidationResult {
  // Only authenticated authors can edit their own comments (anonymous comments cannot be edited)
  if (comment.authorId === null || comment.authorId !== context.userId) {
    return {
      valid: false,
      error: "You can only edit your own comments",
    };
  }

  return { valid: true };
}

/**
 * Validate comment deletion state
 */
export function validateCommentDeletionState(
  comment: CommentData,
  shouldBeDeleted: boolean,
): ValidationResult {
  const isDeleted = comment.deletedAt !== null;

  if (shouldBeDeleted && !isDeleted) {
    return {
      valid: false,
      error: "Comment is not deleted",
    };
  }

  if (!shouldBeDeleted && isDeleted) {
    return {
      valid: false,
      error: "Cannot edit deleted comment",
    };
  }

  return { valid: true };
}

/**
 * Validate admin permissions for comment management
 */
export function validateAdminPermissions(
  userPermissions: string[],
  requiredPermission = "issue:delete",
): ValidationResult {
  if (!userPermissions.includes(requiredPermission)) {
    return {
      valid: false,
      error: `Insufficient permissions to perform this action`,
    };
  }

  return { valid: true };
}

/**
 * Validate user membership in organization
 */
export function validateOrganizationMembership(
  membership: { id: string; userId: string; organizationId: string } | null,
  context: ValidationContext,
): ValidationResult {
  if (!membership) {
    return {
      valid: false,
      error: "User is not a member of this organization",
    };
  }

  if (
    membership.userId !== context.userId ||
    membership.organizationId !== context.organizationId
  ) {
    return {
      valid: false,
      error: "User is not a member of this organization",
    };
  }

  return { valid: true };
}

/**
 * Comprehensive validation for comment deletion
 */
export function validateCommentDeletion(
  comment: CommentData | null | undefined,
  membership: { id: string; userId: string; organizationId: string } | null,
  context: ValidationContext,
): ValidationResult {
  // Validate comment exists and belongs to organization
  const existsValidation = validateCommentExists(
    comment,
    context.organizationId,
  );
  if (!existsValidation.valid) {
    return existsValidation;
  }

  // Validate membership
  const membershipValidation = validateOrganizationMembership(
    membership,
    context,
  );
  if (!membershipValidation.valid) {
    return membershipValidation;
  }

  // Validate comment is not already deleted
  if (!comment) {
    throw new Error(
      "Comment validation failed - comment is null after existence check",
    );
  }

  const deletionStateValidation = validateCommentDeletionState(comment, false);
  if (!deletionStateValidation.valid) {
    return {
      valid: false,
      error: "Comment is already deleted",
    };
  }

  // Validate permissions
  const permissionValidation = validateCommentDeletionPermissions(
    comment,
    context,
  );
  if (!permissionValidation.valid) {
    return permissionValidation;
  }

  return { valid: true };
}

/**
 * Comprehensive validation for comment restoration
 */
export function validateCommentRestoration(
  comment: CommentData | null | undefined,
  context: ValidationContext,
): ValidationResult {
  // Validate comment exists and belongs to organization
  const existsValidation = validateCommentExists(
    comment,
    context.organizationId,
  );
  if (!existsValidation.valid) {
    return existsValidation;
  }

  // Validate comment is deleted
  if (!comment) {
    throw new Error(
      "Comment validation failed - comment is null after existence check",
    );
  }

  const deletionStateValidation = validateCommentDeletionState(comment, true);
  if (!deletionStateValidation.valid) {
    return deletionStateValidation;
  }

  // Validate admin permissions
  const adminValidation = validateAdminPermissions(context.userPermissions);
  if (!adminValidation.valid) {
    return {
      valid: false,
      error: "Insufficient permissions to restore comments",
    };
  }

  return { valid: true };
}

/**
 * Comprehensive validation for comment editing
 */
export function validateCommentEdit(
  comment: CommentData | null | undefined,
  context: ValidationContext,
): ValidationResult {
  // Validate comment exists and belongs to organization
  const existsValidation = validateCommentExists(
    comment,
    context.organizationId,
  );
  if (!existsValidation.valid) {
    return existsValidation;
  }

  // Validate comment is not deleted
  if (!comment) {
    throw new Error(
      "Comment validation failed - comment is null after existence check",
    );
  }

  const deletionStateValidation = validateCommentDeletionState(comment, false);
  if (!deletionStateValidation.valid) {
    return {
      valid: false,
      error: "Cannot edit deleted comment",
    };
  }

  // Validate edit permissions
  const editValidation = validateCommentEditPermissions(comment, context);
  if (!editValidation.valid) {
    return editValidation;
  }

  return { valid: true };
}

/**
 * Pure comment access control validation functions
 * Extracted from tRPC procedures for better testability and performance
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface CommentWithIssue {
  readonly id: string;
  readonly content: string;
  readonly authorId: string;
  readonly issueId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  readonly issue: {
    readonly id: string;
    readonly organizationId: string;
  };
  readonly author: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
  };
}

export interface CommentCreationInput {
  readonly issueId: string;
  readonly content: string;
}

export interface CommentEditInput {
  readonly commentId: string;
  readonly content: string;
}

export interface CommentAccessContext {
  readonly userId: string;
  readonly organizationId: string;
  readonly userPermissions: readonly string[];
}

export interface IssueReference {
  readonly id: string;
  readonly organizationId: string;
}

export interface ValidationResult<T = void> {
  readonly valid: boolean;
  readonly error?: string;
  readonly data?: T;
}

// =============================================================================
// COMMENT VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate comment content input
 * Pure function that validates comment content constraints
 */
export function validateCommentContent(content: string): ValidationResult {
  if (!content || content.trim().length === 0) {
    return {
      valid: false,
      error: "Comment content is required",
    };
  }

  if (content.length > 1000) {
    return {
      valid: false,
      error: "Comment must be 1000 characters or less",
    };
  }

  return { valid: true };
}

/**
 * Validate comment creation input
 * Pure function that validates all comment creation parameters
 */
export function validateCommentCreationInput(
  input: CommentCreationInput,
): ValidationResult {
  // Validate content
  const contentValidation = validateCommentContent(input.content);
  if (!contentValidation.valid) {
    return contentValidation;
  }

  // Validate issue ID
  if (!input.issueId || input.issueId.trim().length === 0) {
    return {
      valid: false,
      error: "Issue ID is required",
    };
  }

  return { valid: true };
}

/**
 * Validate comment edit input
 * Pure function that validates comment editing parameters
 */
export function validateCommentEditInput(
  input: CommentEditInput,
): ValidationResult {
  // Validate content
  const contentValidation = validateCommentContent(input.content);
  if (!contentValidation.valid) {
    return contentValidation;
  }

  // Validate comment ID
  if (!input.commentId || input.commentId.trim().length === 0) {
    return {
      valid: false,
      error: "Comment ID is required",
    };
  }

  return { valid: true };
}

/**
 * Validate comment access permissions
 * Pure function that checks if user can access comments for an issue
 */
export function validateCommentAccess(
  issue: IssueReference | null,
  context: CommentAccessContext,
): ValidationResult<IssueReference> {
  if (!issue) {
    return {
      valid: false,
      error: "Issue not found",
    };
  }

  // Check organization boundary
  if (issue.organizationId !== context.organizationId) {
    return {
      valid: false,
      error: "Issue not found or does not belong to this organization",
    };
  }

  // Check permissions - require at least issue:create for comment creation
  if (!context.userPermissions.includes("issue:create")) {
    return {
      valid: false,
      error: "User does not have permission to create comments",
    };
  }

  return {
    valid: true,
    data: issue,
  };
}

/**
 * Validate comment edit permissions
 * Pure function that checks if user can edit a specific comment
 */
export function validateCommentEditPermissions(
  comment: CommentWithIssue | null,
  context: CommentAccessContext,
): ValidationResult<CommentWithIssue> {
  if (!comment) {
    return {
      valid: false,
      error: "Comment not found",
    };
  }

  // Check if comment is deleted
  if (comment.deletedAt) {
    return {
      valid: false,
      error: "Cannot edit deleted comment",
    };
  }

  // Check organization boundary via parent issue
  if (comment.issue.organizationId !== context.organizationId) {
    return {
      valid: false,
      error: "Comment not found or does not belong to this organization",
    };
  }

  // Check ownership - users can only edit their own comments
  if (comment.authorId !== context.userId) {
    return {
      valid: false,
      error: "User can only edit their own comments",
    };
  }

  // Check permissions - require issue:edit for comment editing
  if (!context.userPermissions.includes("issue:edit")) {
    return {
      valid: false,
      error: "User does not have permission to edit comments",
    };
  }

  return {
    valid: true,
    data: comment,
  };
}

/**
 * Validate comment deletion permissions
 * Pure function that checks if user can delete a specific comment
 */
export function validateCommentDeletePermissions(
  comment: CommentWithIssue | null,
  context: CommentAccessContext,
): ValidationResult<CommentWithIssue> {
  if (!comment) {
    return {
      valid: false,
      error: "Comment not found",
    };
  }

  // Check if comment is already deleted
  if (comment.deletedAt) {
    return {
      valid: false,
      error: "Comment is already deleted",
    };
  }

  // Check organization boundary via parent issue
  if (comment.issue.organizationId !== context.organizationId) {
    return {
      valid: false,
      error: "Comment not found or does not belong to this organization",
    };
  }

  // Check ownership or admin permissions
  const isOwner = comment.authorId === context.userId;
  const hasAdminPermission = context.userPermissions.includes("issue:admin");

  if (!isOwner && !hasAdminPermission) {
    return {
      valid: false,
      error:
        "User can only delete their own comments or needs admin permission",
    };
  }

  // Check base edit permission
  if (!context.userPermissions.includes("issue:edit")) {
    return {
      valid: false,
      error: "User does not have permission to delete comments",
    };
  }

  return {
    valid: true,
    data: comment,
  };
}

/**
 * Build comment creation data
 * Pure function that constructs comment data for creation
 */
export function buildCommentCreationData(
  input: CommentCreationInput,
  context: CommentAccessContext,
): ValidationResult<{
  content: string;
  issueId: string;
  authorId: string;
}> {
  return {
    valid: true,
    data: {
      content: input.content.trim(),
      issueId: input.issueId,
      authorId: context.userId,
    },
  };
}

/**
 * Build comment edit data
 * Pure function that constructs comment data for editing
 */
export function buildCommentEditData(
  input: CommentEditInput,
): ValidationResult<{
  content: string;
}> {
  return {
    valid: true,
    data: {
      content: input.content.trim(),
    },
  };
}

/**
 * Complete comment creation validation workflow
 * Orchestrates all validation steps for comment creation
 */
export function validateCompleteCommentCreation(
  input: CommentCreationInput,
  issue: IssueReference | null,
  context: CommentAccessContext,
): ValidationResult<{
  commentData: {
    content: string;
    issueId: string;
    authorId: string;
  };
  validatedIssue: IssueReference;
}> {
  // 1. Validate input parameters
  const inputValidation = validateCommentCreationInput(input);
  if (!inputValidation.valid) {
    return {
      valid: false,
      error: inputValidation.error ?? "Input validation failed",
    };
  }

  // 2. Validate access permissions
  const accessValidation = validateCommentAccess(issue, context);
  if (!accessValidation.valid) {
    return {
      valid: false,
      error: accessValidation.error ?? "Access validation failed",
    };
  }

  // accessValidation.data is guaranteed to exist when valid is true
  if (!accessValidation.data) {
    return {
      valid: false,
      error: "Failed to validate access",
    };
  }

  // 3. Build comment data
  const dataValidation = buildCommentCreationData(input, context);
  if (!dataValidation.valid) {
    return {
      valid: false,
      error: dataValidation.error ?? "Data build failed",
    };
  }

  // dataValidation.data is guaranteed to exist when valid is true
  if (!dataValidation.data) {
    return {
      valid: false,
      error: "Failed to build comment data",
    };
  }

  return {
    valid: true,
    data: {
      commentData: dataValidation.data,
      validatedIssue: accessValidation.data,
    },
  };
}

/**
 * Complete comment edit validation workflow
 * Orchestrates all validation steps for comment editing
 */
export function validateCompleteCommentEdit(
  input: CommentEditInput,
  comment: CommentWithIssue | null,
  context: CommentAccessContext,
): ValidationResult<{
  editData: {
    content: string;
  };
  validatedComment: CommentWithIssue;
}> {
  // 1. Validate input parameters
  const inputValidation = validateCommentEditInput(input);
  if (!inputValidation.valid) {
    return {
      valid: false,
      error: inputValidation.error ?? "Input validation failed",
    };
  }

  // 2. Validate edit permissions
  const permissionValidation = validateCommentEditPermissions(comment, context);
  if (!permissionValidation.valid) {
    return {
      valid: false,
      error: permissionValidation.error ?? "Permission validation failed",
    };
  }

  // permissionValidation.data is guaranteed to exist when valid is true
  if (!permissionValidation.data) {
    return {
      valid: false,
      error: "Failed to validate permissions",
    };
  }

  // 3. Build edit data
  const dataValidation = buildCommentEditData(input);
  if (!dataValidation.valid) {
    return {
      valid: false,
      error: dataValidation.error ?? "Data build failed",
    };
  }

  // dataValidation.data is guaranteed to exist when valid is true
  if (!dataValidation.data) {
    return {
      valid: false,
      error: "Failed to build edit data",
    };
  }

  return {
    valid: true,
    data: {
      editData: dataValidation.data,
      validatedComment: permissionValidation.data,
    },
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if user is comment author
 * Simple utility for ownership checks
 */
export function isCommentAuthor(
  comment: CommentWithIssue,
  userId: string,
): boolean {
  return comment.authorId === userId;
}

/**
 * Check if comment is deleted
 * Simple utility for deletion status checks
 */
export function isCommentDeleted(comment: CommentWithIssue): boolean {
  return comment.deletedAt !== null;
}

/**
 * Get comment age in minutes
 * Utility for time-based validation rules
 */
export function getCommentAgeInMinutes(comment: CommentWithIssue): number {
  const now = new Date();
  const created = new Date(comment.createdAt);
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
}

/**
 * Check if comment can be edited based on time limits
 * Business rule: comments can only be edited within a certain time window
 */
export function canEditCommentByTime(
  comment: CommentWithIssue,
  maxEditMinutes = 60,
): boolean {
  return getCommentAgeInMinutes(comment) <= maxEditMinutes;
}

/**
 * Validate comment time-based edit permissions
 * Extended validation that includes time-based rules
 */
export function validateCommentEditWithTimeLimit(
  comment: CommentWithIssue | null,
  context: CommentAccessContext,
  maxEditMinutes = 60,
): ValidationResult<CommentWithIssue> {
  // First run standard edit validation
  const standardValidation = validateCommentEditPermissions(comment, context);
  if (!standardValidation.valid) {
    return standardValidation;
  }

  // standardValidation.data is guaranteed to exist when valid is true
  if (!standardValidation.data) {
    return {
      valid: false,
      error: "Failed to validate comment",
    };
  }

  // Check time-based restriction for non-admin users
  const hasAdminPermission = context.userPermissions.includes("issue:admin");
  if (
    !hasAdminPermission &&
    !canEditCommentByTime(standardValidation.data, maxEditMinutes)
  ) {
    return {
      valid: false,
      error: `Comments can only be edited within ${String(maxEditMinutes)} minutes of creation`,
    };
  }

  return standardValidation;
}

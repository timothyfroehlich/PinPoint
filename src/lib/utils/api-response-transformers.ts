/**
 * API Response Transformation Utilities
 *
 * This module provides specialized transformation utilities for API responses,
 * converting database snake_case results to camelCase for TypeScript interfaces.
 *
 * @module api-response-transformers
 */

import {
  transformKeysToCamelCase,
  transformKeysToSnakeCase,
} from "./case-transformers";

// Import centralized types instead of defining them locally
import type {
  IssueResponse,
  IssueWithRelationsResponse,
  CommentWithAuthorResponse,
  AttachmentResponse,
} from "~/lib/types/api";

// Remove duplicate type definitions - using centralized types instead
// IssueWithRelations is now IssueWithRelationsResponse from ~/lib/types/api

// Legacy alias for backwards compatibility
export type IssueWithRelations = IssueWithRelationsResponse;
export type CommentResponse = CommentWithAuthorResponse;

/**
 * Transforms an issue object from database snake_case to API camelCase
 *
 * @param issue - Raw issue object from database
 * @returns Transformed issue object with camelCase properties
 *
 * @example
 * ```typescript
 * const dbIssue = { created_at: new Date(), machine_id: '123' };
 * const apiIssue = transformIssueResponse(dbIssue);
 * // Result: { createdAt: Date, machineId: '123' }
 * ```
 */
export function transformIssueResponse(
  issue: Record<string, unknown>,
): IssueResponse {
  const transformed = transformKeysToCamelCase(issue) as IssueResponse;

  // Preserve Date objects during transformation (access snake_case properties safely)
  if (issue["created_at"] instanceof Date) {
    transformed.createdAt = issue["created_at"];
  }
  if (issue["updated_at"] instanceof Date) {
    transformed.updatedAt = issue["updated_at"];
  }
  if (issue["resolved_at"] instanceof Date) {
    transformed.resolvedAt = issue["resolved_at"];
  }

  return transformed;
}

/**
 * Transforms a comment object from database snake_case to API camelCase
 *
 * @param comment - Raw comment object from database
 * @returns Transformed comment object with camelCase properties
 */
export function transformCommentResponse(
  comment: Record<string, unknown>,
): CommentWithAuthorResponse {
  return transformKeysToCamelCase(comment) as CommentWithAuthorResponse;
}

/**
 * Transforms an attachment object from database snake_case to API camelCase
 *
 * @param attachment - Raw attachment object from database
 * @returns Transformed attachment object with camelCase properties
 */
export function transformAttachmentResponse(
  attachment: Record<string, unknown>,
): AttachmentResponse {
  const transformed = transformKeysToCamelCase(
    attachment,
  ) as AttachmentResponse;

  if (attachment["created_at"] instanceof Date) {
    transformed.createdAt = attachment["created_at"];
  }

  return transformed;
}

/**
 * Transforms an array of issue objects from database snake_case to API camelCase
 *
 * @param issues - Array of raw issue objects from database
 * @returns Array of transformed issue objects with camelCase properties
 */
export function transformIssuesResponse(
  issues: Record<string, unknown>[],
): IssueResponse[] {
  if (!Array.isArray(issues)) return [];
  return issues.map((issue) => transformIssueResponse(issue));
}

/**
 * Transforms an array of comment objects from database snake_case to API camelCase
 *
 * @param comments - Array of raw comment objects from database
 * @returns Array of transformed comment objects with camelCase properties
 */
export function transformCommentsResponse(
  comments: Record<string, unknown>[],
): CommentWithAuthorResponse[] {
  if (!Array.isArray(comments)) return [];
  return comments.map((comment) => transformCommentResponse(comment));
}

/**
 * Transforms an array of attachment objects from database snake_case to API camelCase
 *
 * @param attachments - Array of raw attachment objects from database
 * @returns Array of transformed attachment objects with camelCase properties
 */
export function transformAttachmentsResponse(
  attachments: Record<string, unknown>[],
): AttachmentResponse[] {
  if (!Array.isArray(attachments)) return [];
  return attachments.map((attachment) =>
    transformAttachmentResponse(attachment),
  );
}

/**
 * Transforms an issue with nested relations from database snake_case to API camelCase
 * Handles complex nested objects like machine->location->model relations
 *
 * @param issueWithRelations - Raw issue object with relations from database
 * @returns Transformed issue object with camelCase properties and relations
 */
export function transformIssueWithRelationsResponse(
  issueWithRelations: Record<string, unknown>,
): IssueWithRelationsResponse {
  // Use the simple generic transformer - DrizzleToCamelCase handles all the nested relations correctly
  return transformKeysToCamelCase(
    issueWithRelations,
  ) as IssueWithRelationsResponse;
}

/**
 * Transforms a comment with author relation from database snake_case to API camelCase
 *
 * @param commentWithAuthor - Raw comment object with author relation from database
 * @returns Transformed comment object with camelCase properties and author relation
 */
export function transformCommentWithAuthorResponse(
  commentWithAuthor: Record<string, unknown>,
): CommentWithAuthorResponse {
  // Use the simple generic transformer - DrizzleToCamelCase handles the author relation correctly
  return transformKeysToCamelCase(
    commentWithAuthor,
  ) as CommentWithAuthorResponse;
}

/**
 * Transforms database insert/update data from camelCase input to snake_case for database operations
 *
 * @param data - Input data in camelCase format
 * @returns Transformed data in snake_case format for database operations
 */
export function transformForDatabaseInsert(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const tmp: unknown = transformKeysToSnakeCase(data);
  return tmp as Record<string, unknown>;
}

/**
 * Helper function to handle null/undefined relations safely
 *
 * @param relation - Relation object that might be null or undefined
 * @param transformer - Transformation function to apply if relation exists
 * @returns Transformed relation or null/undefined
 */
export function safeTransformRelation<T>(
  relation: Record<string, unknown> | null | undefined,
  transformer: (obj: Record<string, unknown>) => T,
): T | null | undefined {
  if (relation === null) return null;
  if (relation === undefined) return undefined;

  try {
    return transformer(relation);
  } catch (error) {
    console.warn("Failed to transform relation:", error);
    return null;
  }
}

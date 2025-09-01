/**
 * Comments Data Access Layer
 * Direct database queries for Server Components with React 19 cache() optimization
 */

import { cache } from "react";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { comments } from "~/server/db/schema";
// No direct db access; use ensureOrgContextAndBindRLS to run under RLS-bound tx
import { ensureOrgContextAndBindRLS } from "~/lib/organization-context";

/**
 * Get comments for a specific issue with author details
 * Includes proper organization scoping and excludes soft-deleted comments
 * Uses React 19 cache() for request-level memoization
 */
export const getCommentsForIssue = cache(async (issueId: string) => {
  return ensureOrgContextAndBindRLS(async (tx, context) => {
    const organizationId = context.organization.id;

    return await tx.query.comments.findMany({
      where: and(
        eq(comments.issue_id, issueId),
        eq(comments.organization_id, organizationId),
        isNull(comments.deleted_at), // Exclude soft-deleted comments
      ),
      with: {
        author: {
          columns: {
            id: true,
            name: true,
            email: true,
            profile_picture: true,
          },
        },
      },
      orderBy: [desc(comments.created_at)],
    });
  });
});

/**
 * Get a single comment by ID with organization scoping
 * Returns null if comment doesn't exist or user doesn't have access
 */
export const getCommentById = cache(async (commentId: string) => {
  return ensureOrgContextAndBindRLS(async (tx, context) => {
    const organizationId = context.organization.id;

    return await tx.query.comments.findFirst({
      where: and(
        eq(comments.id, commentId),
        eq(comments.organization_id, organizationId),
        isNull(comments.deleted_at), // Exclude soft-deleted comments
      ),
      with: {
        author: {
          columns: {
            id: true,
            name: true,
            email: true,
            profile_picture: true,
          },
        },
        issue: {
          columns: {
            id: true,
            title: true,
            organization_id: true,
          },
        },
      },
    });
  });
});

/**
 * Get recent comments for the organization (for activity feeds)
 * Limited to prevent performance issues
 */
export const getRecentCommentsForOrg = cache(async (limit = 10) => {
  return ensureOrgContextAndBindRLS(async (tx, context) => {
    const organizationId = context.organization.id;

    return await tx.query.comments.findMany({
      where: and(
        eq(comments.organization_id, organizationId),
        isNull(comments.deleted_at),
      ),
      with: {
        author: {
          columns: {
            id: true,
            name: true,
            email: true,
            profile_picture: true,
          },
        },
        issue: {
          columns: {
            id: true,
            title: true,
          },
          with: {
            machine: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [desc(comments.created_at)],
      limit,
    });
  });
});

/**
 * Check if user can access a comment (for permissions)
 * Used before allowing edit/delete operations
 */
export const canUserAccessComment = cache(
  async (commentId: string, userId: string) => {
    return ensureOrgContextAndBindRLS(async (tx, context) => {
      const organizationId = context.organization.id;
      const comment = await tx.query.comments.findFirst({
        where: and(
          eq(comments.id, commentId),
          eq(comments.organization_id, organizationId),
          isNull(comments.deleted_at),
        ),
        columns: {
          id: true,
          author_id: true,
        },
      });
      return comment !== undefined && comment.author_id === userId;
    });
  },
);

/**
 * Get comment count for an issue (for display purposes)
 */
export const getCommentCountForIssue = cache(async (issueId: string) => {
  return ensureOrgContextAndBindRLS(async (tx, context) => {
    const organizationId = context.organization.id;
    const result = await tx
      .select({ count: sql<number>`count(*)` })
      .from(comments)
      .where(
        and(
          eq(comments.issue_id, issueId),
          eq(comments.organization_id, organizationId),
          isNull(comments.deleted_at),
        ),
      );
    return result[0]?.count ?? 0;
  });
});

/**
 * Type definitions for comment data
 */
export type CommentWithAuthor = Awaited<
  ReturnType<typeof getCommentsForIssue>
>[0];

export type CommentWithDetails = Awaited<ReturnType<typeof getCommentById>>;

export type RecentComment = Awaited<
  ReturnType<typeof getRecentCommentsForOrg>
>[0];

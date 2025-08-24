import { eq, and, isNull } from "drizzle-orm";

import { type DrizzleClient } from "../db/drizzle";
import type { activityTypeEnum } from "../db/schema";
import { issues, issueHistory, comments } from "../db/schema";

import { generatePrefixedId } from "~/lib/utils/id-generation";

// Import ActivityType from schema enum
type ActivityType = (typeof activityTypeEnum.enumValues)[number];

// Constants for ActivityType enum values
const ActivityType = {
  CREATED: "CREATED" as const,
  STATUS_CHANGED: "STATUS_CHANGED" as const,
  ASSIGNED: "ASSIGNED" as const,
  PRIORITY_CHANGED: "PRIORITY_CHANGED" as const,
  COMMENTED: "COMMENTED" as const,
  COMMENT_DELETED: "COMMENT_DELETED" as const,
  ATTACHMENT_ADDED: "ATTACHMENT_ADDED" as const,
  MERGED: "MERGED" as const,
  RESOLVED: "RESOLVED" as const,
  REOPENED: "REOPENED" as const,
  SYSTEM: "SYSTEM" as const,
} as const;

export interface ActivityData {
  type: ActivityType;
  actorId?: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  description?: string;
}

// IssueStatus interface for backward compatibility
export interface IssueStatus {
  name: string;
}

/**
 * Service for recording and retrieving issue activity.
 *
 * RLS Context: All database operations are automatically scoped to the user's
 * organization via RLS policies. Issue activities inherit organizational scope
 * through their associated issues.
 */
export class IssueActivityService {
  constructor(private db: DrizzleClient) {}

  /**
   * Records a general activity for an issue.
   * RLS handles organizational scoping in queries. For inserts, organizationId
   * is derived from the associated issue via database query.
   */
  async recordActivity(
    issueId: string,
    activityData: ActivityData,
  ): Promise<void> {
    // Get the issue to obtain organizationId (RLS ensures we only get issues from our org)
    const issue = await this.db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: { organization_id: true },
    });

    if (!issue) {
      throw new Error("Issue not found or access denied");
    }

    // Build data object with conditional assignment for exactOptionalPropertyTypes compatibility
    const data: {
      id: string;
      issue_id: string;
      organization_id: string;
      type: ActivityType;
      field: string;
      actor_id?: string;
      old_value?: string;
      new_value?: string;
    } = {
      id: generatePrefixedId("history"),
      issue_id: issueId,
      organization_id: issue.organization_id,
      type: activityData.type,
      field: activityData.fieldName ?? "",
    };

    // Use conditional assignment for optional properties to avoid undefined assignments
    if (activityData.actorId) {
      data.actor_id = activityData.actorId;
    }
    if (activityData.oldValue) {
      data.old_value = activityData.oldValue;
    }
    if (activityData.newValue) {
      data.new_value = activityData.newValue;
    }

    await this.db.insert(issueHistory).values(data);
  }

  /**
   * Records an issue creation activity.
   * RLS automatically handles organizational scoping.
   */
  async recordIssueCreated(issueId: string, actorId: string): Promise<void> {
    await this.recordActivity(issueId, {
      type: ActivityType.CREATED,
      actorId,
      fieldName: "status",
      newValue: "created",
    });
  }

  /**
   * Records a status change activity.
   * RLS automatically handles organizational scoping.
   */
  async recordStatusChange(
    issueId: string,
    actorId: string,
    oldStatus: IssueStatus,
    newStatus: IssueStatus,
  ): Promise<void> {
    await this.recordActivity(issueId, {
      type: ActivityType.STATUS_CHANGED,
      actorId,
      fieldName: "status",
      oldValue: oldStatus.name,
      newValue: newStatus.name,
    });
  }

  /**
   * Records an assignment change activity.
   * RLS automatically handles organizational scoping.
   */
  async recordAssignmentChange(
    issueId: string,
    actorId: string,
    oldAssignee: { name?: string | null } | null,
    newAssignee: { name?: string | null } | null,
  ): Promise<void> {
    const activityData: ActivityData = {
      type: ActivityType.ASSIGNED,
      actorId,
      fieldName: "assignee",
    };

    // Use conditional assignment for exactOptionalPropertyTypes compatibility
    if (oldAssignee?.name) {
      activityData.oldValue = oldAssignee.name;
    }
    if (newAssignee?.name) {
      activityData.newValue = newAssignee.name;
    }

    await this.recordActivity(issueId, activityData);
  }

  /**
   * Records a general field update activity.
   * RLS automatically handles organizational scoping.
   */
  async recordFieldUpdate(
    issueId: string,
    actorId: string,
    fieldName: string,
    oldValue: string,
    newValue: string,
  ): Promise<void> {
    await this.recordActivity(issueId, {
      type: ActivityType.SYSTEM,
      actorId,
      fieldName,
      oldValue,
      newValue,
    });
  }

  /**
   * Records an issue resolution activity.
   * RLS automatically handles organizational scoping.
   */
  async recordIssueResolved(issueId: string, actorId: string): Promise<void> {
    await this.recordActivity(issueId, {
      type: ActivityType.RESOLVED,
      actorId,
      fieldName: "status",
      newValue: "resolved",
    });
  }

  /**
   * Records an issue assignment activity.
   * RLS automatically handles organizational scoping.
   */
  async recordIssueAssigned(
    issueId: string,
    actorId: string,
    assigneeId: string,
  ): Promise<void> {
    await this.recordActivity(issueId, {
      type: ActivityType.ASSIGNED,
      actorId,
      fieldName: "assignee",
      newValue: assigneeId,
    });
  }

  /**
   * Records a comment deletion activity.
   * RLS automatically handles organizational scoping.
   */
  async recordCommentDeleted(
    issueId: string,
    actorId: string,
    commentId: string,
  ): Promise<void> {
    await this.recordActivity(issueId, {
      type: ActivityType.COMMENT_DELETED,
      actorId,
      fieldName: "comment",
      oldValue: commentId,
      description: "Comment deleted",
    });
  }

  /**
   * Gets the complete timeline (activities + comments) for an issue.
   * RLS automatically scopes results to the user's organization.
   *
   * @param issueId - The issue ID to get timeline for
   * @returns Merged timeline of activities and comments, sorted chronologically
   */
  async getIssueTimeline(issueId: string): Promise<
    (
      | {
          itemType: "comment";
          timestamp: Date;
          id: string;
          content: string;
          createdAt: Date;
          author: {
            id: string;
            name: string | null;
            profilePicture: string | null;
          };
        }
      | {
          itemType: "activity";
          timestamp: Date;
          id: string;
          type: ActivityType;
          field: string;
          oldValue: string | null;
          newValue: string | null;
          changedAt: Date;
          actor: {
            id: string;
            name: string | null;
            profilePicture: string | null;
          } | null;
        }
    )[]
  > {
    interface CommentResult {
      id: string;
      content: string;
      created_at: Date;
      author: {
        id: string;
        name: string | null;
        profile_picture: string | null;
      };
    }

    interface ActivityResult {
      id: string;
      type: ActivityType;
      field: string;
      old_value: string | null;
      new_value: string | null;
      changed_at: Date;
      actor: {
        id: string;
        name: string | null;
        profile_picture: string | null;
      } | null;
    }

    // Use Drizzle relational queries to fetch comments and activities
    const [commentsData, activitiesData] = await Promise.all([
      // Fetch comments with author relations (exclude soft-deleted)
      this.db.query.comments.findMany({
        where: and(eq(comments.issue_id, issueId), isNull(comments.deleted_at)),
        columns: {
          id: true,
          content: true,
          created_at: true,
        },
        with: {
          author: {
            columns: {
              id: true,
              name: true,
              profile_picture: true,
            },
          },
        },
        orderBy: [comments.created_at],
      }),
      // Fetch issue history with actor relations (RLS scoped)
      this.db.query.issueHistory.findMany({
        where: eq(issueHistory.issue_id, issueId),
        columns: {
          id: true,
          type: true,
          field: true,
          old_value: true,
          new_value: true,
          changed_at: true,
        },
        with: {
          actor: {
            columns: {
              id: true,
              name: true,
              profile_picture: true,
            },
          },
        },
        orderBy: [issueHistory.changed_at],
      }),
    ]);

    // Type-safe assignment based on the schema structure
    const commentsResults: CommentResult[] = commentsData;
    const activitiesResults: ActivityResult[] = activitiesData;

    // Merge comments and activities into a single timeline
    const timeline = [
      ...commentsResults.map((comment) => ({
        ...comment,
        itemType: "comment" as const,
        timestamp: comment.created_at,
      })),
      ...activitiesResults.map((activity) => ({
        ...activity,
        itemType: "activity" as const,
        timestamp: activity.changed_at,
      })),
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return timeline;
  }
}

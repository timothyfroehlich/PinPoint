import { eq, and, isNull } from "drizzle-orm";

import { type DrizzleClient } from "../db/drizzle";
import type { activityTypeEnum } from "../db/schema";
import { issueHistory, comments } from "../db/schema";

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

export class IssueActivityService {
  constructor(private db: DrizzleClient) {}

  async recordActivity(
    issueId: string,
    organizationId: string,
    activityData: ActivityData,
  ): Promise<void> {
    // Build data object with conditional assignment for exactOptionalPropertyTypes compatibility
    const data: {
      id: string;
      issueId: string;
      organizationId: string;
      type: ActivityType;
      field: string;
      actorId?: string;
      oldValue?: string;
      newValue?: string;
    } = {
      id: generatePrefixedId("history"),
      issueId,
      organizationId,
      type: activityData.type,
      field: activityData.fieldName ?? "",
    };

    // Use conditional assignment for optional properties to avoid undefined assignments
    if (activityData.actorId) {
      data.actorId = activityData.actorId;
    }
    if (activityData.oldValue) {
      data.oldValue = activityData.oldValue;
    }
    if (activityData.newValue) {
      data.newValue = activityData.newValue;
    }

    await this.db.insert(issueHistory).values(data);
  }

  async recordIssueCreated(
    issueId: string,
    organizationId: string,
    actorId: string,
  ): Promise<void> {
    await this.recordActivity(issueId, organizationId, {
      type: ActivityType.CREATED,
      actorId,
      fieldName: "status",
      newValue: "created",
    });
  }

  async recordStatusChange(
    issueId: string,
    organizationId: string,
    actorId: string,
    oldStatus: IssueStatus,
    newStatus: IssueStatus,
  ): Promise<void> {
    await this.recordActivity(issueId, organizationId, {
      type: ActivityType.STATUS_CHANGED,
      actorId,
      fieldName: "status",
      oldValue: oldStatus.name,
      newValue: newStatus.name,
    });
  }

  async recordAssignmentChange(
    issueId: string,
    organizationId: string,
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

    await this.recordActivity(issueId, organizationId, activityData);
  }

  async recordFieldUpdate(
    issueId: string,
    organizationId: string,
    actorId: string,
    fieldName: string,
    oldValue: string,
    newValue: string,
  ): Promise<void> {
    await this.recordActivity(issueId, organizationId, {
      type: ActivityType.SYSTEM,
      actorId,
      fieldName,
      oldValue,
      newValue,
    });
  }

  async recordIssueResolved(
    issueId: string,
    organizationId: string,
    actorId: string,
  ): Promise<void> {
    await this.recordActivity(issueId, organizationId, {
      type: ActivityType.RESOLVED,
      actorId,
      fieldName: "status",
      newValue: "resolved",
    });
  }

  async recordIssueAssigned(
    issueId: string,
    organizationId: string,
    actorId: string,
    assigneeId: string,
  ): Promise<void> {
    await this.recordActivity(issueId, organizationId, {
      type: ActivityType.ASSIGNED,
      actorId,
      fieldName: "assignee",
      newValue: assigneeId,
    });
  }

  async recordCommentDeleted(
    issueId: string,
    organizationId: string,
    actorId: string,
    commentId: string,
  ): Promise<void> {
    await this.recordActivity(issueId, organizationId, {
      type: ActivityType.COMMENT_DELETED,
      actorId,
      fieldName: "comment",
      oldValue: commentId,
      description: "Comment deleted",
    });
  }

  async getIssueTimeline(
    issueId: string,
    organizationId: string,
  ): Promise<
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
      createdAt: Date;
      author: {
        id: string;
        name: string | null;
        profilePicture: string | null;
      };
    }

    interface ActivityResult {
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

    // Use Drizzle relational queries to fetch comments and activities
    const [commentsData, activitiesData] = await Promise.all([
      // Fetch comments with author relations (exclude soft-deleted)
      this.db.query.comments.findMany({
        where: and(eq(comments.issueId, issueId), isNull(comments.deletedAt)),
        columns: {
          id: true,
          content: true,
          createdAt: true,
        },
        with: {
          author: {
            columns: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
        },
        orderBy: [comments.createdAt],
      }),
      // Fetch issue history with actor relations (organization scoped)
      this.db.query.issueHistory.findMany({
        where: and(
          eq(issueHistory.issueId, issueId),
          eq(issueHistory.organizationId, organizationId),
        ),
        columns: {
          id: true,
          type: true,
          field: true,
          oldValue: true,
          newValue: true,
          changedAt: true,
        },
        with: {
          actor: {
            columns: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
        },
        orderBy: [issueHistory.changedAt],
      }),
    ]);

    // Type-safe cast based on the schema structure
    const commentsResults: CommentResult[] = commentsData as CommentResult[];
    const activitiesResults: ActivityResult[] =
      activitiesData as ActivityResult[];

    // Merge comments and activities into a single timeline
    const timeline = [
      ...commentsResults.map((comment) => ({
        ...comment,
        itemType: "comment" as const,
        timestamp: comment.createdAt,
      })),
      ...activitiesResults.map((activity) => ({
        ...activity,
        itemType: "activity" as const,
        timestamp: activity.changedAt,
      })),
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return timeline;
  }
}

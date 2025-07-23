import { ActivityType } from "./types";
import { type IssueStatus, type ExtendedPrismaClient } from "./types";

export interface ActivityData {
  type: ActivityType; // Use enum instead of string
  actorId?: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  description?: string;
}

export class IssueActivityService {
  constructor(private prisma: ExtendedPrismaClient) {}

  async recordActivity(
    issueId: string,
    organizationId: string,
    activityData: ActivityData,
  ): Promise<void> {
    // Build data object with conditional assignment for exactOptionalPropertyTypes compatibility
    const data: {
      issueId: string;
      organizationId: string;
      type: ActivityType;
      field: string;
      actorId?: string;
      oldValue?: string;
      newValue?: string;
    } = {
      issueId,
      organizationId, // Now properly supported
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

    await this.prisma.issueHistory.create({ data });
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

    const [comments, activities] = await Promise.all([
      this.prisma.comment.findMany({
        where: {
          issueId,
          deletedAt: null, // Exclude soft-deleted comments
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }) as Promise<CommentResult[]>,
      this.prisma.issueHistory.findMany({
        where: { issueId, organizationId },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
        },
        orderBy: { changedAt: "asc" },
      }) as Promise<ActivityResult[]>,
    ]);

    // Merge comments and activities into a single timeline
    const timeline = [
      ...comments.map((comment) => ({
        ...comment,
        itemType: "comment" as const,
        timestamp: comment.createdAt,
      })),
      ...activities.map((activity) => ({
        ...activity,
        itemType: "activity" as const,
        timestamp: activity.changedAt,
      })),
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return timeline;
  }
}

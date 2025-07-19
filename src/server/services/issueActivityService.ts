import { ActivityType } from "@prisma/client";
import { type User, type IssueStatus } from "@prisma/client";

import type { ExtendedPrismaClient } from "~/server/db";

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
    await this.prisma.issueHistory.create({
      data: {
        issueId,
        organizationId, // Now properly supported
        type: activityData.type,
        actorId: activityData.actorId,
        field: activityData.fieldName || "",
        oldValue: activityData.oldValue,
        newValue: activityData.newValue,
      },
    });
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
    oldAssignee: User | null,
    newAssignee: User | null,
  ): Promise<void> {
    let _description: string;
    if (oldAssignee && newAssignee) {
      _description = `Reassigned from ${oldAssignee.name} to ${newAssignee.name}`;
    } else if (newAssignee) {
      _description = `Assigned to ${newAssignee.name}`;
    } else if (oldAssignee) {
      _description = `Unassigned from ${oldAssignee.name}`;
    } else {
      _description = "Assignment changed";
    }

    await this.recordActivity(issueId, organizationId, {
      type: ActivityType.ASSIGNED,
      actorId,
      fieldName: "assignee",
      oldValue: oldAssignee?.name ?? undefined,
      newValue: newAssignee?.name ?? undefined,
    });
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

  async getIssueTimeline(issueId: string, organizationId: string) {
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
      }),
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
      }),
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

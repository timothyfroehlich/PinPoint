import { type PrismaClient, ActivityType } from "@prisma/client";
import { type User, type IssueStatus } from "@prisma/client";

export interface ActivityData {
  type: ActivityType; // Use enum instead of string
  actorId?: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  description?: string;
}

export class IssueActivityService {
  constructor(private prisma: PrismaClient) {}

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
    let description: string;
    if (oldAssignee && newAssignee) {
      description = `Reassigned from ${oldAssignee.name} to ${newAssignee.name}`;
    } else if (newAssignee) {
      description = `Assigned to ${newAssignee.name}`;
    } else if (oldAssignee) {
      description = `Unassigned from ${oldAssignee.name}`;
    } else {
      description = "Assignment changed";
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

  async recordCommentDeletion(
    issueId: string,
    organizationId: string,
    actorId: string,
    isAdminDelete: boolean,
  ): Promise<void> {
    await this.recordActivity(issueId, organizationId, {
      type: ActivityType.SYSTEM,
      actorId,
      fieldName: "comment",
    });
  }

  async getIssueTimeline(issueId: string, organizationId: string) {
    const [comments, activities] = await Promise.all([
      this.prisma.comment.findMany({
        where: {
          issueId,
          // TODO: Comment model doesn't have deletedAt field in new schema
          // Need to implement soft delete differently
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

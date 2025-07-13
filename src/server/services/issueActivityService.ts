import { type PrismaClient } from "@prisma/client";
import { type User, type IssueStatus } from "@prisma/client";

export interface ActivityData {
  type: string; // TODO: Define proper activity types for new schema
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
        organizationId,
        ...activityData,
      },
    });
  }

  async recordIssueCreated(
    issueId: string,
    organizationId: string,
    actorId: string,
  ): Promise<void> {
    await this.recordActivity(issueId, organizationId, {
      type: "created",
      actorId,
      description: "Issue created",
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
      type: "status_change",
      actorId,
      fieldName: "status",
      oldValue: oldStatus.name,
      newValue: newStatus.name,
      description: `Status changed from "${oldStatus.name}" to "${newStatus.name}"`,
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
      type: "assignment",
      actorId,
      fieldName: "assignee",
      oldValue: oldAssignee?.name ?? undefined,
      newValue: newAssignee?.name ?? undefined,
      description,
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
      type: "field_update",
      actorId,
      fieldName,
      oldValue,
      newValue,
      description: `Updated ${fieldName} from "${oldValue}" to "${newValue}"`,
    });
  }

  async recordCommentDeletion(
    issueId: string,
    organizationId: string,
    actorId: string,
    isAdminDelete: boolean,
  ): Promise<void> {
    const description = isAdminDelete
      ? "Comment deleted by admin"
      : "Comment deleted";

    await this.recordActivity(issueId, organizationId, {
      type: "field_update",
      actorId,
      fieldName: "comment",
      description,
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
        orderBy: { createdAt: "asc" },
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
        timestamp: activity.createdAt,
      })),
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return timeline;
  }
}

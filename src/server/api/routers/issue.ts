import { IssueStatusCategory } from "@prisma/client";
import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { CommentCleanupService } from "~/server/services/commentCleanupService";
import { IssueActivityService } from "~/server/services/issueActivityService";

export const issueRouter = createTRPCRouter({
  // Public submission - anyone can report an issue
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        severity: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
        reporterEmail: z.string().email().optional(),
        gameInstanceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Use the organization resolved from subdomain context
      const organization = ctx.organization;

      // Verify that the game instance belongs to the organization
      const gameInstance = await ctx.db.gameInstance.findFirst({
        where: {
          id: input.gameInstanceId,
        },
        include: {
          room: {
            select: {
              organizationId: true,
            },
          },
        },
      });

      if (
        !gameInstance ||
        gameInstance.room.organizationId !== organization.id
      ) {
        throw new Error(
          "Game instance not found or does not belong to this organization",
        );
      }

      // Get the default "New" status for this organization
      const newStatus = await ctx.db.issueStatus.findFirst({
        where: {
          isDefault: true,
          organizationId: organization.id,
        },
      });

      if (!newStatus) {
        throw new Error(
          "Default issue status not found. Please contact an administrator.",
        );
      }

      // Determine reporter: use session user if available, otherwise use email or null
      const reporterId = ctx.session?.user?.id ?? null;
      const reporterEmail = reporterId ? null : (input.reporterEmail ?? null);

      // Create the issue
      const issue = await ctx.db.issue.create({
        data: {
          title: input.title,
          description: input.description,
          severity: input.severity,
          reporterId,
          reporterEmail,
          gameInstanceId: input.gameInstanceId,
          organizationId: organization.id,
          statusId: newStatus.id,
        },
        include: {
          status: true,
          reporter: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
          gameInstance: {
            include: {
              gameTitle: true,
              room: {
                include: {
                  location: true,
                },
              },
            },
          },
        },
      });

      // Record the issue creation activity if user is logged in
      if (reporterId) {
        const activityService = new IssueActivityService(ctx.db);
        await activityService.recordIssueCreated(
          issue.id,
          organization.id,
          reporterId,
        );
      }

      return issue;
    }),

  // Get all issues for an organization
  getAll: organizationProcedure
    .input(
      z
        .object({
          locationId: z.string().optional(),
          gameInstanceId: z.string().optional(),
          statusId: z.string().optional(),
          gameTitleId: z.string().optional(),
          statusCategory: z
            .enum([
              IssueStatusCategory.NEW,
              IssueStatusCategory.OPEN,
              IssueStatusCategory.CLOSED,
            ])
            .optional(),
          sortBy: z
            .enum(["created", "updated", "status", "severity", "game"])
            .optional(),
          sortOrder: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const whereClause: {
        organizationId: string;
        gameInstance?: {
          room?: { locationId: string };
          gameTitleId?: string;
        };
        gameInstanceId?: string;
        statusId?: string;
        status?: {
          category: IssueStatusCategory;
        };
      } = {
        organizationId: ctx.organization.id,
      };

      if (input?.locationId) {
        whereClause.gameInstance = {
          ...whereClause.gameInstance,
          room: { locationId: input.locationId },
        };
      }

      if (input?.gameInstanceId) {
        whereClause.gameInstanceId = input.gameInstanceId;
      }

      if (input?.gameTitleId) {
        whereClause.gameInstance = {
          ...whereClause.gameInstance,
          gameTitleId: input.gameTitleId,
        };
      }

      if (input?.statusId) {
        whereClause.statusId = input.statusId;
      }

      if (input?.statusCategory) {
        whereClause.status = {
          category: input.statusCategory,
        };
      }

      // Define sort order
      const sortBy = input?.sortBy ?? "created";
      const sortOrder = input?.sortOrder ?? "desc";

      const orderBy = (() => {
        switch (sortBy) {
          case "created":
            return { createdAt: sortOrder };
          case "updated":
            return { updatedAt: sortOrder };
          case "status":
            return { status: { order: sortOrder } };
          case "severity":
            return { severity: sortOrder };
          case "game":
            return { gameInstance: { gameTitle: { name: sortOrder } } };
          default:
            return { createdAt: "desc" as const };
        }
      })();

      return ctx.db.issue.findMany({
        where: whereClause,
        include: {
          status: true,
          assignee: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
          reporter: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
          gameInstance: {
            include: {
              gameTitle: true,
              room: {
                include: {
                  location: true,
                },
              },
            },
          },
          _count: {
            select: {
              comments: true,
              attachments: true,
            },
          },
        },
        orderBy,
      });
    }),

  // Get counts for each status category
  getStatusCounts: organizationProcedure.query(async ({ ctx }) => {
    const counts = await ctx.db.issue.groupBy({
      by: ["statusId"],
      where: {
        organizationId: ctx.organization.id,
      },
      _count: {
        _all: true,
      },
    });

    const statuses = await ctx.db.issueStatus.findMany({
      where: {
        organizationId: ctx.organization.id,
      },
    });

    const statusMap = new Map(statuses.map((s) => [s.id, s.category]));

    const categoryCounts = {
      [IssueStatusCategory.NEW]: 0,
      [IssueStatusCategory.OPEN]: 0,
      [IssueStatusCategory.CLOSED]: 0,
    };

    for (const group of counts) {
      const category = statusMap.get(group.statusId);
      if (category) {
        categoryCounts[category] += group._count._all;
      }
    }

    return categoryCounts;
  }),

  // Get a single issue by ID
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const issue = await ctx.db.issue.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
        include: {
          status: true,
          assignee: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
          reporter: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
          gameInstance: {
            include: {
              gameTitle: true,
              room: {
                include: {
                  location: true,
                },
              },
            },
          },
          comments: {
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
          },
          attachments: {
            orderBy: { id: "asc" },
          },
        },
      });

      if (!issue) {
        throw new Error("Issue not found");
      }

      return issue;
    }),

  // Update issue (for members/admins)
  update: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        statusId: z.string().optional(),
        assigneeId: z.string().optional(),
        showActivity: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the issue belongs to this organization
      const existingIssue = await ctx.db.issue.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
        include: {
          status: true,
          assignee: true,
        },
      });

      if (!existingIssue) {
        throw new Error("Issue not found");
      }

      const activityService = new IssueActivityService(ctx.db);
      const userId = ctx.session.user.id;

      // Prepare data for tracking changes
      let newStatus = existingIssue.status;
      let newAssignee = existingIssue.assignee;

      // If updating status, verify it belongs to the organization
      if (input.statusId) {
        const status = await ctx.db.issueStatus.findFirst({
          where: {
            id: input.statusId,
            organizationId: ctx.organization.id,
          },
        });
        if (!status) {
          throw new Error("Invalid status");
        }
        newStatus = status;
      }

      // If updating assignee, verify they are a member of this organization
      if (input.assigneeId !== undefined) {
        if (input.assigneeId) {
          const membership = await ctx.db.membership.findUnique({
            where: {
              userId_organizationId: {
                userId: input.assigneeId,
                organizationId: ctx.organization.id,
              },
            },
            include: {
              user: true,
            },
          });
          if (!membership) {
            throw new Error("User is not a member of this organization");
          }
          newAssignee = membership.user;
        } else {
          newAssignee = null;
        }
      }

      // Update the issue
      const updatedIssue = await ctx.db.issue.update({
        where: { id: input.id },
        data: {
          ...(input.title && { title: input.title }),
          ...(input.description !== undefined && {
            description: input.description,
          }),
          ...(input.statusId && { statusId: input.statusId }),
          ...(input.assigneeId !== undefined && {
            assigneeId: input.assigneeId || null,
          }),
          ...(input.showActivity !== undefined && {
            showActivity: input.showActivity,
          }),
        },
        include: {
          status: true,
          assignee: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
          reporter: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
          gameInstance: {
            include: {
              gameTitle: true,
              room: {
                include: {
                  location: true,
                },
              },
            },
          },
        },
      });

      // Record activities for changes
      if (input.statusId && existingIssue.status.id !== input.statusId) {
        await activityService.recordStatusChange(
          input.id,
          ctx.organization.id,
          userId,
          existingIssue.status,
          newStatus,
        );
      }

      if (
        input.assigneeId !== undefined &&
        existingIssue.assigneeId !== input.assigneeId
      ) {
        await activityService.recordAssignmentChange(
          input.id,
          ctx.organization.id,
          userId,
          existingIssue.assignee,
          newAssignee,
        );
      }

      if (input.title && existingIssue.title !== input.title) {
        await activityService.recordFieldUpdate(
          input.id,
          ctx.organization.id,
          userId,
          "title",
          existingIssue.title,
          input.title,
        );
      }

      if (
        input.description !== undefined &&
        existingIssue.description !== input.description
      ) {
        await activityService.recordFieldUpdate(
          input.id,
          ctx.organization.id,
          userId,
          "description",
          existingIssue.description ?? "",
          input.description ?? "",
        );
      }

      return updatedIssue;
    }),

  // Add comment to an issue (for members/admins)
  addComment: organizationProcedure
    .input(
      z.object({
        issueId: z.string(),
        content: z.string().min(1).max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the issue belongs to this organization
      const existingIssue = await ctx.db.issue.findFirst({
        where: {
          id: input.issueId,
          organizationId: ctx.organization.id,
        },
      });

      if (!existingIssue) {
        throw new Error("Issue not found");
      }

      // Verify the user is a member of this organization
      const membership = await ctx.db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.session.user.id,
            organizationId: ctx.organization.id,
          },
        },
      });

      if (!membership) {
        throw new Error("User is not a member of this organization");
      }

      const comment = await ctx.db.comment.create({
        data: {
          content: input.content,
          issueId: input.issueId,
          authorId: ctx.session.user.id,
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
      });

      return comment;
    }),

  // Edit comment (users can only edit their own comments)
  editComment: organizationProcedure
    .input(
      z.object({
        commentId: z.string(),
        content: z.string().min(1).max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Find the comment and verify permissions
      const comment = await ctx.db.comment.findFirst({
        where: {
          id: input.commentId,
          issue: {
            organizationId: ctx.organization.id,
          },
        },
        include: {
          author: true,
          issue: true,
        },
      });

      if (!comment) {
        throw new Error("Comment not found");
      }

      if (comment.deletedAt) {
        throw new Error("Cannot edit deleted comment");
      }

      // Only the author can edit their own comment
      if (comment.authorId !== ctx.session.user.id) {
        throw new Error("You can only edit your own comments");
      }

      // Update the comment
      const updatedComment = await ctx.db.comment.update({
        where: { id: input.commentId },
        data: {
          content: input.content,
          editedAt: new Date(),
          edited: true,
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
      });

      return updatedComment;
    }),

  // Delete comment (users can delete their own, admins can delete any)
  deleteComment: organizationProcedure
    .input(
      z.object({
        commentId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Find the comment and verify permissions
      const comment = await ctx.db.comment.findFirst({
        where: {
          id: input.commentId,
          issue: {
            organizationId: ctx.organization.id,
          },
        },
        include: {
          author: true,
          issue: true,
        },
      });

      if (!comment) {
        throw new Error("Comment not found");
      }

      if (comment.deletedAt) {
        throw new Error("Comment is already deleted");
      }

      // Check permissions: user can delete their own comment, admins can delete any
      const membership = await ctx.db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.session.user.id,
            organizationId: ctx.organization.id,
          },
        },
      });

      if (!membership) {
        throw new Error("User is not a member of this organization");
      }

      const canDelete =
        comment.authorId === ctx.session.user.id || membership.role === "admin";

      if (!canDelete) {
        throw new Error("You can only delete your own comments");
      }

      // Soft delete the comment
      const deletedComment = await ctx.db.comment.update({
        where: { id: input.commentId },
        data: {
          deletedAt: new Date(),
          deletedById: ctx.session.user.id,
        },
      });

      // Record deletion activity
      const activityService = new IssueActivityService(ctx.db);
      await activityService.recordCommentDeletion(
        comment.issue.id,
        ctx.organization.id,
        ctx.session.user.id,
        comment.authorId !== ctx.session.user.id, // isAdminDelete
      );

      return deletedComment;
    }),

  // Cleanup old deleted comments (admin only)
  cleanupDeletedComments: organizationProcedure.mutation(async ({ ctx }) => {
    // Check if user is admin
    const membership = await ctx.db.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: ctx.session.user.id,
          organizationId: ctx.organization.id,
        },
      },
    });

    if (!membership || membership.role !== "admin") {
      throw new Error("Only admins can run comment cleanup");
    }

    const cleanupService = new CommentCleanupService(ctx.db);
    const deletedCount = await cleanupService.cleanupOldDeletedComments();

    return {
      deletedCount,
      message: `Successfully deleted ${deletedCount} old comments`,
    };
  }),

  // Get issue timeline (comments + activities)
  getTimeline: organizationProcedure
    .input(z.object({ issueId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify the issue belongs to this organization
      const issue = await ctx.db.issue.findFirst({
        where: {
          id: input.issueId,
          organizationId: ctx.organization.id,
        },
        select: {
          showActivity: true,
        },
      });

      if (!issue) {
        throw new Error("Issue not found");
      }

      const activityService = new IssueActivityService(ctx.db);
      return activityService.getIssueTimeline(
        input.issueId,
        ctx.organization.id,
      );
    }),

  // Create attachment record after file upload (called by upload API)
  createAttachment: organizationProcedure
    .input(
      z.object({
        issueId: z.string(),
        url: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the issue belongs to this organization
      const existingIssue = await ctx.db.issue.findFirst({
        where: {
          id: input.issueId,
          organizationId: ctx.organization.id,
        },
      });

      if (!existingIssue) {
        throw new Error("Issue not found");
      }

      // Check attachment count limit
      const existingAttachments = await ctx.db.attachment.count({
        where: {
          issueId: input.issueId,
        },
      });

      if (existingAttachments >= 3) {
        throw new Error("Maximum of 3 attachments allowed per issue");
      }

      // Create attachment record
      return ctx.db.attachment.create({
        data: {
          url: input.url,
          issueId: input.issueId,
          organizationId: ctx.organization.id,
        },
      });
    }),

  // Delete attachment from an issue
  deleteAttachment: organizationProcedure
    .input(
      z.object({
        attachmentId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Find the attachment and verify it belongs to this organization
      const attachment = await ctx.db.attachment.findFirst({
        where: {
          id: input.attachmentId,
          organizationId: ctx.organization.id,
        },
      });

      if (!attachment) {
        throw new Error("Attachment not found");
      }

      // TODO: Add proper authorization logic
      // For now, allow organization members to delete attachments

      // Delete the file from storage
      const { imageStorage } = await import(
        "~/lib/image-storage/local-storage"
      );
      await imageStorage.deleteImage(attachment.url);

      // Delete the attachment record
      return ctx.db.attachment.delete({
        where: { id: input.attachmentId },
      });
    }),
});

import { z } from "zod";
import {
  createTRPCRouter,
  organizationProcedure,
  publicProcedure,
} from "~/server/api/trpc";

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
      // Get the hardcoded organization (for MVP)
      const organization = await ctx.db.organization.findFirst();
      if (!organization) {
        throw new Error("No organization found");
      }

      // Verify that the game instance belongs to the organization
      const gameInstance = await ctx.db.gameInstance.findFirst({
        where: {
          id: input.gameInstanceId,
          gameTitle: {
            organizationId: organization.id,
          },
        },
        include: {
          gameTitle: {
            select: {
              organizationId: true,
            },
          },
        },
      });

      if (!gameInstance) {
        throw new Error(
          "Game instance not found or does not belong to this organization",
        );
      }

      // Get the default "Open" status for this organization
      const openStatus = await ctx.db.issueStatus.findFirst({
        where: {
          name: "Open",
          organizationId: organization.id,
        },
      });

      if (!openStatus) {
        throw new Error(
          "Default issue status not found. Please contact an administrator.",
        );
      }

      // Determine reporter: use session user if available, otherwise use email or null
      const reporterId = ctx.session?.user?.id ?? null;
      const reporterEmail = reporterId ? null : (input.reporterEmail ?? null);

      return ctx.db.issue.create({
        data: {
          title: input.title,
          description: input.description,
          severity: input.severity,
          reporterId,
          reporterEmail,
          gameInstanceId: input.gameInstanceId,
          organizationId: organization.id,
          statusId: openStatus.id,
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
    }),

  // Get all issues for an organization
  getAll: organizationProcedure
    .input(
      z
        .object({
          locationId: z.string().optional(),
          gameInstanceId: z.string().optional(),
          statusId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const whereClause: {
        organizationId: string;
        gameInstance?: { room: { locationId: string } };
        gameInstanceId?: string;
        statusId?: string;
      } = {
        organizationId: ctx.organization.id,
      };

      if (input?.locationId) {
        whereClause.gameInstance = {
          room: { locationId: input.locationId },
        };
      }

      if (input?.gameInstanceId) {
        whereClause.gameInstanceId = input.gameInstanceId;
      }

      if (input?.statusId) {
        whereClause.statusId = input.statusId;
      }

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
        orderBy: { createdAt: "desc" },
      });
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
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the issue belongs to this organization
      const existingIssue = await ctx.db.issue.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
      });

      if (!existingIssue) {
        throw new Error("Issue not found");
      }

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
      }

      // If updating assignee, verify they are a member of this organization
      if (input.assigneeId) {
        const membership = await ctx.db.membership.findUnique({
          where: {
            userId_organizationId: {
              userId: input.assigneeId,
              organizationId: ctx.organization.id,
            },
          },
        });
        if (!membership) {
          throw new Error("User is not a member of this organization");
        }
      }

      return ctx.db.issue.update({
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

      return ctx.db.comment.create({
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
      const { imageStorage } = await import("~/lib/image-storage/local-storage");
      await imageStorage.deleteImage(attachment.url);

      // Delete the attachment record
      return ctx.db.attachment.delete({
        where: { id: input.attachmentId },
      });
    }),
});

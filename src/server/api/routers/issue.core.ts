import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
  publicProcedure,
  issueEditProcedure,
} from "~/server/api/trpc";
import { IssueActivityService } from "~/server/services/issueActivityService";
import { NotificationService } from "~/server/services/notificationService";

export const issueCoreRouter = createTRPCRouter({
  // Public submission - anyone can report an issue
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        severity: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
        reporterEmail: z.string().email().optional(),
        machineId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Use the organization resolved from subdomain context
      const organization = ctx.organization;

      // Verify that the game instance belongs to the organization
      const machine = await ctx.db.machine.findFirst({
        where: {
          id: input.machineId,
        },
        include: {
          room: {
            select: {
              organizationId: true,
            },
          },
        },
      });

      if (!machine || machine.room.organizationId !== organization.id) {
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
          machineId: input.machineId,
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
          machine: {
            include: {
              model: true,
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

      // Send notifications for new issue
      const notificationService = new NotificationService(ctx.db);
      await notificationService.notifyMachineOwnerOfIssue(
        issue.id,
        input.machineId,
      );

      return issue;
    }),

  // Get all issues for an organization
  getAll: organizationProcedure
    .input(
      z
        .object({
          locationId: z.string().optional(),
          machineId: z.string().optional(),
          statusId: z.string().optional(),
          modelId: z.string().optional(),
          statusCategory: z.enum(["NEW", "OPEN", "CLOSED"]).optional(),
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
        machine?: {
          room?: { locationId: string };
          modelId?: string;
        };
        machineId?: string;
        statusId?: string;
        status?: {
          category: "NEW" | "OPEN" | "CLOSED";
        };
      } = {
        organizationId: ctx.organization.id,
      };

      if (input?.locationId) {
        whereClause.machine = {
          ...whereClause.machine,
          room: { locationId: input.locationId },
        };
      }

      if (input?.machineId) {
        whereClause.machineId = input.machineId;
      }

      if (input?.modelId) {
        whereClause.machine = {
          ...whereClause.machine,
          modelId: input.modelId,
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
            return { machine: { model: { name: sortOrder } } };
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
          machine: {
            include: {
              model: true,
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
          machine: {
            include: {
              model: true,
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
  update: issueEditProcedure
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
        include: {
          status: true,
          assignee: true,
        },
      });

      if (!existingIssue) {
        throw new Error("Issue not found");
      }

      const activityService = new IssueActivityService(ctx.db);
      const notificationService = new NotificationService(ctx.db);
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
          machine: {
            include: {
              model: true,
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

        // Send status change notifications
        await notificationService.notifyMachineOwnerOfStatusChange(
          input.id,
          existingIssue.status.name,
          newStatus.name,
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

        // Send assignment notifications
        if (newAssignee) {
          await notificationService.notifyUserOfAssignment(
            input.id,
            newAssignee.id,
          );
        }
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
});

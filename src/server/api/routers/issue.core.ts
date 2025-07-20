import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
  publicProcedure,
  issueEditProcedure,
} from "~/server/api/trpc";

export const issueCoreRouter = createTRPCRouter({
  // Public submission - anyone can report an issue
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        severity: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
        reporterEmail: z.email().optional(),
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
          location: {
            select: {
              organizationId: true,
            },
          },
        },
      });

      if (!machine || machine.location.organizationId !== organization.id) {
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

      const defaultPriority = await ctx.db.priority.findFirst({
        where: {
          isDefault: true,
          organizationId: organization.id,
        },
      });

      if (!defaultPriority) {
        throw new Error(
          "Default priority not found. Please contact an administrator.",
        );
      }

      // Determine reporter: use session user if available, otherwise use email or null
      if (!ctx.session.user.id) {
        throw new Error("User not found");
      }
      const createdById = ctx.session.user.id;

      // Create the issue
      const issueData: {
        title: string;
        description?: string | null;
        createdById: string;
        machineId: string;
        organizationId: string;
        statusId: string;
        priorityId: string;
      } = {
        title: input.title,
        createdById,
        machineId: input.machineId,
        organizationId: organization.id,
        statusId: newStatus.id,
        priorityId: defaultPriority.id,
      };

      if (input.description) {
        issueData.description = input.description;
      }

      const issue = await ctx.db.issue.create({
        data: issueData,
        include: {
          status: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          machine: {
            include: {
              model: true,
              location: true,
            },
          },
        },
      });

      // Record the issue creation activity if user is logged in
      if (createdById) {
        const activityService = ctx.services.createIssueActivityService();
        await activityService.recordIssueCreated(
          issue.id,
          organization.id,
          createdById,
        );
      }

      // Send notifications for new issue
      const notificationService = ctx.services.createNotificationService();
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
          statusCategory: z.enum(["NEW", "IN_PROGRESS", "RESOLVED"]).optional(),
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
          location?: { id: string };
          modelId?: string;
        };
        machineId?: string;
        statusId?: string;
        status?: {
          category: "NEW" | "IN_PROGRESS" | "RESOLVED";
        };
      } = {
        organizationId: ctx.organization.id,
      };

      if (input?.locationId) {
        whereClause.machine = {
          ...whereClause.machine,
          location: { id: input.locationId },
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
            return { status: { name: sortOrder } };
          case "severity":
            return { priority: { order: sortOrder } };
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
          assignedTo: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          machine: {
            include: {
              model: true,
              location: true,
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
          assignedTo: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          machine: {
            include: {
              model: true,
              location: true,
            },
          },
          comments: {
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  image: true,
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
        assignedToId: z.string().optional(),
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
          assignedTo: true,
        },
      });

      if (!existingIssue) {
        throw new Error("Issue not found");
      }

      const activityService = ctx.services.createIssueActivityService();
      const notificationService = ctx.services.createNotificationService();
      const userId = ctx.session.user.id;

      // Prepare data for tracking changes
      let newStatus = existingIssue.status;
      let newAssignedTo = existingIssue.assignedTo;

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
      if (input.assignedToId !== undefined) {
        if (input.assignedToId) {
          const membership = await ctx.db.membership.findUnique({
            where: {
              userId_organizationId: {
                userId: input.assignedToId,
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
          newAssignedTo = membership.user;
        } else {
          newAssignedTo = null;
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
          ...(input.assignedToId !== undefined && {
            assignedToId: input.assignedToId ?? null,
          }),
        },
        include: {
          status: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          machine: {
            include: {
              model: true,
              location: true,
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
        input.assignedToId !== undefined &&
        existingIssue.assignedToId !== input.assignedToId
      ) {
        await activityService.recordAssignmentChange(
          input.id,
          ctx.organization.id,
          userId,
          existingIssue.assignedTo,
          newAssignedTo,
        );

        // Send assignment notifications
        if (newAssignedTo) {
          await notificationService.notifyUserOfAssignment(
            input.id,
            newAssignedTo.id,
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

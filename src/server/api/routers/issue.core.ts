import { z } from "zod";

import {
  validateIssueAssignment,
  validateIssueCreation,
  type IssueAssignmentInput,
  type IssueCreationInput,
  type AssignmentValidationContext,
} from "~/lib/issues/assignmentValidation";
import {
  validateStatusTransition,
  getStatusChangeEffects,
} from "~/lib/issues/statusValidation";
import {
  createTRPCRouter,
  organizationProcedure,
  publicProcedure,
  issueEditProcedure,
} from "~/server/api/trpc";
import {
  issueCreateProcedure,
  issueAssignProcedure,
  issueViewProcedure,
} from "~/server/api/trpc.permission";

export const issueCoreRouter = createTRPCRouter({
  // Public issue creation for anonymous users (via QR codes)
  publicCreate: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        machineId: z.string(),
        reporterEmail: z.email().optional(),
        submitterName: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Organization is guaranteed by publicProcedure middleware via subdomain
      const organization = ctx.organization;

      if (!organization) {
        throw new Error("Organization not found");
      }

      // Get machine, status, and priority for validation
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

      const defaultStatus = await ctx.db.issueStatus.findFirst({
        where: {
          isDefault: true,
          organizationId: organization.id,
        },
      });

      const defaultPriority = await ctx.db.priority.findFirst({
        where: {
          isDefault: true,
          organizationId: organization.id,
        },
      });

      // Create validation input (handle exactOptionalPropertyTypes)
      const baseValidationInput = {
        title: input.title,
        machineId: input.machineId,
        organizationId: organization.id,
      };

      const validationInput: IssueCreationInput = {
        ...baseValidationInput,
        ...(input.description && { description: input.description }),
        ...(input.reporterEmail && { reporterEmail: input.reporterEmail }),
        ...(input.submitterName && { submitterName: input.submitterName }),
      };

      const context: AssignmentValidationContext = {
        organizationId: organization.id,
        actorUserId: "anonymous", // Anonymous user
        userPermissions: ["issue:create"], // Anonymous creation allowed
      };

      // Validate issue creation using pure functions
      const validation = validateIssueCreation(
        validationInput,
        machine,
        defaultStatus,
        defaultPriority,
        context,
      );

      if (!validation.valid) {
        throw new Error(validation.error ?? "Issue creation validation failed");
      }

      // Validation passed, so defaultStatus and defaultPriority are guaranteed to be non-null
      if (!defaultStatus) {
        throw new Error("Default status validation failed");
      }
      if (!defaultPriority) {
        throw new Error("Default priority validation failed");
      }

      // Create the issue without a user (anonymous)
      const issueData: {
        title: string;
        description?: string | null;
        reporterEmail?: string | null;
        submitterName?: string | null;
        createdById?: string | null;
        machineId: string;
        organizationId: string;
        statusId: string;
        priorityId: string;
      } = {
        title: input.title,
        createdById: null, // Anonymous issue
        machineId: input.machineId,
        organizationId: organization.id,
        statusId: defaultStatus.id,
        priorityId: defaultPriority.id,
      };

      if (input.description) {
        issueData.description = input.description;
      }

      if (input.submitterName) {
        issueData.submitterName = input.submitterName;
      }

      if (input.reporterEmail) {
        issueData.reporterEmail = input.reporterEmail;
      }

      const issue = await ctx.db.issue.create({
        data: issueData,
        include: {
          status: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
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

      // Note: Skip activity recording for anonymous issues
      // Activity service requires actorId, which we don't have for anonymous users

      // Send notifications for new issue
      const notificationService = ctx.services.createNotificationService();
      await notificationService.notifyMachineOwnerOfIssue(
        issue.id,
        input.machineId,
      );

      return issue;
    }),
  // Create issue - requires issue:create permission
  create: issueCreateProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        severity: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
        machineId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Organization is guaranteed by organizationProcedure middleware
      const organization = ctx.organization;

      // Get machine, status, and priority for validation
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

      const defaultStatus = await ctx.db.issueStatus.findFirst({
        where: {
          isDefault: true,
          organizationId: organization.id,
        },
      });

      const defaultPriority = await ctx.db.priority.findFirst({
        where: {
          isDefault: true,
          organizationId: organization.id,
        },
      });

      // Create validation input (handle exactOptionalPropertyTypes)
      const baseValidationInput = {
        title: input.title,
        machineId: input.machineId,
        organizationId: organization.id,
        createdById: ctx.user.id,
      };

      const validationInput: IssueCreationInput = {
        ...baseValidationInput,
        ...(input.description && { description: input.description }),
      };

      const context: AssignmentValidationContext = {
        organizationId: organization.id,
        actorUserId: ctx.user.id,
        userPermissions: ctx.userPermissions,
      };

      // Validate issue creation using pure functions
      const validation = validateIssueCreation(
        validationInput,
        machine,
        defaultStatus,
        defaultPriority,
        context,
      );

      if (!validation.valid) {
        throw new Error(validation.error ?? "Issue creation validation failed");
      }

      // Validation passed, so defaultStatus and defaultPriority are guaranteed to be non-null
      if (!defaultStatus) {
        throw new Error("Default status validation failed");
      }
      if (!defaultPriority) {
        throw new Error("Default priority validation failed");
      }

      // User is guaranteed to exist in protected procedure
      const createdById = ctx.user.id;

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
        statusId: defaultStatus.id,
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
              email: true,
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

      // Record the issue creation activity
      const activityService = ctx.services.createIssueActivityService();
      await activityService.recordIssueCreated(
        issue.id,
        organization.id,
        createdById,
      );

      // Send notifications for new issue
      const notificationService = ctx.services.createNotificationService();
      await notificationService.notifyMachineOwnerOfIssue(
        issue.id,
        input.machineId,
      );

      return issue;
    }),

  // Assign issue to a user - requires issue:assign permission
  assign: issueAssignProcedure
    .input(
      z.object({
        issueId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get issue and membership for validation
      const issue = await ctx.db.issue.findFirst({
        where: {
          id: input.issueId,
          organizationId: ctx.organization.id,
        },
      });

      const membership = await ctx.db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: input.userId,
            organizationId: ctx.organization.id,
          },
        },
        include: { user: true },
      });

      // Create validation input
      const validationInput: IssueAssignmentInput = {
        issueId: input.issueId,
        userId: input.userId,
        organizationId: ctx.organization.id,
      };

      const context: AssignmentValidationContext = {
        organizationId: ctx.organization.id,
        actorUserId: ctx.user.id,
        userPermissions: ctx.userPermissions,
      };

      // Convert membership to validation format
      const validationMembership = membership
        ? {
            id: membership.id,
            userId: membership.userId,
            organizationId: membership.organizationId,
            roleId: membership.roleId,
            user: {
              id: membership.user.id,
              name: membership.user.name,
              email: membership.user.email ?? "",
            },
          }
        : null;

      // Validate issue assignment using pure functions
      const validation = validateIssueAssignment(
        validationInput,
        issue,
        validationMembership,
        context,
      );

      if (!validation.valid) {
        throw new Error(
          validation.error ?? "Issue assignment validation failed",
        );
      }

      // Update the issue assignment
      const updatedIssue = await ctx.db.issue.update({
        where: { id: input.issueId },
        data: { assignedToId: input.userId },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          status: true,
          createdBy: {
            select: {
              id: true,
              name: true,
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

      // Record the assignment activity
      const activityService = ctx.services.createIssueActivityService();
      await activityService.recordIssueAssigned(
        input.issueId,
        ctx.organization.id,
        ctx.user.id,
        input.userId,
      );

      return {
        success: true,
        issue: updatedIssue,
      };
    }),

  // Get all issues for an organization
  getAll: organizationProcedure
    .input(
      z
        .object({
          locationId: z.string().optional(),
          machineId: z.string().optional(),
          statusIds: z.array(z.string()).optional(),
          search: z.string().optional(),
          assigneeId: z.string().optional(),
          reporterId: z.string().optional(),
          ownerId: z.string().optional(),
          modelId: z.string().optional(),
          // Legacy support
          statusId: z.string().optional(),
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
          owner?: { id: string };
        };
        machineId?: string;
        statusId?: string | { in: string[] };
        status?: {
          category: "NEW" | "IN_PROGRESS" | "RESOLVED";
        };
        assignedToId?: string | null;
        createdById?: string;
        OR?: {
          title?: { contains: string; mode: "insensitive" };
          description?: { contains: string; mode: "insensitive" };
        }[];
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

      // Handle status filtering - support both single statusId and statusIds array
      if (input?.statusIds && input.statusIds.length > 0) {
        whereClause.statusId = { in: input.statusIds };
      } else if (input?.statusId) {
        whereClause.statusId = input.statusId;
      }

      if (input?.statusCategory) {
        whereClause.status = {
          category: input.statusCategory,
        };
      }

      // Handle search across title and description
      if (input?.search && input.search.trim() !== "") {
        const searchTerm = input.search.trim();
        whereClause.OR = [
          { title: { contains: searchTerm, mode: "insensitive" } },
          { description: { contains: searchTerm, mode: "insensitive" } },
        ];
      }

      // Handle assignee filter
      if (input?.assigneeId) {
        if (input.assigneeId === "unassigned") {
          whereClause.assignedToId = null;
        } else {
          whereClause.assignedToId = input.assigneeId;
        }
      }

      // Handle reporter filter
      if (input?.reporterId) {
        whereClause.createdById = input.reporterId;
      }

      // Handle machine owner filter
      if (input?.ownerId) {
        whereClause.machine = {
          ...whereClause.machine,
          owner: { id: input.ownerId },
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
          priority: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
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
  getById: issueViewProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const issue = await ctx.db.issue.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
        include: {
          status: true,
          priority: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
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

      // Map comments to include createdBy alias
      const mappedIssue = {
        ...issue,
        comments: issue.comments.map((comment) => ({
          ...comment,
          createdBy: comment.author, // Add createdBy as alias for author
        })),
      };

      return mappedIssue;
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
      const userId = ctx.user.id;

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
              email: true,
              image: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
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

  // Close an issue (set status to resolved)
  close: issueEditProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Find the resolved status for this organization
      const resolvedStatus = await ctx.db.issueStatus.findFirst({
        where: {
          organizationId: ctx.organization.id,
          category: "RESOLVED",
        },
      });

      if (!resolvedStatus) {
        throw new Error("No resolved status found for this organization");
      }

      // Update the issue
      const updatedIssue = await ctx.db.issue.update({
        where: { id: input.id },
        data: {
          statusId: resolvedStatus.id,
          resolvedAt: new Date(),
        },
        include: {
          status: true,
          priority: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
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

      // Record activity
      const activityService = ctx.services.createIssueActivityService();
      await activityService.recordIssueResolved(
        input.id,
        ctx.organization.id,
        ctx.user.id,
      );

      return updatedIssue;
    }),

  // Update issue status
  updateStatus: issueEditProcedure
    .input(
      z.object({
        id: z.string(),
        statusId: z.string(),
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
        },
      });

      if (!existingIssue) {
        throw new Error("Issue not found");
      }

      // Verify the status belongs to this organization
      const newStatus = await ctx.db.issueStatus.findFirst({
        where: {
          id: input.statusId,
          organizationId: ctx.organization.id,
        },
      });

      if (!newStatus) {
        throw new Error("Invalid status");
      }

      // Use extracted validation functions
      // Since this is using issueEditProcedure, user has issue:edit permission
      const userPermissions = ["issue:edit"] as const;
      const validationResult = validateStatusTransition(
        {
          currentStatus: existingIssue.status,
          newStatusId: input.statusId,
          organizationId: ctx.organization.id,
        },
        newStatus,
        {
          userPermissions,
          organizationId: ctx.organization.id,
        },
      );

      if (!validationResult.valid) {
        throw new Error(validationResult.error ?? "Invalid status transition");
      }

      // Get status change effects using extracted function
      const effects = getStatusChangeEffects(existingIssue.status, newStatus);

      // Update the issue
      const updatedIssue = await ctx.db.issue.update({
        where: { id: input.id },
        data: {
          statusId: input.statusId,
          ...(effects.shouldSetResolvedAt && { resolvedAt: new Date() }),
          ...(effects.shouldClearResolvedAt && { resolvedAt: null }),
        },
        include: {
          status: true,
          priority: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
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

      // Record activity
      const activityService = ctx.services.createIssueActivityService();
      await activityService.recordStatusChange(
        input.id,
        ctx.organization.id,
        ctx.user.id,
        existingIssue.status,
        newStatus,
      );

      // Send notifications
      const notificationService = ctx.services.createNotificationService();
      await notificationService.notifyMachineOwnerOfStatusChange(
        input.id,
        existingIssue.status.name,
        newStatus.name,
      );

      return updatedIssue;
    }),

  // Public procedure for getting issues (for anonymous users to see recent issues)
  publicGetAll: publicProcedure
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
          limit: z.number().min(1).max(100).optional(), // Limit for public access
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      // Organization is guaranteed by publicProcedure middleware via subdomain
      const organization = ctx.organization;

      if (!organization) {
        throw new Error("Organization not found");
      }

      // Build where clause with proper typing
      interface WhereClause {
        organizationId: string;
        machine?: {
          locationId?: string;
          modelId?: string;
        };
        machineId?: string;
        statusId?: string;
        status?: {
          category: "NEW" | "IN_PROGRESS" | "RESOLVED";
        };
      }

      const whereClause: WhereClause = {
        organizationId: organization.id,
      };

      // Apply filters
      if (input?.locationId) {
        whereClause.machine = {
          ...whereClause.machine,
          locationId: input.locationId,
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
        select: {
          id: true,
          title: true,
          description: true,
          createdAt: true,
          submitterName: true,
          status: true,
          priority: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
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
        orderBy,
        take: input?.limit ?? 20, // Default limit for public access
      });
    }),
});

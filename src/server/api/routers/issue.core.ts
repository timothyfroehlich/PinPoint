import { TRPCError } from "@trpc/server";
import { eq, inArray, sql, isNull, and } from "drizzle-orm";
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
import { generatePrefixedId } from "~/lib/utils/id-generation";
import {
  createTRPCRouter,
  publicProcedure,
  issueEditProcedure,
} from "~/server/api/trpc";
import {
  issueCreateProcedure,
  issueAssignProcedure,
  issueViewProcedure,
} from "~/server/api/trpc.permission";
import {
  issues,
  machines,
  issueStatuses,
  priorities,
  memberships,
  comments,
  attachments,
} from "~/server/db/schema";

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

      // Get machine, status, and priority for validation (RLS handles org scoping)
      const machine = await ctx.db.query.machines.findFirst({
        where: eq(machines.id, input.machineId),
        with: {
          location: true,
        },
      });

      const defaultStatus = await ctx.db.query.issueStatuses.findFirst({
        where: eq(issueStatuses.isDefault, true),
      });

      const defaultPriority = await ctx.db.query.priorities.findFirst({
        where: eq(priorities.isDefault, true),
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
        machine ?? null,
        defaultStatus ?? null,
        defaultPriority ?? null,
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
        id: string;
        title: string;
        description?: string | null;
        reporterEmail?: string | null;
        submitterName?: string | null;
        createdById?: string | null;
        organizationId: string;
        machineId: string;
        statusId: string;
        priorityId: string;
      } = {
        id: generatePrefixedId("issue"),
        title: input.title,
        createdById: null, // Anonymous issue
        organizationId: organization.id,
        machineId: input.machineId,
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

      await ctx.db.insert(issues).values(issueData);

      // Get issue with relations for return
      const issueWithRelations = await ctx.db.query.issues.findFirst({
        where: eq(issues.id, issueData.id),
        with: {
          status: true,
          createdBy: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          machine: {
            with: {
              model: true,
              location: true,
            },
          },
        },
      });

      if (!issueWithRelations) {
        throw new Error("Failed to create issue");
      }

      // Note: Skip activity recording for anonymous issues
      // Activity service requires actorId, which we don't have for anonymous users

      // Send notifications for new issue
      const notificationService = ctx.services.createNotificationService();
      await notificationService.notifyMachineOwnerOfIssue(
        issueData.id,
        input.machineId,
      );

      return issueWithRelations;
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

      // Get machine, status, and priority for validation (RLS handles org scoping)
      const machine = await ctx.db.query.machines.findFirst({
        where: eq(machines.id, input.machineId),
        with: {
          location: true,
        },
      });

      const defaultStatus = await ctx.db.query.issueStatuses.findFirst({
        where: eq(issueStatuses.isDefault, true),
      });

      const defaultPriority = await ctx.db.query.priorities.findFirst({
        where: eq(priorities.isDefault, true),
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
        machine ?? null,
        defaultStatus ?? null,
        defaultPriority ?? null,
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
        id: string;
        title: string;
        description?: string | null;
        createdById: string;
        organizationId: string;
        machineId: string;
        statusId: string;
        priorityId: string;
      } = {
        id: generatePrefixedId("issue"),
        title: input.title,
        createdById,
        organizationId: organization.id,
        machineId: input.machineId,
        statusId: defaultStatus.id,
        priorityId: defaultPriority.id,
      };

      if (input.description) {
        issueData.description = input.description;
      }

      await ctx.db.insert(issues).values(issueData);

      // Get issue with relations for return
      const issueWithRelations = await ctx.db.query.issues.findFirst({
        where: eq(issues.id, issueData.id),
        with: {
          status: true,
          createdBy: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          machine: {
            with: {
              model: true,
              location: true,
            },
          },
        },
      });

      if (!issueWithRelations) {
        throw new Error("Failed to create issue");
      }

      // Record the issue creation activity
      const activityService = ctx.services.createIssueActivityService();
      await activityService.recordIssueCreated(issueData.id, createdById);

      // Send notifications for new issue
      const notificationService = ctx.services.createNotificationService();
      await notificationService.notifyMachineOwnerOfIssue(
        issueData.id,
        input.machineId,
      );

      return issueWithRelations;
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
      // Get issue and membership for validation (organization scoped)
      const issue = await ctx.db.query.issues.findFirst({
        where: and(
          eq(issues.id, input.issueId),
          eq(issues.organizationId, ctx.organizationId),
        ),
      });

      const membership = await ctx.db.query.memberships.findFirst({
        where: eq(memberships.userId, input.userId),
        with: { user: true },
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
        issue ?? null,
        validationMembership,
        context,
      );

      if (!validation.valid) {
        throw new Error(
          validation.error ?? "Issue assignment validation failed",
        );
      }

      // Update the issue assignment
      await ctx.db
        .update(issues)
        .set({ assignedToId: input.userId })
        .where(eq(issues.id, input.issueId));

      // Get updated issue with relations
      const updatedIssue = await ctx.db.query.issues.findFirst({
        where: eq(issues.id, input.issueId),
        with: {
          assignedTo: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
          status: true,
          createdBy: {
            columns: {
              id: true,
              name: true,
            },
          },
          machine: {
            with: {
              model: true,
              location: true,
            },
          },
        },
      });

      if (!updatedIssue) {
        throw new Error("Failed to update issue");
      }

      // Record the assignment activity
      const activityService = ctx.services.createIssueActivityService();
      await activityService.recordIssueAssigned(
        input.issueId,
        ctx.user.id,
        input.userId,
      );

      return {
        success: true,
        issue: updatedIssue,
      };
    }),

  // Get all issues for an organization
  getAll: issueViewProcedure
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
      // Build where conditions dynamically (RLS handles org scoping)
      const conditions = [];

      // Machine ID filter
      if (input?.machineId) {
        conditions.push(eq(issues.machineId, input.machineId));
      }

      // Status filtering - support both single statusId and statusIds array
      if (input?.statusIds && input.statusIds.length > 0) {
        conditions.push(inArray(issues.statusId, input.statusIds));
      } else if (input?.statusId) {
        conditions.push(eq(issues.statusId, input.statusId));
      }

      // Assignee filter
      if (input?.assigneeId) {
        if (input.assigneeId === "unassigned") {
          conditions.push(isNull(issues.assignedToId));
        } else {
          conditions.push(eq(issues.assignedToId, input.assigneeId));
        }
      }

      // Reporter filter
      if (input?.reporterId) {
        conditions.push(eq(issues.createdById, input.reporterId));
      }

      // For complex filters involving relations, we'll need to use the subquery or joins
      const baseQuery = ctx.db.query.issues.findMany({
        where: and(...conditions),
        with: {
          status: true,
          priority: true,
          assignedTo: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          createdBy: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          machine: {
            with: {
              model: true,
              location: true,
              owner: {
                columns: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      let results = await baseQuery;

      // Apply post-query filters for complex relations
      if (input?.locationId) {
        results = results.filter(
          (issue) => issue.machine.location.id === input.locationId,
        );
      }

      if (input?.modelId) {
        results = results.filter(
          (issue) => issue.machine.model.id === input.modelId,
        );
      }

      if (input?.ownerId) {
        results = results.filter(
          (issue) => issue.machine.owner?.id === input.ownerId,
        );
      }

      if (input?.statusCategory) {
        results = results.filter(
          (issue) => issue.status.category === input.statusCategory,
        );
      }

      // Handle search across title and description
      if (input?.search?.trim()) {
        const searchTerm = input.search.trim().toLowerCase();
        results = results.filter(
          (issue) =>
            issue.title.toLowerCase().includes(searchTerm) ||
            issue.description?.toLowerCase().includes(searchTerm),
        );
      }

      // Get comment and attachment counts using separate queries
      const issueIds = results.map((issue) => issue.id);

      const commentCounts =
        issueIds.length > 0
          ? await ctx.db
              .select({
                issueId: comments.issueId,
                count: sql<number>`count(*)`.as("count"),
              })
              .from(comments)
              .where(inArray(comments.issueId, issueIds))
              .groupBy(comments.issueId)
          : [];

      const attachmentCounts =
        issueIds.length > 0
          ? await ctx.db
              .select({
                issueId: attachments.issueId,
                count: sql<number>`count(*)`.as("count"),
              })
              .from(attachments)
              .where(inArray(attachments.issueId, issueIds))
              .groupBy(attachments.issueId)
          : [];

      // Map counts to issues
      const commentCountMap = new Map(
        commentCounts.map((c) => [c.issueId, c.count]),
      );
      const attachmentCountMap = new Map(
        attachmentCounts.map((a) => [a.issueId, a.count]),
      );

      const resultsWithCounts = results.map((issue) => ({
        ...issue,
        _count: {
          comments: commentCountMap.get(issue.id) ?? 0,
          attachments: attachmentCountMap.get(issue.id) ?? 0,
        },
      }));

      // Apply sorting
      const sortBy = input?.sortBy ?? "created";
      const sortOrder = input?.sortOrder ?? "desc";

      resultsWithCounts.sort((a, b) => {
        let aValue: string | number | Date;
        let bValue: string | number | Date;

        switch (sortBy) {
          case "created":
            aValue = a.createdAt;
            bValue = b.createdAt;
            break;
          case "updated":
            aValue = a.updatedAt;
            bValue = b.updatedAt;
            break;
          case "status":
            aValue = a.status.name;
            bValue = b.status.name;
            break;
          case "severity":
            aValue = a.priority.order;
            bValue = b.priority.order;
            break;
          case "game":
            aValue = a.machine.model.name;
            bValue = b.machine.model.name;
            break;
          default:
            aValue = a.createdAt;
            bValue = b.createdAt;
        }

        if (sortOrder === "desc") {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        } else {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        }
      });

      return resultsWithCounts;
    }),

  // Get a single issue by ID
  getById: issueViewProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const issue = await ctx.db.query.issues.findFirst({
        where: and(
          eq(issues.id, input.id),
          eq(issues.organizationId, ctx.organizationId),
        ),
        with: {
          status: true,
          priority: true,
          assignedTo: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          createdBy: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          machine: {
            with: {
              model: true,
              location: true,
            },
          },
          comments: {
            with: {
              author: {
                columns: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
            orderBy: (comments, { asc }) => [asc(comments.createdAt)],
          },
          attachments: {
            orderBy: (attachments, { asc }) => [asc(attachments.id)],
          },
        },
      });

      if (!issue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found",
        });
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
      // Verify the issue exists (organization scoped)
      const existingIssue = await ctx.db.query.issues.findFirst({
        where: and(
          eq(issues.id, input.id),
          eq(issues.organizationId, ctx.organizationId),
        ),
        with: {
          status: true,
          assignedTo: true,
        },
      });

      if (!existingIssue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found",
        });
      }

      const activityService = ctx.services.createIssueActivityService();
      const notificationService = ctx.services.createNotificationService();
      const userId = ctx.user.id;

      // Prepare data for tracking changes
      let newStatus = existingIssue.status;
      let newAssignedTo = existingIssue.assignedTo;

      // If updating status, verify it exists (RLS handles org scoping)
      if (input.statusId) {
        const status = await ctx.db.query.issueStatuses.findFirst({
          where: eq(issueStatuses.id, input.statusId),
        });
        if (!status) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid status",
          });
        }
        newStatus = status;
      }

      // If updating assignee, verify they are a member (RLS handles org scoping)
      if (input.assignedToId !== undefined) {
        if (input.assignedToId) {
          const membership = await ctx.db.query.memberships.findFirst({
            where: eq(memberships.userId, input.assignedToId),
            with: {
              user: true,
            },
          });
          if (!membership) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "User is not a member of this organization",
            });
          }
          newAssignedTo = membership.user;
        } else {
          newAssignedTo = null;
        }
      }

      // Update the issue
      const updateData: Partial<typeof issues.$inferInsert> = {};
      if (input.title) updateData.title = input.title;
      if (input.description !== undefined)
        updateData.description = input.description;
      if (input.statusId) updateData.statusId = input.statusId;
      if (input.assignedToId !== undefined)
        updateData.assignedToId = input.assignedToId ?? null;

      await ctx.db
        .update(issues)
        .set(updateData)
        .where(
          and(
            eq(issues.id, input.id),
            eq(issues.organizationId, ctx.organizationId),
          ),
        );

      // Get updated issue with relations
      const updatedIssue = await ctx.db.query.issues.findFirst({
        where: and(
          eq(issues.id, input.id),
          eq(issues.organizationId, ctx.organizationId),
        ),
        with: {
          status: true,
          assignedTo: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          createdBy: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          machine: {
            with: {
              model: true,
              location: true,
            },
          },
        },
      });

      if (!updatedIssue) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update issue",
        });
      }

      // Record activities for changes
      if (input.statusId && existingIssue.status.id !== input.statusId) {
        await activityService.recordStatusChange(
          input.id,
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
      // Find the resolved status (RLS handles org scoping)
      const resolvedStatus = await ctx.db.query.issueStatuses.findFirst({
        where: eq(issueStatuses.category, "RESOLVED"),
      });

      if (!resolvedStatus) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No resolved status found for this organization",
        });
      }

      // Update the issue
      await ctx.db
        .update(issues)
        .set({
          statusId: resolvedStatus.id,
          resolvedAt: new Date(),
        })
        .where(
          and(
            eq(issues.id, input.id),
            eq(issues.organizationId, ctx.organizationId),
          ),
        );

      // Get updated issue with relations
      const updatedIssue = await ctx.db.query.issues.findFirst({
        where: eq(issues.id, input.id),
        with: {
          status: true,
          priority: true,
          assignedTo: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          createdBy: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          machine: {
            with: {
              model: true,
              location: true,
            },
          },
        },
      });

      if (!updatedIssue) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to close issue",
        });
      }

      // Record activity
      const activityService = ctx.services.createIssueActivityService();
      await activityService.recordIssueResolved(input.id, ctx.user.id);

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
      // Verify the issue exists (organization scoped)
      const existingIssue = await ctx.db.query.issues.findFirst({
        where: and(
          eq(issues.id, input.id),
          eq(issues.organizationId, ctx.organizationId),
        ),
        with: {
          status: true,
        },
      });

      if (!existingIssue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found",
        });
      }

      // Verify the status exists (RLS handles org scoping)
      const newStatus = await ctx.db.query.issueStatuses.findFirst({
        where: eq(issueStatuses.id, input.statusId),
      });

      if (!newStatus) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid status",
        });
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
      const updateData: Partial<typeof issues.$inferInsert> = {
        statusId: input.statusId,
      };
      if (effects.shouldSetResolvedAt) updateData.resolvedAt = new Date();
      if (effects.shouldClearResolvedAt) updateData.resolvedAt = null;

      await ctx.db
        .update(issues)
        .set(updateData)
        .where(
          and(
            eq(issues.id, input.id),
            eq(issues.organizationId, ctx.organizationId),
          ),
        );

      // Get updated issue with relations
      const updatedIssue = await ctx.db.query.issues.findFirst({
        where: and(
          eq(issues.id, input.id),
          eq(issues.organizationId, ctx.organizationId),
        ),
        with: {
          status: true,
          priority: true,
          assignedTo: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          createdBy: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          machine: {
            with: {
              model: true,
              location: true,
            },
          },
        },
      });

      if (!updatedIssue) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update issue status",
        });
      }

      // Record activity
      const activityService = ctx.services.createIssueActivityService();
      await activityService.recordStatusChange(
        input.id,
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

      // Build where conditions dynamically (RLS handles org scoping)
      const conditions = [];

      // Machine ID filter
      if (input?.machineId) {
        conditions.push(eq(issues.machineId, input.machineId));
      }

      // Status filter
      if (input?.statusId) {
        conditions.push(eq(issues.statusId, input.statusId));
      }

      const baseQuery = ctx.db.query.issues.findMany({
        where: and(...conditions),
        columns: {
          id: true,
          title: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          submitterName: true,
        },
        with: {
          status: true,
          priority: true,
          assignedTo: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          createdBy: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          machine: {
            with: {
              model: true,
              location: true,
            },
          },
        },
      });

      let results = await baseQuery;

      // Apply post-query filters for complex relations
      if (input?.locationId) {
        results = results.filter(
          (issue) => issue.machine.location.id === input.locationId,
        );
      }

      if (input?.modelId) {
        results = results.filter(
          (issue) => issue.machine.model.id === input.modelId,
        );
      }

      if (input?.statusCategory) {
        results = results.filter(
          (issue) => issue.status.category === input.statusCategory,
        );
      }

      // Apply sorting
      const sortBy = input?.sortBy ?? "created";
      const sortOrder = input?.sortOrder ?? "desc";

      results.sort((a, b) => {
        let aValue: string | number | Date;
        let bValue: string | number | Date;

        switch (sortBy) {
          case "created":
            aValue = a.createdAt;
            bValue = b.createdAt;
            break;
          case "updated":
            aValue = a.updatedAt;
            bValue = b.updatedAt;
            break;
          case "status":
            aValue = a.status.name;
            bValue = b.status.name;
            break;
          case "severity":
            aValue = a.priority.order;
            bValue = b.priority.order;
            break;
          case "game":
            aValue = a.machine.model.name;
            bValue = b.machine.model.name;
            break;
          default:
            aValue = a.createdAt;
            bValue = b.createdAt;
        }

        if (sortOrder === "desc") {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        } else {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        }
      });

      // Apply limit
      const limit = input?.limit ?? 20;
      return results.slice(0, limit);
    }),
});

// External libraries (alphabetical)
import { TRPCError } from "@trpc/server";
import { eq, inArray, sql, isNull, and } from "drizzle-orm";
import { z } from "zod";

// Internal types (alphabetical)
import type {
  IssueAssignmentInput,
  IssueCreationInput,
  AssignmentValidationContext,
} from "~/lib/issues/assignmentValidation";
import type {
  IssueWithRelationsResponse,
  IssueResponse,
} from "~/lib/types/api";

// Internal utilities (alphabetical)
import {
  validateIssueAssignment,
  validateIssueCreation,
} from "~/lib/issues/assignmentValidation";
import {
  validateStatusTransition,
  getStatusChangeEffects,
} from "~/lib/issues/statusValidation";
import {
  transformKeysToCamelCase,
  transformKeysToSnakeCase,
} from "~/lib/utils/case-transformers";
import { generatePrefixedId } from "~/lib/utils/id-generation";

// Server modules (alphabetical)
import {
  issueCreateSchema,
  issueUpdateSchema,
  issueFilterSchema,
  issueAssignSchema,
  issueStatusUpdateSchema,
  publicIssueCreateSchema,
} from "~/server/api/schemas/issue.schema";
import {
  createTRPCRouter,
  anonOrgScopedProcedure,
  orgScopedProcedure,
  issueEditProcedure,
} from "~/server/api/trpc";
import {
  issueCreateProcedure,
  issueAssignProcedure,
  issueViewProcedure,
} from "~/server/api/trpc.permission";

// Database schema (alphabetical)
import {
  attachments,
  comments,
  issues,
  issueStatuses,
  machines,
  memberships,
  priorities,
} from "~/server/db/schema";

export const issueCoreRouter = createTRPCRouter({
  // Public issue creation for anonymous users (via QR codes)
  publicCreate: anonOrgScopedProcedure
    .input(publicIssueCreateSchema)
    .mutation(async ({ ctx, input }): Promise<IssueWithRelationsResponse> => {
      // Get machine, status, and priority for validation (RLS handles org scoping)
      const machine = await ctx.db.query.machines.findFirst({
        where: eq(machines.id, input.machineId),
        with: {
          location: true,
        },
      });

      const defaultStatus = await ctx.db.query.issueStatuses.findFirst({
        where: and(
          eq(issueStatuses.is_default, true),
          eq(issueStatuses.organization_id, ctx.organizationId),
        ),
      });

      const defaultPriority = await ctx.db.query.priorities.findFirst({
        where: and(
          eq(priorities.is_default, true),
          eq(priorities.organization_id, ctx.organizationId),
        ),
      });

      // Create validation input (handle exactOptionalPropertyTypes)
      const baseValidationInput = {
        title: input.title,
        machineId: input.machineId,
        organizationId: ctx.organizationId,
      };

      const validationInput: IssueCreationInput = {
        ...baseValidationInput,
        ...(input.description && { description: input.description }),
        ...(input.reporterEmail && { reporterEmail: input.reporterEmail }),
        ...(input.submitterName && { submitterName: input.submitterName }),
      };

      const context: AssignmentValidationContext = {
        organizationId: ctx.organizationId,
        actorUserId: "anonymous", // Anonymous user
        userPermissions: ["issue:create"], // Anonymous creation allowed
      };

      // Transform machine data to camelCase for validation
      const transformedMachine = machine
        ? {
            id: machine.id,
            name: machine.name,
            location: {
              organizationId: machine.location.organization_id,
            },
          }
        : null;

      // Transform defaultStatus to camelCase for validation
      const transformedDefaultStatus = defaultStatus
        ? {
            id: defaultStatus.id,
            name: defaultStatus.name,
            organizationId: defaultStatus.organization_id,
            isDefault: defaultStatus.is_default,
            category: defaultStatus.category,
          }
        : null;

      // Transform defaultPriority to camelCase for validation
      const transformedDefaultPriority = defaultPriority
        ? {
            id: defaultPriority.id,
            name: defaultPriority.name,
            organizationId: defaultPriority.organization_id,
            isDefault: defaultPriority.is_default,
          }
        : null;

      // Validate issue creation using pure functions
      const validation = validateIssueCreation(
        validationInput,
        transformedMachine,
        transformedDefaultStatus,
        transformedDefaultPriority,
        context,
      );

      if (!validation.valid) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: validation.error ?? "Issue creation validation failed",
        });
      }

      // Validation passed, so defaultStatus and defaultPriority are guaranteed to be non-null
      if (!defaultStatus) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Default status validation failed",
        });
      }
      if (!defaultPriority) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Default priority validation failed",
        });
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
        organizationId: ctx.organizationId,
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

      await ctx.db
        .insert(issues)
        .values(
          transformKeysToSnakeCase(issueData) as typeof issues.$inferInsert,
        );

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
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create issue",
        });
      }

      // Note: Skip activity recording for anonymous issues
      // Activity service requires actorId, which we don't have for anonymous users

      // Send notifications for new issue
      const notificationService = ctx.services.createNotificationService();
      await notificationService.notifyMachineOwnerOfIssue(
        issueData.id,
        input.machineId,
      );

      // Create properly mapped issue with comments having createdBy alias
      const mappedIssue = {
        ...issueWithRelations,
        comments: [], // Issues without comment relations loaded
        attachments: [], // Issues without attachment relations loaded
      };

      return transformKeysToCamelCase(
        mappedIssue,
      ) as IssueWithRelationsResponse;
    }),
  // Create issue - requires issue:create permission
  create: issueCreateProcedure
    .input(issueCreateSchema)
    .mutation(async ({ ctx, input }): Promise<IssueWithRelationsResponse> => {
      // Organization is guaranteed by organizationProcedure middleware

      // Get machine, status, and priority for validation (RLS handles org scoping)
      const machine = await ctx.db.query.machines.findFirst({
        where: eq(machines.id, input.machineId),
        with: {
          location: true,
        },
      });

      const defaultStatus = await ctx.db.query.issueStatuses.findFirst({
        where: and(
          eq(issueStatuses.is_default, true),
          eq(issueStatuses.organization_id, ctx.organizationId),
        ),
      });

      const defaultPriority = await ctx.db.query.priorities.findFirst({
        where: and(
          eq(priorities.is_default, true),
          eq(priorities.organization_id, ctx.organizationId),
        ),
      });

      // Create validation input (handle exactOptionalPropertyTypes)
      const baseValidationInput = {
        title: input.title,
        machineId: input.machineId,
        organizationId: ctx.organizationId,
        createdById: ctx.user.id,
      };

      const validationInput: IssueCreationInput = {
        ...baseValidationInput,
        ...(input.description && { description: input.description }),
      };

      const context: AssignmentValidationContext = {
        organizationId: ctx.organizationId,
        actorUserId: ctx.user.id,
        userPermissions: ctx.userPermissions,
      };

      // Transform machine data to camelCase for validation
      const transformedMachine = machine
        ? {
            id: machine.id,
            name: machine.name,
            location: {
              organizationId: machine.location.organization_id,
            },
          }
        : null;

      // Transform defaultStatus to camelCase for validation
      const transformedDefaultStatus = defaultStatus
        ? {
            id: defaultStatus.id,
            name: defaultStatus.name,
            organizationId: defaultStatus.organization_id,
            isDefault: defaultStatus.is_default,
            category: defaultStatus.category,
          }
        : null;

      // Transform defaultPriority to camelCase for validation
      const transformedDefaultPriority = defaultPriority
        ? {
            id: defaultPriority.id,
            name: defaultPriority.name,
            organizationId: defaultPriority.organization_id,
            isDefault: defaultPriority.is_default,
          }
        : null;

      // Validate issue creation using pure functions
      const validation = validateIssueCreation(
        validationInput,
        transformedMachine,
        transformedDefaultStatus,
        transformedDefaultPriority,
        context,
      );

      if (!validation.valid) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: validation.error ?? "Issue creation validation failed",
        });
      }

      // Validation passed, so defaultStatus and defaultPriority are guaranteed to be non-null
      if (!defaultStatus) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Default status validation failed",
        });
      }
      if (!defaultPriority) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Default priority validation failed",
        });
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
        organizationId: ctx.organizationId,
        machineId: input.machineId,
        statusId: defaultStatus.id,
        priorityId: defaultPriority.id,
      };

      if (input.description) {
        issueData.description = input.description;
      }

      await ctx.db
        .insert(issues)
        .values(
          transformKeysToSnakeCase(issueData) as typeof issues.$inferInsert,
        );

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
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create issue",
        });
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

      // Create properly mapped issue with comments having createdBy alias
      const mappedIssue = {
        ...issueWithRelations,
        comments: [], // Issues without comment relations loaded
        attachments: [], // Issues without attachment relations loaded
      };

      return transformKeysToCamelCase(
        mappedIssue,
      ) as IssueWithRelationsResponse;
    }),

  // Assign issue to a user - requires issue:assign permission
  assign: issueAssignProcedure
    .input(issueAssignSchema)
    .mutation(
      async ({
        ctx,
        input,
      }): Promise<{ success: boolean; issue: IssueResponse }> => {
        // Get issue and membership for validation (organization scoped)
        const issue = await ctx.db.query.issues.findFirst({
          where: and(
            eq(issues.id, input.issueId),
            eq(issues.organization_id, ctx.organizationId),
          ),
        });

        const membership = await ctx.db.query.memberships.findFirst({
          where: eq(memberships.user_id, input.userId),
          with: { user: true },
        });

        // Create validation input
        const validationInput: IssueAssignmentInput = {
          issueId: input.issueId,
          userId: input.userId,
          organizationId: ctx.organizationId,
        };

        const context: AssignmentValidationContext = {
          organizationId: ctx.organizationId,
          actorUserId: ctx.user.id,
          userPermissions: ctx.userPermissions,
        };

        // Convert membership to validation format
        const validationMembership = membership
          ? {
              id: membership.id,
              userId: membership.user_id,
              organizationId: membership.organization_id,
              roleId: membership.role_id,
              user: {
                id: membership.user.id,
                name: membership.user.name,
                email: membership.user.email ?? "",
              },
            }
          : null;

        // Transform issue data to camelCase for validation
        const transformedIssue = issue
          ? {
              id: issue.id,
              title: issue.title,
              organizationId: issue.organization_id,
              machineId: issue.machine_id,
              assignedToId: issue.assigned_to_id,
              statusId: issue.status_id,
              createdById: issue.created_by_id,
            }
          : null;

        // Validate issue assignment using pure functions
        const validation = validateIssueAssignment(
          validationInput,
          transformedIssue,
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
          .set({ assigned_to_id: input.userId })
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
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update issue",
          });
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
          issue: transformKeysToCamelCase(updatedIssue) as IssueResponse,
        };
      },
    ),

  // Get all issues for an organization
  getAll: orgScopedProcedure
    .input(issueFilterSchema.optional())
    .query(async ({ ctx, input }): Promise<IssueWithRelationsResponse[]> => {
      // Build where conditions dynamically (RLS handles org scoping)
      const conditions = [];

      // Machine ID filter
      if (input?.machineId) {
        conditions.push(eq(issues.machine_id, input.machineId));
      }

      // Status filtering - support both single statusId and statusIds array
      if (input?.statusIds && input.statusIds.length > 0) {
        conditions.push(inArray(issues.status_id, input.statusIds));
      } else if (input?.statusId) {
        conditions.push(eq(issues.status_id, input.statusId));
      }

      // Assignee filter
      if (input?.assigneeId) {
        if (input.assigneeId === "unassigned") {
          conditions.push(isNull(issues.assigned_to_id));
        } else {
          conditions.push(eq(issues.assigned_to_id, input.assigneeId));
        }
      }

      // Reporter filter
      if (input?.reporterId) {
        conditions.push(eq(issues.created_by_id, input.reporterId));
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
                issueId: comments.issue_id,
                count: sql<number>`count(*)`.as("count"),
              })
              .from(comments)
              .where(inArray(comments.issue_id, issueIds))
              .groupBy(comments.issue_id)
          : [];

      const attachmentCounts =
        issueIds.length > 0
          ? await ctx.db
              .select({
                issueId: attachments.issue_id,
                count: sql<number>`count(*)`.as("count"),
              })
              .from(attachments)
              .where(inArray(attachments.issue_id, issueIds))
              .groupBy(attachments.issue_id)
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
            aValue = a.created_at;
            bValue = b.created_at;
            break;
          case "updated":
            aValue = a.updated_at;
            bValue = b.updated_at;
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
            aValue = a.created_at;
            bValue = b.created_at;
        }

        if (sortOrder === "desc") {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        } else {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        }
      });

      return transformKeysToCamelCase(
        resultsWithCounts,
      ) as IssueWithRelationsResponse[];
    }),

  // Get a single issue by ID
  getById: issueViewProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }): Promise<IssueWithRelationsResponse> => {
      const issue = await ctx.db.query.issues.findFirst({
        where: and(
          eq(issues.id, input.id),
          eq(issues.organization_id, ctx.organizationId),
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
            orderBy: (comments, { asc }) => [asc(comments.created_at)],
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

      return transformKeysToCamelCase(
        mappedIssue,
      ) as IssueWithRelationsResponse;
    }),

  // Update issue (for members/admins)
  update: issueEditProcedure
    .input(issueUpdateSchema)
    .mutation(async ({ ctx, input }): Promise<IssueWithRelationsResponse> => {
      // Verify the issue exists (organization scoped)
      const existingIssue = await ctx.db.query.issues.findFirst({
        where: and(
          eq(issues.id, input.id),
          eq(issues.organization_id, ctx.organizationId),
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
            where: eq(memberships.user_id, input.assignedToId),
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
      if (input.statusId) updateData.status_id = input.statusId;
      if (input.assignedToId !== undefined)
        updateData.assigned_to_id = input.assignedToId ?? null;

      await ctx.db
        .update(issues)
        .set(updateData)
        .where(
          and(
            eq(issues.id, input.id),
            eq(issues.organization_id, ctx.organizationId),
          ),
        );

      // Get updated issue with relations
      const updatedIssue = await ctx.db.query.issues.findFirst({
        where: and(
          eq(issues.id, input.id),
          eq(issues.organization_id, ctx.organizationId),
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
        existingIssue.assigned_to_id !== input.assignedToId
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

      return transformKeysToCamelCase(
        updatedIssue,
      ) as IssueWithRelationsResponse;
    }),

  // Close an issue (set status to resolved)
  close: issueEditProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }): Promise<IssueWithRelationsResponse> => {
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
          status_id: resolvedStatus.id,
          resolved_at: new Date(),
        })
        .where(
          and(
            eq(issues.id, input.id),
            eq(issues.organization_id, ctx.organizationId),
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

      return transformKeysToCamelCase(
        updatedIssue,
      ) as IssueWithRelationsResponse;
    }),

  // Update issue status
  updateStatus: issueEditProcedure
    .input(issueStatusUpdateSchema)
    .mutation(async ({ ctx, input }): Promise<IssueWithRelationsResponse> => {
      // Verify the issue exists (organization scoped)
      const existingIssue = await ctx.db.query.issues.findFirst({
        where: and(
          eq(issues.id, input.id),
          eq(issues.organization_id, ctx.organizationId),
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
          currentStatus: transformKeysToCamelCase(existingIssue.status) as any, // IssueStatus type conversion
          newStatusId: input.statusId,
          organizationId: ctx.organizationId,
        },
        transformKeysToCamelCase(newStatus) as any, // IssueStatus type conversion
        {
          userPermissions,
          organizationId: ctx.organizationId,
        },
      );

      if (!validationResult.valid) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: validationResult.error ?? "Invalid status transition",
        });
      }

      // Get status change effects using extracted function
      const effects = getStatusChangeEffects(
        transformKeysToCamelCase(existingIssue.status) as any, // IssueStatus type conversion
        transformKeysToCamelCase(newStatus) as any, // IssueStatus type conversion
      );

      // Update the issue
      const updateData: Partial<typeof issues.$inferInsert> = {
        status_id: input.statusId,
      };
      if (effects.shouldSetResolvedAt) updateData.resolved_at = new Date();
      if (effects.shouldClearResolvedAt) updateData.resolved_at = null;

      await ctx.db
        .update(issues)
        .set(updateData)
        .where(
          and(
            eq(issues.id, input.id),
            eq(issues.organization_id, ctx.organizationId),
          ),
        );

      // Get updated issue with relations
      const updatedIssue = await ctx.db.query.issues.findFirst({
        where: and(
          eq(issues.id, input.id),
          eq(issues.organization_id, ctx.organizationId),
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

      return transformKeysToCamelCase(
        updatedIssue,
      ) as IssueWithRelationsResponse;
    }),

  // Public procedure for getting issues (for anonymous users to see recent issues)
  publicGetAll: anonOrgScopedProcedure
    .input(issueFilterSchema.optional())
    .query(async ({ ctx, input }): Promise<IssueResponse[]> => {
      // Build where conditions dynamically (RLS handles org scoping)
      const conditions = [];

      // Machine ID filter
      if (input?.machineId) {
        conditions.push(eq(issues.machine_id, input.machineId));
      }

      // Status filter
      if (input?.statusId) {
        conditions.push(eq(issues.status_id, input.statusId));
      }

      const baseQuery = ctx.db.query.issues.findMany({
        where: and(...conditions),
        columns: {
          id: true,
          title: true,
          description: true,
          created_at: true,
          updated_at: true,
          submitter_name: true,
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
            aValue = a.created_at;
            bValue = b.created_at;
            break;
          case "updated":
            aValue = a.updated_at;
            bValue = b.updated_at;
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
            aValue = a.created_at;
            bValue = b.created_at;
        }

        if (sortOrder === "desc") {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        } else {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        }
      });

      // Apply limit
      const limit = input?.limit ?? 20;
      return transformKeysToCamelCase(
        results.slice(0, limit),
      ) as IssueResponse[];
    }),
});

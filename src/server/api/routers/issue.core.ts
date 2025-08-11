import { TRPCError } from "@trpc/server";
import { and, eq, count, sql, inArray } from "drizzle-orm";
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
import { generateId } from "~/lib/utils/id-generation";
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
import {
  issues,
  machines,
  models,
  locations,
  users,
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
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Get machine, status, and priority for validation
      const machine = await ctx.drizzle.query.machines.findFirst({
        where: eq(machines.id, input.machineId),
        with: {
          location: {
            columns: {
              organizationId: true,
            },
          },
        },
      });

      const defaultStatus = await ctx.drizzle.query.issueStatuses.findFirst({
        where: and(
          eq(issueStatuses.isDefault, true),
          eq(issueStatuses.organizationId, organization.id),
        ),
      });

      const defaultPriority = await ctx.drizzle.query.priorities.findFirst({
        where: and(
          eq(priorities.isDefault, true),
          eq(priorities.organizationId, organization.id),
        ),
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
      const issueData = {
        id: generateId(),
        title: input.title,
        description: input.description ?? null,
        reporterEmail: input.reporterEmail ?? null,
        submitterName: input.submitterName ?? null,
        createdById: null, // Anonymous issue
        machineId: input.machineId,
        organizationId: organization.id,
        statusId: defaultStatus.id,
        priorityId: defaultPriority.id,
      };

      const [issue] = await ctx.drizzle
        .insert(issues)
        .values(issueData)
        .returning();

      if (!issue) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create issue",
        });
      }

      // Get the created issue with all related data
      const createdIssue = await ctx.drizzle.query.issues.findFirst({
        where: eq(issues.id, issue.id),
        with: {
          status: true,
          createdBy: {
            columns: {
              id: true,
              name: true,
              email: true,
              profilePicture: true,
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

      if (!createdIssue) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve created issue",
        });
      }

      // Map profilePicture to image for compatibility
      const issueWithImageAlias = {
        ...createdIssue,
        createdBy: createdIssue.createdBy
          ? {
              ...createdIssue.createdBy,
              image: createdIssue.createdBy.profilePicture,
            }
          : null,
      };

      // Note: Skip activity recording for anonymous issues
      // Activity service requires actorId, which we don't have for anonymous users

      // Send notifications for new issue
      const notificationService = ctx.services.createNotificationService();
      await notificationService.notifyMachineOwnerOfIssue(
        issue.id,
        input.machineId,
      );

      return issueWithImageAlias;
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
      const machine = await ctx.drizzle.query.machines.findFirst({
        where: eq(machines.id, input.machineId),
        with: {
          location: {
            columns: {
              organizationId: true,
            },
          },
        },
      });

      const defaultStatus = await ctx.drizzle.query.issueStatuses.findFirst({
        where: and(
          eq(issueStatuses.isDefault, true),
          eq(issueStatuses.organizationId, organization.id),
        ),
      });

      const defaultPriority = await ctx.drizzle.query.priorities.findFirst({
        where: and(
          eq(priorities.isDefault, true),
          eq(priorities.organizationId, organization.id),
        ),
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
      const issueData = {
        id: generateId(),
        title: input.title,
        description: input.description ?? null,
        createdById,
        machineId: input.machineId,
        organizationId: organization.id,
        statusId: defaultStatus.id,
        priorityId: defaultPriority.id,
      };

      const [issue] = await ctx.drizzle
        .insert(issues)
        .values(issueData)
        .returning();

      if (!issue) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create issue",
        });
      }

      // Get the created issue with all related data
      const createdIssue = await ctx.drizzle.query.issues.findFirst({
        where: eq(issues.id, issue.id),
        with: {
          status: true,
          createdBy: {
            columns: {
              id: true,
              name: true,
              email: true,
              profilePicture: true,
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

      if (!createdIssue) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve created issue",
        });
      }

      // Map profilePicture to image for compatibility
      const issueWithImageAlias = {
        ...createdIssue,
        createdBy: createdIssue.createdBy
          ? {
              ...createdIssue.createdBy,
              image: createdIssue.createdBy.profilePicture,
            }
          : null,
      };

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

      return issueWithImageAlias;
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
      const issue = await ctx.drizzle.query.issues.findFirst({
        where: and(
          eq(issues.id, input.issueId),
          eq(issues.organizationId, ctx.organization.id),
        ),
      });

      const membership = await ctx.drizzle.query.memberships.findFirst({
        where: and(
          eq(memberships.userId, input.userId),
          eq(memberships.organizationId, ctx.organization.id),
        ),
        with: {
          user: true,
        },
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
      const validationMembership = membership?.user
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
      const [updatedIssue] = await ctx.drizzle
        .update(issues)
        .set({ assignedToId: input.userId })
        .where(eq(issues.id, input.issueId))
        .returning();

      if (!updatedIssue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found",
        });
      }

      // Get the updated issue with all related data
      const issueWithRelations = await ctx.drizzle.query.issues.findFirst({
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

      if (!issueWithRelations) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Updated issue not found",
        });
      }

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
        issue: issueWithRelations,
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
      // Build Drizzle where conditions
      const conditions = [eq(issues.organizationId, ctx.organization.id)];

      // Machine-related filters
      if (input?.machineId) {
        conditions.push(eq(issues.machineId, input.machineId));
      }

      // Status filtering - support both single statusId and statusIds array
      if (input?.statusIds && input.statusIds.length > 0) {
        conditions.push(inArray(issues.statusId, input.statusIds));
      } else if (input?.statusId) {
        conditions.push(eq(issues.statusId, input.statusId));
      }

      // Handle search across title and description
      if (input?.search && input.search.trim() !== "") {
        const searchTerm = input.search.trim();
        conditions.push(
          sql.raw(
            `(${issues.title.name} ILIKE '%${searchTerm}%' OR (${issues.description.name} IS NOT NULL AND ${issues.description.name} ILIKE '%${searchTerm}%'))`,
          ),
        );
      }

      // Handle assignee filter
      if (input?.assigneeId) {
        if (input.assigneeId === "unassigned") {
          conditions.push(sql`${issues.assignedToId} IS NULL`);
        } else {
          conditions.push(eq(issues.assignedToId, input.assigneeId));
        }
      }

      // Handle reporter filter
      if (input?.reporterId) {
        conditions.push(eq(issues.createdById, input.reporterId));
      }

      // Build the final where condition
      const whereCondition =
        conditions.length > 1
          ? and(...conditions)
          : conditions.length === 1
            ? conditions[0]
            : undefined;

      // Use SQL builder for reliable relationship loading
      const allIssues = await ctx.drizzle
        .select({
          // Issue fields
          id: issues.id,
          title: issues.title,
          description: issues.description,
          createdAt: issues.createdAt,
          updatedAt: issues.updatedAt,
          organizationId: issues.organizationId,
          machineId: issues.machineId,
          statusId: issues.statusId,
          priorityId: issues.priorityId,
          assignedToId: issues.assignedToId,
          createdById: issues.createdById,
          submitterName: issues.submitterName,
          reporterEmail: issues.reporterEmail,
          resolvedAt: issues.resolvedAt,
          consistency: issues.consistency,
          checklist: issues.checklist,

          // Status relationship
          status: {
            id: issueStatuses.id,
            name: issueStatuses.name,
            category: issueStatuses.category,
            organizationId: issueStatuses.organizationId,
            isDefault: issueStatuses.isDefault,
          },

          // Priority relationship
          priority: {
            id: priorities.id,
            name: priorities.name,
            order: priorities.order,
            organizationId: priorities.organizationId,
            isDefault: priorities.isDefault,
          },

          // Machine relationship - flattened for Drizzle compatibility
          machine: sql<{
            id: string;
            name: string;
            modelId: string;
            locationId: string;
            ownerId: string | null;
            model: {
              id: string;
              name: string;
              manufacturer: string | null;
              year: number | null;
            };
            location: { id: string; name: string; organizationId: string };
          }>`json_build_object(
            'id', ${machines.id},
            'name', ${machines.name},
            'modelId', ${machines.modelId},
            'locationId', ${machines.locationId},
            'ownerId', ${machines.ownerId},
            'model', json_build_object(
              'id', ${models.id},
              'name', ${models.name},
              'manufacturer', ${models.manufacturer},
              'year', ${models.year}
            ),
            'location', json_build_object(
              'id', ${locations.id},
              'name', ${locations.name},
              'organizationId', ${locations.organizationId}
            )
          )`,

          // User relationships (will be null for anonymous issues or unassigned issues)
          assignedTo: sql<{
            id: string;
            name: string | null;
            email: string | null;
            image: string | null;
          } | null>`
            CASE WHEN ${issues.assignedToId} IS NOT NULL THEN 
              json_build_object(
                'id', assigned_user.id,
                'name', assigned_user.name,
                'email', assigned_user.email,
                'image', assigned_user."profilePicture"
              )
            ELSE NULL END
          `,
          createdBy: sql<{
            id: string;
            name: string | null;
            email: string | null;
            image: string | null;
          } | null>`
            CASE WHEN ${issues.createdById} IS NOT NULL THEN
              json_build_object(
                'id', created_user.id,
                'name', created_user.name,
                'email', created_user.email,
                'image', created_user."profilePicture"
              )
            ELSE NULL END
          `,
        })
        .from(issues)
        .innerJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
        .innerJoin(priorities, eq(issues.priorityId, priorities.id))
        .innerJoin(machines, eq(issues.machineId, machines.id))
        .innerJoin(models, eq(machines.modelId, models.id))
        .innerJoin(locations, eq(machines.locationId, locations.id))
        .leftJoin(
          sql`${users} as assigned_user`,
          eq(issues.assignedToId, sql`assigned_user.id`),
        )
        .leftJoin(
          sql`${users} as created_user`,
          eq(issues.createdById, sql`created_user.id`),
        )
        .where(whereCondition);

      // Filter issues based on machine-related conditions (since Drizzle query API doesn't support nested where conditions on relations)
      let filteredIssues = allIssues;

      // Note: These filters should be handled at the database level for performance
      // For now, using machine ID field access since relationships may not be loaded
      if (input?.locationId) {
        filteredIssues = filteredIssues.filter(
          (issue) => issue.machine.location.id === input.locationId,
        );
      }

      if (input?.modelId) {
        filteredIssues = filteredIssues.filter(
          (issue) => issue.machine.modelId === input.modelId,
        );
      }

      if (input?.ownerId) {
        filteredIssues = filteredIssues.filter(
          (issue) => issue.machine.ownerId === input.ownerId,
        );
      }

      if (input?.statusCategory) {
        filteredIssues = filteredIssues.filter(
          (issue) => issue.status.category === input.statusCategory,
        );
      }

      // Get comment and attachment counts for each issue
      const issueIds = filteredIssues.map((issue) => issue.id);

      let commentCounts: Record<string, number> = {};
      let attachmentCounts: Record<string, number> = {};

      if (issueIds.length > 0) {
        const commentCountResults = await ctx.drizzle
          .select({
            issueId: comments.issueId,
            count: count(),
          })
          .from(comments)
          .where(inArray(comments.issueId, issueIds))
          .groupBy(comments.issueId);

        const attachmentCountResults = await ctx.drizzle
          .select({
            issueId: attachments.issueId,
            count: count(),
          })
          .from(attachments)
          .where(inArray(attachments.issueId, issueIds))
          .groupBy(attachments.issueId);

        commentCounts = Object.fromEntries(
          commentCountResults.map(({ issueId, count }) => [issueId, count]),
        );
        attachmentCounts = Object.fromEntries(
          attachmentCountResults.map(({ issueId, count }) => [issueId, count]),
        );
      }

      // Map to include counts (image field already handled in SQL query)
      const issuesWithCounts = filteredIssues.map((issue) => ({
        ...issue,
        _count: {
          comments: commentCounts[issue.id] ?? 0,
          attachments: attachmentCounts[issue.id] ?? 0,
        },
      }));

      // Define sort order and apply sorting
      const sortBy = input?.sortBy ?? "created";
      const sortOrder = input?.sortOrder ?? "desc";

      const sortedIssues = issuesWithCounts.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case "created":
            comparison =
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
          case "updated":
            comparison =
              new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
            break;
          case "status":
            comparison = a.status.name.localeCompare(b.status.name);
            break;
          case "severity":
            comparison = a.priority.order - b.priority.order;
            break;
          case "game":
            comparison = a.machine.model.name.localeCompare(
              b.machine.model.name,
            );
            break;
          default:
            comparison =
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return sortOrder === "desc" ? -comparison : comparison;
      });

      return sortedIssues;
    }),

  // Get a single issue by ID
  getById: issueViewProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const issue = await ctx.drizzle.query.issues.findFirst({
        where: and(
          eq(issues.id, input.id),
          eq(issues.organizationId, ctx.organization.id),
        ),
        with: {
          status: true,
          priority: true,
          assignedTo: {
            columns: {
              id: true,
              name: true,
              email: true,
              profilePicture: true,
            },
          },
          createdBy: {
            columns: {
              id: true,
              name: true,
              email: true,
              profilePicture: true,
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
                  profilePicture: true,
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

      // Map to fix image field compatibility and add createdBy alias for comments
      const mappedIssue = {
        ...issue,
        assignedTo: issue.assignedTo
          ? {
              ...issue.assignedTo,
              image: issue.assignedTo.profilePicture,
            }
          : null,
        createdBy: issue.createdBy
          ? {
              ...issue.createdBy,
              image: issue.createdBy.profilePicture,
            }
          : null,
        comments: issue.comments
          .filter(
            (
              comment,
            ): comment is typeof comment & {
              author: NonNullable<typeof comment.author>;
            } =>
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety check for comment authors
              comment.author !== null,
          ) // Filter out comments without authors
          .map((comment) => ({
            ...comment,
            author: {
              ...comment.author,
              image: comment.author.profilePicture,
            },
            createdBy: {
              ...comment.author,
              image: comment.author.profilePicture,
            }, // Add createdBy as alias for author
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
      const existingIssue = await ctx.drizzle.query.issues.findFirst({
        where: and(
          eq(issues.id, input.id),
          eq(issues.organizationId, ctx.organization.id),
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

      // If updating status, verify it belongs to the organization
      if (input.statusId) {
        const status = await ctx.drizzle.query.issueStatuses.findFirst({
          where: and(
            eq(issueStatuses.id, input.statusId),
            eq(issueStatuses.organizationId, ctx.organization.id),
          ),
        });
        if (!status) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid status",
          });
        }
        newStatus = status;
      }

      // If updating assignee, verify they are a member of this organization
      if (input.assignedToId !== undefined) {
        if (input.assignedToId) {
          const membership = await ctx.drizzle.query.memberships.findFirst({
            where: and(
              eq(memberships.userId, input.assignedToId),
              eq(memberships.organizationId, ctx.organization.id),
            ),
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

      // Build update data
      const updateData: Partial<typeof issues.$inferInsert> = {};
      if (input.title) updateData.title = input.title;
      if (input.description !== undefined)
        updateData.description = input.description;
      if (input.statusId) updateData.statusId = input.statusId;
      if (input.assignedToId !== undefined)
        updateData.assignedToId = input.assignedToId ?? null;

      // Update the issue
      const [updatedIssue] = await ctx.drizzle
        .update(issues)
        .set(updateData)
        .where(eq(issues.id, input.id))
        .returning();

      if (!updatedIssue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found",
        });
      }

      // Get the updated issue with all related data
      const issueWithRelations = await ctx.drizzle.query.issues.findFirst({
        where: eq(issues.id, input.id),
        with: {
          status: true,
          assignedTo: {
            columns: {
              id: true,
              name: true,
              email: true,
              profilePicture: true,
            },
          },
          createdBy: {
            columns: {
              id: true,
              name: true,
              email: true,
              profilePicture: true,
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
          code: "NOT_FOUND",
          message: "Updated issue not found",
        });
      }

      // Map to fix image field compatibility
      const issueWithImageAlias = {
        ...issueWithRelations,
        assignedTo: issueWithRelations.assignedTo
          ? {
              ...issueWithRelations.assignedTo,
              image: issueWithRelations.assignedTo.profilePicture,
            }
          : null,
        createdBy: issueWithRelations.createdBy
          ? {
              ...issueWithRelations.createdBy,
              image: issueWithRelations.createdBy.profilePicture,
            }
          : null,
      };

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

      return issueWithImageAlias;
    }),

  // Close an issue (set status to resolved)
  close: issueEditProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Find the resolved status for this organization
      const resolvedStatus = await ctx.drizzle.query.issueStatuses.findFirst({
        where: and(
          eq(issueStatuses.organizationId, ctx.organization.id),
          eq(issueStatuses.category, "RESOLVED"),
        ),
      });

      if (!resolvedStatus) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No resolved status found for this organization",
        });
      }

      // Update the issue
      const [updatedIssue] = await ctx.drizzle
        .update(issues)
        .set({
          statusId: resolvedStatus.id,
          resolvedAt: new Date(),
        })
        .where(eq(issues.id, input.id))
        .returning();

      if (!updatedIssue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found",
        });
      }

      // Get the updated issue with all related data
      const issueWithRelations = await ctx.drizzle.query.issues.findFirst({
        where: eq(issues.id, input.id),
        with: {
          status: true,
          priority: true,
          assignedTo: {
            columns: {
              id: true,
              name: true,
              email: true,
              profilePicture: true,
            },
          },
          createdBy: {
            columns: {
              id: true,
              name: true,
              email: true,
              profilePicture: true,
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
          code: "NOT_FOUND",
          message: "Updated issue not found",
        });
      }

      // Map to fix image field compatibility
      const issueWithImageAlias = {
        ...issueWithRelations,
        assignedTo: issueWithRelations.assignedTo
          ? {
              ...issueWithRelations.assignedTo,
              image: issueWithRelations.assignedTo.profilePicture,
            }
          : null,
        createdBy: issueWithRelations.createdBy
          ? {
              ...issueWithRelations.createdBy,
              image: issueWithRelations.createdBy.profilePicture,
            }
          : null,
      };

      // Record activity
      const activityService = ctx.services.createIssueActivityService();
      await activityService.recordIssueResolved(
        input.id,
        ctx.organization.id,
        ctx.user.id,
      );

      return issueWithImageAlias;
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
      const existingIssue = await ctx.drizzle.query.issues.findFirst({
        where: and(
          eq(issues.id, input.id),
          eq(issues.organizationId, ctx.organization.id),
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

      // Verify the status belongs to this organization
      const newStatus = await ctx.drizzle.query.issueStatuses.findFirst({
        where: and(
          eq(issueStatuses.id, input.statusId),
          eq(issueStatuses.organizationId, ctx.organization.id),
        ),
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

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety check for data integrity
      if (!existingIssue.status) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Issue status not found",
        });
      }

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
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validationResult.error ?? "Invalid status transition",
        });
      }

      // Get status change effects using extracted function
      const effects = getStatusChangeEffects(existingIssue.status, newStatus);

      // Build update data
      const updateData: Partial<typeof issues.$inferInsert> = {
        statusId: input.statusId,
      };
      if (effects.shouldSetResolvedAt) updateData.resolvedAt = new Date();
      if (effects.shouldClearResolvedAt) updateData.resolvedAt = null;

      // Update the issue
      const [updatedIssue] = await ctx.drizzle
        .update(issues)
        .set(updateData)
        .where(eq(issues.id, input.id))
        .returning();

      if (!updatedIssue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found",
        });
      }

      // Get the updated issue with all related data
      const issueWithRelations = await ctx.drizzle.query.issues.findFirst({
        where: eq(issues.id, input.id),
        with: {
          status: true,
          priority: true,
          assignedTo: {
            columns: {
              id: true,
              name: true,
              email: true,
              profilePicture: true,
            },
          },
          createdBy: {
            columns: {
              id: true,
              name: true,
              email: true,
              profilePicture: true,
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
          code: "NOT_FOUND",
          message: "Updated issue not found",
        });
      }

      // Map to fix image field compatibility
      const issueWithImageAlias = {
        ...issueWithRelations,
        assignedTo: issueWithRelations.assignedTo
          ? {
              ...issueWithRelations.assignedTo,
              image: issueWithRelations.assignedTo.profilePicture,
            }
          : null,
        createdBy: issueWithRelations.createdBy
          ? {
              ...issueWithRelations.createdBy,
              image: issueWithRelations.createdBy.profilePicture,
            }
          : null,
      };

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

      return issueWithImageAlias;
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
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Build Drizzle where conditions
      const conditions = [eq(issues.organizationId, organization.id)];

      // Machine-related filters
      if (input?.machineId) {
        conditions.push(eq(issues.machineId, input.machineId));
      }

      // Status filtering
      if (input?.statusId) {
        conditions.push(eq(issues.statusId, input.statusId));
      }

      // Build the final where condition
      const whereCondition =
        conditions.length > 1
          ? and(...conditions)
          : conditions.length === 1
            ? conditions[0]
            : undefined;

      // For public API, use the query API which handles relationships better
      const allIssues = await ctx.drizzle.query.issues.findMany({
        where: whereCondition,
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
              profilePicture: true,
            },
          },
          createdBy: {
            columns: {
              id: true,
              name: true,
              email: true,
              profilePicture: true,
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

      // Filter issues based on additional conditions
      let filteredIssues = allIssues;

      if (input?.locationId) {
        filteredIssues = filteredIssues.filter(
          (issue) => issue.machine.location.id === input.locationId,
        );
      }

      if (input?.modelId) {
        filteredIssues = filteredIssues.filter(
          (issue) => issue.machine.modelId === input.modelId,
        );
      }

      if (input?.statusCategory) {
        filteredIssues = filteredIssues.filter(
          (issue) => issue.status.category === input.statusCategory,
        );
      }

      // Map to include image field compatibility
      const issuesWithImageAlias = filteredIssues.map((issue) => ({
        ...issue,
        assignedTo: issue.assignedTo
          ? {
              ...issue.assignedTo,
              image: issue.assignedTo.profilePicture,
            }
          : null,
        createdBy: issue.createdBy
          ? {
              ...issue.createdBy,
              image: issue.createdBy.profilePicture,
            }
          : null,
      }));

      // Define sort order and apply sorting
      const sortBy = input?.sortBy ?? "created";
      const sortOrder = input?.sortOrder ?? "desc";

      const sortedIssues = issuesWithImageAlias.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case "created":
            comparison =
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
          case "updated":
            comparison =
              new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
            break;
          case "status":
            comparison = a.status.name.localeCompare(b.status.name);
            break;
          case "severity":
            comparison = a.priority.order - b.priority.order;
            break;
          case "game":
            comparison = a.machine.model.name.localeCompare(
              b.machine.model.name,
            );
            break;
          default:
            comparison =
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return sortOrder === "desc" ? -comparison : comparison;
      });

      // Apply limit for public access
      const limit = input?.limit ?? 20;
      return sortedIssues.slice(0, limit);
    }),
});

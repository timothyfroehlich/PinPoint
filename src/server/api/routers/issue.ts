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
              location: true,
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
        gameInstance?: { locationId: string };
        gameInstanceId?: string;
        statusId?: string;
      } = {
        organizationId: ctx.organization.id,
      };

      if (input?.locationId) {
        whereClause.gameInstance = {
          locationId: input.locationId,
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
              location: true,
            },
          },
          _count: {
            select: {
              comments: true,
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
              location: true,
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
              location: true,
            },
          },
        },
      });
    }),
});

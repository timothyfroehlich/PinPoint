import { and, asc, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { imageStorage } from "~/lib/image-storage/local-storage";
import { getDefaultAvatarUrl } from "~/lib/utils/image-processing";
import {
  createTRPCRouter,
  protectedProcedure,
  organizationProcedure,
} from "~/server/api/trpc";
import { userManageProcedure } from "~/server/api/trpc.permission";
import {
  users,
  memberships,
  roles,
  machines,
  issues,
  comments,
} from "~/server/db/schema";

export const userRouter = createTRPCRouter({
  // Get current user's profile
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.user.id },
      include: {
        ownedMachines: {
          include: {
            model: true,
            location: true,
          },
        },
        memberships: {
          include: {
            organization: true,
            role: true,
          },
        },
        _count: {
          select: {
            issuesCreated: true,
            comments: true,
            ownedMachines: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }),

  // Get current user's membership info in the current organization
  getCurrentMembership: organizationProcedure.query(({ ctx }) => {
    return {
      userId: ctx.membership.userId,
      role: ctx.membership.role.name,
      organizationId: ctx.membership.organizationId,
      permissions: ctx.userPermissions,
    };
  }),

  // Update user profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        bio: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // PARALLEL VALIDATION: Execute both Prisma and Drizzle queries during migration
      // This ensures exact functional parity before switching fully to Drizzle

      // Prepare update data (same logic for both ORMs)
      const updateData: { name?: string; bio?: string } = {};
      if (input.name !== undefined) {
        updateData.name = input.name;
      }
      if (input.bio !== undefined) {
        updateData.bio = input.bio;
      }

      // Execute Prisma query (current implementation)
      const prismaUser = await ctx.db.user.update({
        where: { id: ctx.user.id },
        data: updateData,
      });

      // Execute Drizzle query (new implementation)
      const [drizzleUser] = await ctx.drizzle
        .update(users)
        .set(updateData)
        .where(eq(users.id, ctx.user.id))
        .returning();

      // Validation: Ensure both queries return equivalent results
      if (!drizzleUser) {
        throw new Error("User update failed - no result returned from Drizzle");
      }

      // Compare critical fields to ensure parity
      if (
        prismaUser.id !== drizzleUser.id ||
        prismaUser.name !== drizzleUser.name ||
        prismaUser.bio !== drizzleUser.bio
      ) {
        console.error("MIGRATION WARNING: Prisma and Drizzle results differ", {
          prisma: prismaUser,
          drizzle: drizzleUser,
        });
        // For now, log the discrepancy but don't fail - return Prisma result for consistency
      }

      // Return Prisma result to maintain current behavior during parallel validation
      // TODO: Switch to drizzleUser after validation period
      return prismaUser;
    }),

  // Upload profile picture
  uploadProfilePicture: protectedProcedure
    .input(
      z.object({
        imageData: z.string(), // Base64 encoded image data
        filename: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Convert base64 to File object
        const response = await fetch(input.imageData);
        const blob = await response.blob();
        const file = new File([blob], input.filename, { type: blob.type });

        // Upload image
        const imagePath = await imageStorage.uploadImage(
          file,
          `user-${ctx.user.id}`,
        );

        // PARALLEL VALIDATION: Execute both Prisma and Drizzle queries during migration
        // This ensures exact functional parity before switching fully to Drizzle

        // Delete old profile picture if it exists
        const prismaCurrentUser = await ctx.db.user.findUnique({
          where: { id: ctx.user.id },
          select: { profilePicture: true },
        });

        // Execute equivalent Drizzle query for current user lookup
        const [drizzleCurrentUser] = await ctx.drizzle
          .select({ profilePicture: users.profilePicture })
          .from(users)
          .where(eq(users.id, ctx.user.id))
          .limit(1);

        // Validation: Ensure both queries return equivalent results
        if (
          prismaCurrentUser?.profilePicture !==
          drizzleCurrentUser?.profilePicture
        ) {
          console.error(
            "MIGRATION WARNING: Prisma and Drizzle profile picture lookup differ",
            {
              prisma: prismaCurrentUser,
              drizzle: drizzleCurrentUser,
            },
          );
        }

        if (
          prismaCurrentUser?.profilePicture &&
          !prismaCurrentUser.profilePicture.includes("default-avatar")
        ) {
          try {
            await imageStorage.deleteImage(prismaCurrentUser.profilePicture);
          } catch (error) {
            // Ignore deletion errors for old files
            ctx.logger.warn({
              msg: "Failed to delete old profile picture",
              component: "userRouter.uploadProfilePicture",
              context: {
                userId: ctx.user.id,
                oldProfilePicture: prismaCurrentUser.profilePicture,
                operation: "delete_old_image",
              },
              error: {
                message: error instanceof Error ? error.message : String(error),
              },
            });
          }
        }

        // Update user's profile picture
        const prismaUpdatedUser = await ctx.db.user.update({
          where: { id: ctx.user.id },
          data: { profilePicture: imagePath },
        });

        // Execute equivalent Drizzle query for profile picture update
        const [drizzleUpdatedUser] = await ctx.drizzle
          .update(users)
          .set({ profilePicture: imagePath })
          .where(eq(users.id, ctx.user.id))
          .returning();

        // Validation: Ensure both update queries return equivalent results
        if (!drizzleUpdatedUser) {
          throw new Error(
            "Profile picture update failed - no result returned from Drizzle",
          );
        }

        if (
          prismaUpdatedUser.id !== drizzleUpdatedUser.id ||
          prismaUpdatedUser.profilePicture !== drizzleUpdatedUser.profilePicture
        ) {
          console.error(
            "MIGRATION WARNING: Prisma and Drizzle profile picture update differ",
            {
              prisma: prismaUpdatedUser,
              drizzle: drizzleUpdatedUser,
            },
          );
        }

        // Return Prisma result to maintain current behavior during parallel validation
        // TODO: Switch to drizzleUpdatedUser after validation period
        return {
          success: true,
          profilePicture: prismaUpdatedUser.profilePicture,
        };
      } catch (error) {
        ctx.logger.error({
          msg: "Profile picture upload error",
          component: "userRouter.uploadProfilePicture",
          context: {
            userId: ctx.user.id,
            filename: input.filename,
            operation: "upload_profile_picture",
          },
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        });
        throw new Error("Failed to upload profile picture");
      }
    }),

  // Get user by ID (public info only - within organization context)
  getUser: organizationProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      // PARALLEL VALIDATION: Execute both Prisma and Drizzle queries during migration
      // This ensures exact functional parity before switching fully to Drizzle

      // Verify user is a member of the current organization
      const prismaMembership = await ctx.db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: input.userId,
            organizationId: ctx.membership.organizationId,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              bio: true,
              profilePicture: true,
              createdAt: true,
              _count: {
                select: {
                  ownedMachines: true,
                  issuesCreated: true,
                  comments: true,
                },
              },
            },
          },
        },
      });

      // Execute equivalent Drizzle query with joins and counts
      const [drizzleMembership] = await ctx.drizzle
        .select({
          user: {
            id: users.id,
            name: users.name,
            bio: users.bio,
            profilePicture: users.profilePicture,
            createdAt: users.createdAt,
          },
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
        .where(
          and(
            eq(memberships.userId, input.userId),
            eq(memberships.organizationId, ctx.membership.organizationId),
          ),
        )
        .limit(1);

      // Get counts separately for Drizzle (since _count is a Prisma-specific feature)
      const [ownedMachinesCount, issuesCreatedCount, commentsCount] =
        await Promise.all([
          ctx.drizzle
            .select({ count: count() })
            .from(machines)
            .where(eq(machines.ownerId, input.userId)),
          ctx.drizzle
            .select({ count: count() })
            .from(issues)
            .where(eq(issues.createdById, input.userId)),
          ctx.drizzle
            .select({ count: count() })
            .from(comments)
            .where(eq(comments.authorId, input.userId)),
        ]);

      // Validation: Check if user was found in both queries
      if (!prismaMembership && !drizzleMembership) {
        throw new Error("User not found in this organization");
      }

      if (!!prismaMembership !== !!drizzleMembership) {
        console.error(
          "MIGRATION WARNING: Prisma and Drizzle membership lookup differ",
          {
            prismaFound: !!prismaMembership,
            drizzleFound: !!drizzleMembership,
            userId: input.userId,
            organizationId: ctx.membership.organizationId,
          },
        );
      }

      if (!prismaMembership) {
        throw new Error("User not found in this organization");
      }

      // Validation: Compare the user data structure
      if (drizzleMembership) {
        const prismaUser = prismaMembership.user;
        const drizzleUser = drizzleMembership.user;

        if (
          prismaUser.id !== drizzleUser.id ||
          prismaUser.name !== drizzleUser.name ||
          prismaUser.bio !== drizzleUser.bio ||
          prismaUser.profilePicture !== drizzleUser.profilePicture
        ) {
          console.error(
            "MIGRATION WARNING: Prisma and Drizzle user data differ",
            {
              prisma: prismaUser,
              drizzle: drizzleUser,
            },
          );
        }

        // Validation: Compare counts
        const prismaCounts = prismaMembership.user._count;
        const drizzleCounts = {
          ownedMachines: ownedMachinesCount[0]?.count ?? 0,
          issuesCreated: issuesCreatedCount[0]?.count ?? 0,
          comments: commentsCount[0]?.count ?? 0,
        };

        if (
          prismaCounts.ownedMachines !== drizzleCounts.ownedMachines ||
          prismaCounts.issuesCreated !== drizzleCounts.issuesCreated ||
          prismaCounts.comments !== drizzleCounts.comments
        ) {
          console.error(
            "MIGRATION WARNING: Prisma and Drizzle user counts differ",
            {
              prisma: prismaCounts,
              drizzle: drizzleCounts,
            },
          );
        }
      }

      // Return Prisma result to maintain current behavior during parallel validation
      // TODO: Switch to drizzle result after validation period
      return prismaMembership.user;
    }),

  // Get all users in the current organization
  getAllInOrganization: organizationProcedure.query(async ({ ctx }) => {
    // PARALLEL VALIDATION: Execute both Prisma and Drizzle queries during migration
    // This ensures exact functional parity before switching fully to Drizzle

    const prismaMemberships = await ctx.db.membership.findMany({
      where: { organizationId: ctx.membership.organizationId },
      include: {
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            bio: true,
            profilePicture: true,
            createdAt: true,
            _count: {
              select: {
                ownedMachines: true,
                issuesCreated: true,
                comments: true,
              },
            },
          },
        },
      },
      orderBy: {
        user: {
          name: "asc",
        },
      },
    });

    // Execute equivalent Drizzle query with joins and ordering
    const drizzleMemberships = await ctx.drizzle
      .select({
        user: {
          id: users.id,
          name: users.name,
          bio: users.bio,
          profilePicture: users.profilePicture,
          createdAt: users.createdAt,
        },
        role: {
          name: roles.name,
        },
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .where(eq(memberships.organizationId, ctx.membership.organizationId))
      .orderBy(asc(users.name));

    // For Drizzle, get counts for each user (batched approach)
    const userIds = drizzleMemberships.map((m) => m.user.id);
    const userCounts = new Map<
      string,
      { ownedMachines: number; issuesCreated: number; comments: number }
    >();

    if (userIds.length > 0) {
      // Get all counts in parallel for better performance
      const [machinesCountRows, issuesCountRows, commentsCountRows] =
        await Promise.all([
          ctx.drizzle
            .select({
              userId: machines.ownerId,
              count: count(),
            })
            .from(machines)
            .where(inArray(machines.ownerId, userIds))
            .groupBy(machines.ownerId),
          ctx.drizzle
            .select({
              userId: issues.createdById,
              count: count(),
            })
            .from(issues)
            .where(inArray(issues.createdById, userIds))
            .groupBy(issues.createdById),
          ctx.drizzle
            .select({
              userId: comments.authorId,
              count: count(),
            })
            .from(comments)
            .where(inArray(comments.authorId, userIds))
            .groupBy(comments.authorId),
        ]);

      // Initialize counts for all users
      userIds.forEach((userId) => {
        userCounts.set(userId, {
          ownedMachines: 0,
          issuesCreated: 0,
          comments: 0,
        });
      });

      // Populate actual counts
      machinesCountRows.forEach((row) => {
        if (row.userId) {
          const existing = userCounts.get(row.userId);
          if (existing) existing.ownedMachines = row.count;
        }
      });
      issuesCountRows.forEach((row) => {
        if (row.userId) {
          const existing = userCounts.get(row.userId);
          if (existing) existing.issuesCreated = row.count;
        }
      });
      commentsCountRows.forEach((row) => {
        const existing = userCounts.get(row.userId);
        if (existing) existing.comments = row.count;
      });
    }

    // Validation: Compare results
    if (prismaMemberships.length !== drizzleMemberships.length) {
      console.error(
        "MIGRATION WARNING: Prisma and Drizzle membership count differ",
        {
          prismaCount: prismaMemberships.length,
          drizzleCount: drizzleMemberships.length,
        },
      );
    }

    // Validation: Compare user data for the first few entries
    const sampleSize = Math.min(3, prismaMemberships.length);
    for (let i = 0; i < sampleSize; i++) {
      const prismaItem = prismaMemberships[i];
      const drizzleItem = drizzleMemberships[i];

      if (
        prismaItem?.user.id !== drizzleItem?.user.id ||
        prismaItem?.user.name !== drizzleItem?.user.name ||
        prismaItem?.role.name !== drizzleItem?.role.name
      ) {
        console.error(
          `MIGRATION WARNING: Prisma and Drizzle membership ${i.toString()} differ`,
          {
            prisma: prismaItem,
            drizzle: drizzleItem,
          },
        );
      }
    }

    // Return Prisma result to maintain current behavior during parallel validation
    // TODO: Switch to drizzle result after validation period
    return prismaMemberships.map((m) => ({
      ...m.user,
      role: m.role.name,
    }));
  }),

  // Assign default avatar to user (used during account creation)
  assignDefaultAvatar: protectedProcedure.mutation(async ({ ctx }) => {
    // PARALLEL VALIDATION: Execute both Prisma and Drizzle queries during migration
    // This ensures exact functional parity before switching fully to Drizzle

    const prismaUser = await ctx.db.user.findUnique({
      where: { id: ctx.user.id },
      select: { profilePicture: true },
    });

    // Execute equivalent Drizzle query for current user lookup
    const [drizzleUser] = await ctx.drizzle
      .select({ profilePicture: users.profilePicture })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    // Validation: Ensure both queries return equivalent results
    if (prismaUser?.profilePicture !== drizzleUser?.profilePicture) {
      console.error(
        "MIGRATION WARNING: Prisma and Drizzle assignDefaultAvatar lookup differ",
        {
          prisma: prismaUser,
          drizzle: drizzleUser,
        },
      );
    }

    // Only assign if user doesn't already have a profile picture
    if (!prismaUser?.profilePicture) {
      const defaultAvatarUrl = getDefaultAvatarUrl();

      // Execute Prisma update
      await ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { profilePicture: defaultAvatarUrl },
      });

      // Execute equivalent Drizzle update
      const [drizzleUpdatedUser] = await ctx.drizzle
        .update(users)
        .set({ profilePicture: defaultAvatarUrl })
        .where(eq(users.id, ctx.user.id))
        .returning({ profilePicture: users.profilePicture });

      // Validation: Ensure both update queries succeed
      if (!drizzleUpdatedUser) {
        throw new Error(
          "Default avatar assignment failed - no result returned from Drizzle",
        );
      }

      if (drizzleUpdatedUser.profilePicture !== defaultAvatarUrl) {
        console.error(
          "MIGRATION WARNING: Prisma and Drizzle default avatar assignment differ",
          {
            expected: defaultAvatarUrl,
            drizzleResult: drizzleUpdatedUser.profilePicture,
          },
        );
      }

      return { profilePicture: defaultAvatarUrl };
    }

    return { profilePicture: prismaUser.profilePicture };
  }),

  // Update user membership (role assignment)
  updateMembership: userManageProcedure
    .input(
      z.object({
        userId: z.string(),
        roleId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the role exists and belongs to the current organization
      const role = await ctx.db.role.findUnique({
        where: { id: input.roleId },
      });

      if (!role || role.organizationId !== ctx.organization.id) {
        throw new Error(
          "Role not found or does not belong to this organization",
        );
      }

      // Verify the user is a member of the current organization
      const membership = await ctx.db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: input.userId,
            organizationId: ctx.organization.id,
          },
        },
      });

      if (!membership) {
        throw new Error("User is not a member of this organization");
      }

      // Update the membership
      const updatedMembership = await ctx.db.membership.update({
        where: {
          userId_organizationId: {
            userId: input.userId,
            organizationId: ctx.organization.id,
          },
        },
        data: { roleId: input.roleId },
        include: {
          role: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return {
        success: true,
        membership: {
          userId: updatedMembership.userId,
          roleId: updatedMembership.roleId,
          role: updatedMembership.role.name,
          user: updatedMembership.user,
        },
      };
    }),
});

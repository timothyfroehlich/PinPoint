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
    const user = await ctx.drizzle.query.users.findFirst({
      where: eq(users.id, ctx.user.id),
      with: {
        ownedMachines: {
          with: {
            model: true,
            location: true,
          },
        },
        memberships: {
          with: {
            organization: true,
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Get counts separately using individual queries
    const [ownedMachinesCount, issuesCreatedCount, commentsCount] =
      await Promise.all([
        ctx.drizzle
          .select({ count: count() })
          .from(machines)
          .where(eq(machines.ownerId, ctx.user.id)),
        ctx.drizzle
          .select({ count: count() })
          .from(issues)
          .where(eq(issues.createdById, ctx.user.id)),
        ctx.drizzle
          .select({ count: count() })
          .from(comments)
          .where(eq(comments.authorId, ctx.user.id)),
      ]);

    return {
      ...user,
      _count: {
        ownedMachines: ownedMachinesCount[0]?.count ?? 0,
        issuesCreated: issuesCreatedCount[0]?.count ?? 0,
        comments: commentsCount[0]?.count ?? 0,
      },
    };
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
      // Prepare update data
      const updateData: { name?: string; bio?: string } = {};
      if (input.name !== undefined) {
        updateData.name = input.name;
      }
      if (input.bio !== undefined) {
        updateData.bio = input.bio;
      }

      const [user] = await ctx.drizzle
        .update(users)
        .set(updateData)
        .where(eq(users.id, ctx.user.id))
        .returning();

      if (!user) {
        throw new Error("User update failed");
      }

      return user;
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

        // Delete old profile picture if it exists
        const [currentUser] = await ctx.drizzle
          .select({ profilePicture: users.profilePicture })
          .from(users)
          .where(eq(users.id, ctx.user.id))
          .limit(1);

        if (
          currentUser?.profilePicture &&
          !currentUser.profilePicture.includes("default-avatar")
        ) {
          try {
            await imageStorage.deleteImage(currentUser.profilePicture);
          } catch (error) {
            // Ignore deletion errors for old files
            ctx.logger.warn({
              msg: "Failed to delete old profile picture",
              component: "userRouter.uploadProfilePicture",
              context: {
                userId: ctx.user.id,
                oldProfilePicture: currentUser.profilePicture,
                operation: "delete_old_image",
              },
              error: {
                message: error instanceof Error ? error.message : String(error),
              },
            });
          }
        }

        // Update user's profile picture
        const [updatedUser] = await ctx.drizzle
          .update(users)
          .set({ profilePicture: imagePath })
          .where(eq(users.id, ctx.user.id))
          .returning();

        if (!updatedUser) {
          throw new Error("Profile picture update failed");
        }

        return {
          success: true,
          profilePicture: updatedUser.profilePicture,
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
      // Verify user is a member of the current organization
      const [membership] = await ctx.drizzle
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

      if (!membership) {
        throw new Error("User not found in this organization");
      }

      // Get counts separately using individual queries
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

      return {
        ...membership.user,
        _count: {
          ownedMachines: ownedMachinesCount[0]?.count ?? 0,
          issuesCreated: issuesCreatedCount[0]?.count ?? 0,
          comments: commentsCount[0]?.count ?? 0,
        },
      };
    }),

  // Get all users in the current organization
  getAllInOrganization: organizationProcedure.query(async ({ ctx }) => {
    // Get memberships with user and role data
    const membershipData = await ctx.drizzle
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

    // Get counts for each user (batched approach for performance)
    const userIds = membershipData.map((m) => m.user.id);
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
          const existingCounts = userCounts.get(row.userId);
          if (existingCounts) existingCounts.ownedMachines = row.count;
        }
      });
      issuesCountRows.forEach((row) => {
        if (row.userId) {
          const existingCounts = userCounts.get(row.userId);
          if (existingCounts) existingCounts.issuesCreated = row.count;
        }
      });
      commentsCountRows.forEach((row) => {
        const existingCounts = userCounts.get(row.userId);
        if (existingCounts) existingCounts.comments = row.count;
      });
    }

    // Combine user data with counts
    return membershipData.map((m) => {
      const counts = userCounts.get(m.user.id) ?? {
        ownedMachines: 0,
        issuesCreated: 0,
        comments: 0,
      };

      return {
        ...m.user,
        _count: counts,
        role: m.role.name,
      };
    });
  }),

  // Assign default avatar to user (used during account creation)
  assignDefaultAvatar: protectedProcedure.mutation(async ({ ctx }) => {
    const [user] = await ctx.drizzle
      .select({ profilePicture: users.profilePicture })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    // Only assign if user doesn't already have a profile picture
    if (!user?.profilePicture) {
      const defaultAvatarUrl = getDefaultAvatarUrl();

      const [updatedUser] = await ctx.drizzle
        .update(users)
        .set({ profilePicture: defaultAvatarUrl })
        .where(eq(users.id, ctx.user.id))
        .returning({ profilePicture: users.profilePicture });

      if (!updatedUser) {
        throw new Error("Default avatar assignment failed");
      }

      return { profilePicture: updatedUser.profilePicture };
    }

    return { profilePicture: user.profilePicture };
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
      const [role] = await ctx.drizzle
        .select({ organizationId: roles.organizationId })
        .from(roles)
        .where(eq(roles.id, input.roleId))
        .limit(1);

      if (!role || role.organizationId !== ctx.organization.id) {
        throw new Error(
          "Role not found or does not belong to this organization",
        );
      }

      // Verify the user is a member of the current organization
      const [membership] = await ctx.drizzle
        .select({ userId: memberships.userId })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, input.userId),
            eq(memberships.organizationId, ctx.organization.id),
          ),
        )
        .limit(1);

      if (!membership) {
        throw new Error("User is not a member of this organization");
      }

      // Update the membership
      const [updatedMembership] = await ctx.drizzle
        .update(memberships)
        .set({ roleId: input.roleId })
        .where(
          and(
            eq(memberships.userId, input.userId),
            eq(memberships.organizationId, ctx.organization.id),
          ),
        )
        .returning();

      if (!updatedMembership) {
        throw new Error("Failed to update membership");
      }

      // Get the updated role and user details for response
      const [membershipDetails] = await ctx.drizzle
        .select({
          userId: memberships.userId,
          roleId: memberships.roleId,
          roleName: roles.name,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(memberships)
        .innerJoin(roles, eq(memberships.roleId, roles.id))
        .innerJoin(users, eq(memberships.userId, users.id))
        .where(
          and(
            eq(memberships.userId, input.userId),
            eq(memberships.organizationId, ctx.organization.id),
          ),
        )
        .limit(1);

      if (!membershipDetails) {
        throw new Error("Failed to retrieve updated membership details");
      }

      return {
        success: true,
        membership: {
          userId: membershipDetails.userId,
          roleId: membershipDetails.roleId,
          role: membershipDetails.roleName,
          user: membershipDetails.user,
        },
      };
    }),
});

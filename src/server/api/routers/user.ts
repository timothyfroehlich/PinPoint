// External libraries (alphabetical)
import { TRPCError } from "@trpc/server";
import { asc, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";

// Internal types (alphabetical)
import type {
  UserMembershipResponse,
  UserProfileResponse,
  UserResponse,
} from "~/lib/types/api";

// Internal utilities (alphabetical)
import { imageStorage } from "~/lib/image-storage/local-storage";
import { transformKeysToCamelCase } from "~/lib/utils/case-transformers";
import { getDefaultAvatarUrl } from "~/lib/utils/image-processing";

// Server modules (alphabetical)
import { getUserPermissionsForSupabaseUser } from "~/server/auth/permissions";
import {
  createTRPCRouter,
  orgScopedProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { userManageProcedure } from "~/server/api/trpc.permission";

// Database schema (alphabetical)
import {
  comments,
  issues,
  machines,
  memberships,
  roles,
  users,
} from "~/server/db/schema";
import { type User } from "~/server/db/types";

export const userRouter = createTRPCRouter({
  // Get current user's profile
  getProfile: protectedProcedure.query(
    async ({ ctx }): Promise<UserProfileResponse> => {
      const user = await ctx.db.query.users.findFirst({
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
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Get counts separately using individual queries
      const [ownedMachinesCount, issuesCreatedCount, commentsCount] =
        await Promise.all([
          ctx.db
            .select({ count: count() })
            .from(machines)
            .where(eq(machines.owner_id, ctx.user.id)),
          ctx.db
            .select({ count: count() })
            .from(issues)
            .where(eq(issues.created_by_id, ctx.user.id)),
          ctx.db
            .select({ count: count() })
            .from(comments)
            .where(eq(comments.author_id, ctx.user.id)),
        ]);

      return {
        id: user.id,
        name: user.name,
        bio: user.bio,
        profilePicture: user.profile_picture,
        createdAt: user.created_at,
        ownedMachines: transformKeysToCamelCase(
          user.ownedMachines,
        ) as UserProfileResponse["ownedMachines"],
        memberships: transformKeysToCamelCase(
          user.memberships,
        ) as UserProfileResponse["memberships"],
        _count: {
          ownedMachines: ownedMachinesCount[0]?.count ?? 0,
          issuesCreated: issuesCreatedCount[0]?.count ?? 0,
          comments: commentsCount[0]?.count ?? 0,
        },
      };
    },
  ),

  // Get current user's membership info in the current organization
  getCurrentMembership: orgScopedProcedure.query(
    async ({ ctx }): Promise<UserMembershipResponse> => {
      // RLS handles organizational scoping automatically
      const membership = await ctx.db.query.memberships.findFirst({
        where: eq(memberships.user_id, ctx.user.id),
        with: {
          role: true,
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User membership not found",
        });
      }

      // Get user permissions separately
      const userPermissions = await getUserPermissionsForSupabaseUser(
        ctx.user,
        ctx.db,
      );

      return {
        userId: membership.user_id,
        role: membership.role.name,
        organizationId: membership.organization_id,
        permissions: userPermissions,
      };
    },
  ),

  // Update user profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        bio: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<User> => {
      // Prepare update data
      const updateData: { name?: string; bio?: string } = {};
      if (input.name !== undefined) {
        updateData.name = input.name;
      }
      if (input.bio !== undefined) {
        updateData.bio = input.bio;
      }

      const [user] = await ctx.db
        .update(users)
        .set(updateData)
        .where(eq(users.id, ctx.user.id))
        .returning();

      if (!user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User update failed",
        });
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
    .mutation(
      async ({
        ctx,
        input,
      }): Promise<{ success: boolean; profilePicture: string }> => {
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
          const [currentUser] = await ctx.db
            .select({ profilePicture: users.profile_picture })
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
                  message:
                    error instanceof Error ? error.message : String(error),
                },
              });
            }
          }

          // Update user's profile picture
          const [updatedUser] = await ctx.db
            .update(users)
            .set({ profile_picture: imagePath })
            .where(eq(users.id, ctx.user.id))
            .returning({ profilePicture: users.profile_picture });

          if (!updatedUser) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Profile picture update failed",
            });
          }

          return {
            success: true,
            profilePicture: updatedUser.profilePicture ?? imagePath,
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
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to upload profile picture",
          });
        }
      },
    ),

  // Get user by ID (public info only - within organization context)
  getUser: orgScopedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }): Promise<UserResponse> => {
      // Verify user is a member of the current organization (RLS handles org scoping)
      const [membership] = await ctx.db
        .select({
          user: {
            id: users.id,
            name: users.name,
            bio: users.bio,
            profilePicture: users.profile_picture,
            createdAt: users.created_at,
          },
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.user_id, users.id))
        .where(eq(memberships.user_id, input.userId))
        .limit(1);

      if (!membership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in this organization",
        });
      }

      // Get counts separately using individual queries
      const [ownedMachinesCount, issuesCreatedCount, commentsCount] =
        await Promise.all([
          ctx.db
            .select({ count: count() })
            .from(machines)
            .where(eq(machines.owner_id, input.userId)),
          ctx.db
            .select({ count: count() })
            .from(issues)
            .where(eq(issues.created_by_id, input.userId)),
          ctx.db
            .select({ count: count() })
            .from(comments)
            .where(eq(comments.author_id, input.userId)),
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
  getAllInOrganization: orgScopedProcedure.query(
    async ({ ctx }): Promise<UserResponse[]> => {
      // Get memberships with user and role data
      const membershipData = await ctx.db
        .select({
          user: {
            id: users.id,
            name: users.name,
            bio: users.bio,
            profilePicture: users.profile_picture,
            createdAt: users.created_at,
          },
          role: {
            name: roles.name,
          },
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.user_id, users.id))
        .innerJoin(roles, eq(memberships.role_id, roles.id))
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
            ctx.db
              .select({
                userId: machines.owner_id,
                count: count(),
              })
              .from(machines)
              .where(inArray(machines.owner_id, userIds))
              .groupBy(machines.owner_id),
            ctx.db
              .select({
                userId: issues.created_by_id,
                count: count(),
              })
              .from(issues)
              .where(inArray(issues.created_by_id, userIds))
              .groupBy(issues.created_by_id),
            ctx.db
              .select({
                userId: comments.author_id,
                count: count(),
              })
              .from(comments)
              .where(inArray(comments.author_id, userIds))
              .groupBy(comments.author_id),
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
    },
  ),

  // Assign default avatar to user (used during account creation)
  assignDefaultAvatar: protectedProcedure.mutation(
    async ({ ctx }): Promise<{ profilePicture: string }> => {
      const [user] = await ctx.db
        .select({ profilePicture: users.profile_picture })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      // Only assign if user doesn't already have a profile picture
      if (!user?.profilePicture) {
        const defaultAvatarUrl = getDefaultAvatarUrl();

        const [updatedUser] = await ctx.db
          .update(users)
          .set({ profile_picture: defaultAvatarUrl })
          .where(eq(users.id, ctx.user.id))
          .returning({ profilePicture: users.profile_picture });

        if (!updatedUser) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Default avatar assignment failed",
          });
        }

        return { profilePicture: updatedUser.profilePicture ?? "" };
      }

      return { profilePicture: user.profilePicture || "" };
    },
  ),

  // Update user membership (role assignment)
  updateMembership: userManageProcedure
    .input(
      z.object({
        userId: z.string(),
        roleId: z.string(),
      }),
    )
    .mutation(
      async ({
        ctx,
        input,
      }): Promise<{ success: boolean; membership: object }> => {
        // Verify the role exists
        const [role] = await ctx.db
          .select({ id: roles.id })
          .from(roles)
          .where(eq(roles.id, input.roleId))
          .limit(1);

        if (!role) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Role not found",
          });
        }

        // Verify the user is a member
        const [membership] = await ctx.db
          .select({ userId: memberships.user_id })
          .from(memberships)
          .where(eq(memberships.user_id, input.userId))
          .limit(1);

        if (!membership) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User membership not found",
          });
        }

        // Update the membership
        const [updatedMembership] = await ctx.db
          .update(memberships)
          .set({ role_id: input.roleId })
          .where(eq(memberships.user_id, input.userId))
          .returning();

        if (!updatedMembership) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update membership",
          });
        }

        // Get the updated role and user details for response
        const [membershipDetails] = await ctx.db
          .select({
            userId: memberships.user_id,
            roleId: memberships.role_id,
            roleName: roles.name,
            user: {
              id: users.id,
              name: users.name,
              email: users.email,
            },
          })
          .from(memberships)
          .innerJoin(roles, eq(memberships.role_id, roles.id))
          .innerJoin(users, eq(memberships.user_id, users.id))
          .where(eq(memberships.user_id, input.userId))
          .limit(1);

        if (!membershipDetails) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to retrieve updated membership details",
          });
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
      },
    ),
});

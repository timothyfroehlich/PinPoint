import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  organizationProcedure,
} from "~/server/api/trpc";
import { imageStorage } from "~/lib/image-storage/local-storage";
import { getDefaultAvatarUrl } from "~/lib/utils/image-processing";

export const userRouter = createTRPCRouter({
  // Get current user's profile
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      include: {
        ownedGameInstances: {
          include: {
            gameTitle: true,
            room: {
              include: {
                location: true,
              },
            },
          },
        },
        memberships: {
          include: {
            organization: true,
          },
        },
        _count: {
          select: {
            issues: true,
            comments: true,
            ownedGameInstances: true,
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
  getCurrentMembership: organizationProcedure.query(async ({ ctx }) => {
    return {
      userId: ctx.membership.userId,
      role: ctx.membership.role,
      organizationId: ctx.membership.organizationId,
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
      const updatedUser = await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.bio !== undefined && { bio: input.bio }),
        },
      });

      return updatedUser;
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
          `user-${ctx.session.user.id}`,
        );

        // Delete old profile picture if it exists
        const currentUser = await ctx.db.user.findUnique({
          where: { id: ctx.session.user.id },
          select: { profilePicture: true },
        });

        if (
          currentUser?.profilePicture &&
          !currentUser.profilePicture.includes("default-avatar")
        ) {
          try {
            await imageStorage.deleteImage(currentUser.profilePicture);
          } catch (error) {
            // Ignore deletion errors for old files
            console.warn("Failed to delete old profile picture:", error);
          }
        }

        // Update user's profile picture
        const updatedUser = await ctx.db.user.update({
          where: { id: ctx.session.user.id },
          data: { profilePicture: imagePath },
        });

        return { success: true, profilePicture: updatedUser.profilePicture };
      } catch (error) {
        console.error("Profile picture upload error:", error);
        throw new Error("Failed to upload profile picture");
      }
    }),

  // Get user by ID (public info only - within organization context)
  getUser: organizationProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify user is a member of the current organization
      const membership = await ctx.db.membership.findUnique({
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
              joinDate: true,
              _count: {
                select: {
                  ownedGameInstances: true,
                  issues: true,
                  comments: true,
                },
              },
            },
          },
        },
      });

      if (!membership) {
        throw new Error("User not found in this organization");
      }

      return membership.user;
    }),

  // Get all users in the current organization
  getAllInOrganization: organizationProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.membership.findMany({
      where: { organizationId: ctx.membership.organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            bio: true,
            profilePicture: true,
            joinDate: true,
            _count: {
              select: {
                ownedGameInstances: true,
                issues: true,
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

    return memberships.map((m) => ({
      ...m.user,
      role: m.role,
    }));
  }),

  // Assign default avatar to user (used during account creation)
  assignDefaultAvatar: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { profilePicture: true },
    });

    // Only assign if user doesn't already have a profile picture
    if (!user?.profilePicture) {
      const defaultAvatarUrl = getDefaultAvatarUrl();

      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { profilePicture: defaultAvatarUrl },
      });

      return { profilePicture: defaultAvatarUrl };
    }

    return { profilePicture: user.profilePicture };
  }),
});

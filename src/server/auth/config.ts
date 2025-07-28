import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";

import { createAuthProviders } from "./providers";
import { isValidOrganization, isValidMembership } from "./types";

import type { Session } from "next-auth";
import type { User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { ExtendedPrismaClient } from "~/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role?: string;
      organizationId?: string;
      onboardingCompleted?: boolean;
      invitedBy?: string;
    } & DefaultSession["user"];
  }

  interface JWT {
    id: string;
    role?: string;
    organizationId?: string;
    onboardingCompleted?: boolean;
    invitedBy?: string;
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const createAuthConfig = (db: ExtendedPrismaClient): NextAuthConfig => ({
  adapter: PrismaAdapter(db),
  providers: createAuthProviders(db),
  pages: {
    signIn: "/sign-in",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt: async ({ token, user }: { token: JWT; user?: User }): Promise<JWT> => {
      if (user && "id" in user && typeof user.id === "string") {
        const userId = user.id;
        token["id"] = userId;

        // Get user data including onboarding status and invitation details
        const userResult = await db.user.findUnique({
          where: { id: userId },
          select: {
            onboardingCompleted: true,
            invitedBy: true,
          },
        });

        if (userResult) {
          token["onboardingCompleted"] = userResult.onboardingCompleted;
          if (userResult.invitedBy) {
            token["invitedBy"] = userResult.invitedBy;
          }
        }

        // Get the user's membership in the current organization
        // Note: In JWT callback, we don't have access to request headers/subdomain,
        // so we default to APC. The organization context will be properly resolved
        // in tRPC context based on subdomain.
        const organizationResult = await db.organization.findUnique({
          where: { subdomain: "apc" },
        });

        if (isValidOrganization(organizationResult)) {
          const membershipResult = await db.membership.findUnique({
            where: {
              userId_organizationId: {
                userId,
                organizationId: organizationResult.id,
              },
            },
            include: {
              role: true,
            },
          });

          if (isValidMembership(membershipResult)) {
            token["role"] = membershipResult.role.name;
            token["organizationId"] = organizationResult.id;
          }
        }
      }
      return token;
    },
    session: ({
      session,
      token,
    }: {
      session: Session;
      token: JWT;
    }): Session => {
      // For JWT sessions, get data from token
      const userUpdate: {
        id: string;
        role?: string;
        organizationId?: string;
        onboardingCompleted?: boolean;
        invitedBy?: string;
      } = {
        id: typeof token["id"] === "string" ? token["id"] : "",
      };

      if (typeof token["role"] === "string") {
        userUpdate.role = token["role"];
      }

      if (typeof token["organizationId"] === "string") {
        userUpdate.organizationId = token["organizationId"];
      }

      if (typeof token["onboardingCompleted"] === "boolean") {
        userUpdate.onboardingCompleted = token["onboardingCompleted"];
      }

      if (typeof token["invitedBy"] === "string") {
        userUpdate.invitedBy = token["invitedBy"];
      }

      return {
        ...session,
        user: {
          ...session.user,
          ...userUpdate,
        },
      };
    },
  },
});

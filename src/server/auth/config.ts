import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { isValidUser, isValidOrganization, isValidMembership } from "./types";

import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { AdapterUser } from "next-auth/adapters";
import type { ExtendedPrismaClient } from "~/server/db";

import { env } from "~/env.js";

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
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    organizationId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: string;
    organizationId?: string;
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const createAuthConfig = (db: ExtendedPrismaClient): NextAuthConfig => ({
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    // Development-only Credentials provider for test accounts
    ...(env.NODE_ENV === "development" || env.NODE_ENV === "test"
      ? [
          Credentials({
            name: "Development Test Users",
            credentials: {
              email: { label: "Email", type: "email" },
            },
            async authorize(
              credentials: Partial<Record<string, unknown>>,
            ): Promise<User | null> {
              if (env.NODE_ENV !== "development" && env.NODE_ENV !== "test") {
                return null;
              }

              if (
                !credentials ||
                typeof credentials.email !== "string"
              ) {
                return null;
              }

              const email = credentials.email;

              // Find user in database by email
              const userResult = await db.user.findUnique({
                where: { email },
              });

              if (isValidUser(userResult)) {
                return {
                  id: userResult.id,
                  name: userResult.name ?? "",
                  email: userResult.email ?? "",
                  image: userResult.profilePicture ?? null,
                };
              }

              return null;
            },
          }),
        ]
      : []),
  ],
  pages: {
    signIn: "/sign-in",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt: async ({
      token,
      user,
    }: {
      token: JWT;
      user?: User | AdapterUser;
    }): Promise<JWT> => {
      if (user && user.id) {
        token.id = user.id;

        const organizationResult = await db.organization.findUnique({
          where: { subdomain: "apc" },
        });

        if (isValidOrganization(organizationResult)) {
          const membershipResult = await db.membership.findUnique({
            where: {
              userId_organizationId: {
                userId: user.id,
                organizationId: organizationResult.id,
              },
            },
            include: {
              role: true,
            },
          });

          if (isValidMembership(membershipResult)) {
            token.role = membershipResult.role.name;
            token.organizationId = organizationResult.id;
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
      if (token.id) {
        session.user.id = token.id;
      }
      if (token.role) {
        session.user.role = token.role;
      }
      if (token.organizationId) {
        session.user.organizationId = token.organizationId;
      }
      return session;
    },
  },
});

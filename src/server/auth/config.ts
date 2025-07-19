import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import type { User } from "next-auth";

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
            async authorize(credentials: Record<string, unknown> | undefined): Promise<User | null> {
              if (env.NODE_ENV !== "development" && env.NODE_ENV !== "test") {
                return null;
              }

              if (
                !credentials?.email ||
                typeof credentials.email !== "string"
              ) {
                return null;
              }

              // Find user in database by email
              const user = await db.user.findUnique({
                where: { email: credentials.email },
              });

              if (user) {
                return {
                  id: user.id,
                  name: user.name ?? "",
                  email: user.email ?? "",
                  image: user.profilePicture ?? null,
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
    jwt: async ({ token, user }: { token: JWT; user?: User }): Promise<JWT> => {
      if (user?.id) {
        token.id = user.id;

        // Get the user's membership in the current organization
        // Note: In JWT callback, we don't have access to request headers/subdomain,
        // so we default to APC. The organization context will be properly resolved
        // in tRPC context based on subdomain.
        const organization = await db.organization.findUnique({
          where: { subdomain: "apc" },
        });

        if (organization) {
          const membership = await db.membership.findUnique({
            where: {
              userId_organizationId: {
                userId: user.id,
                organizationId: organization.id,
              },
            },
            include: {
              role: true,
            },
          });

          if (membership) {
            token.role = membership.role.name;
            token.organizationId = organization.id;
          }
        }
      }
      return token;
    },
    session: ({ session, token }: { session: Session; token: JWT }): Session => {
      // For JWT sessions, get data from token
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
          role: token.role,
          organizationId: token.organizationId,
        },
      };
    },
  },
});

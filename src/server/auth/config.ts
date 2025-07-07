import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

import { db } from "~/server/db";

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
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    // Development-only Credentials provider for test accounts
    ...(process.env.NODE_ENV === "development"
      ? [
          Credentials({
            name: "Development Test Users",
            credentials: {
              email: { label: "Email", type: "email" },
            },
            async authorize(credentials) {
              if (process.env.NODE_ENV !== "development") {
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
  adapter: PrismaAdapter(db),
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
  },
} satisfies NextAuthConfig;

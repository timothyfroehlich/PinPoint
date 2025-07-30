import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { isValidUser } from "./types";
import { assertOAuthConfigValid } from "./validation";

import type { User } from "next-auth";
import type { Provider } from "next-auth/providers";
import type { ExtendedPrismaClient } from "~/server/db";

import { env } from "~/env.js";
import {
  shouldEnableCredentialsProvider,
  shouldEnableTestLogin,
  shouldEnableDemoLogin,
} from "~/lib/environment";

/**
 * Creates the Credentials provider for environment-specific test/demo accounts
 * Only enabled in development, preview, and test environments
 */
export function createCredentialsProvider(
  db: ExtendedPrismaClient,
): Provider | null {
  if (!shouldEnableCredentialsProvider()) {
    return null;
  }

  const providerName = shouldEnableTestLogin()
    ? "Development Test Users"
    : shouldEnableDemoLogin()
      ? "Demo Users"
      : "Test Users";

  return Credentials({
    name: providerName,
    credentials: {
      email: { label: "Email", type: "email" },
    },
    async authorize(
      credentials: Record<string, unknown> | undefined,
    ): Promise<User | null> {
      if (!shouldEnableCredentialsProvider()) {
        return null;
      }

      if (
        !credentials ||
        !("email" in credentials) ||
        typeof credentials["email"] !== "string"
      ) {
        return null;
      }

      const email = credentials["email"];

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
  });
}

/**
 * Creates the Google OAuth provider with environment validation
 * Available in all environments but requires proper configuration
 */
export function createGoogleProvider(): Provider {
  return Google({
    clientId: env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
  });
}

/**
 * Creates all authentication providers based on environment
 * Returns array of configured providers for NextAuth
 */
export function createAuthProviders(db: ExtendedPrismaClient): Provider[] {
  // Validate OAuth configuration before creating providers
  assertOAuthConfigValid();

  const providers: Provider[] = [];

  // OAuth providers are available in all environments
  providers.push(createGoogleProvider());

  // Credentials provider only in development/preview/test
  const credentialsProvider = createCredentialsProvider(db);
  if (credentialsProvider) {
    providers.push(credentialsProvider);
  }

  return providers;
}

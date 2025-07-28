import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";

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
 * Creates the Resend Email provider for magic link authentication
 * Available in all environments but requires RESEND_API_KEY
 */
export function createResendProvider(): Provider | null {
  if (!env.RESEND_API_KEY) {
    return null;
  }

  return Resend({
    apiKey: env.RESEND_API_KEY,
    from: "PinPoint <noreply@pinpoint.austinpinballcollective.org>",
    sendVerificationRequest: async ({ identifier: email, url }) => {
      const { Resend } = await import("resend");
      const resend = new Resend(env.RESEND_API_KEY);

      const result = await resend.emails.send({
        from: "PinPoint <noreply@pinpoint.austinpinballcollective.org>",
        to: [email],
        subject: "Sign in to PinPoint",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Sign in to PinPoint</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #667eea; margin-bottom: 10px;">🎯 PinPoint</h1>
                <p style="color: #666; margin: 0;">Pinball Machine Management</p>
              </div>
              
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
                <h2 style="margin-top: 0; color: #333;">Sign in to your account</h2>
                <p style="margin-bottom: 25px; color: #666;">Click the button below to securely sign in to PinPoint. This link will expire in 24 hours.</p>
                
                <div style="text-align: center;">
                  <a href="${url}" style="display: inline-block; background-color: #667eea; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 500; font-size: 16px;">
                    Sign in to PinPoint
                  </a>
                </div>
              </div>
              
              <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; text-align: center;">
                <p>If you didn't request this email, you can safely ignore it.</p>
                <p>This magic link is only valid for the next 24 hours.</p>
              </div>
            </body>
          </html>
        `,
        text: `
Sign in to PinPoint

Click the link below to sign in to your PinPoint account:
${url}

This link will expire in 24 hours.

If you didn't request this email, you can safely ignore it.
        `,
      });

      if (result.error) {
        throw new Error(
          `Failed to send verification email: ${result.error.message}`,
        );
      }
    },
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

  // Google OAuth is available in all environments
  providers.push(createGoogleProvider());

  // Resend Email provider for magic links
  const resendProvider = createResendProvider();
  if (resendProvider) {
    providers.push(resendProvider);
  }

  // Credentials provider only in development/preview/test
  const credentialsProvider = createCredentialsProvider(db);
  if (credentialsProvider) {
    providers.push(credentialsProvider);
  }

  return providers;
}

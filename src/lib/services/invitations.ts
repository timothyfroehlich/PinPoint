/**
 * Invitation service helpers for Server Components and Actions.
 * Keeps database access out of React components per CORE-TS-003.
 */

import { and, eq } from "drizzle-orm";
import { db } from "~/lib/dal/shared";
import { invitations, users } from "~/server/db/schema";

export interface InvitationDetails {
  id: string;
  email: string;
  status: typeof invitations.$inferSelect.status;
  expiresAt: Date;
  organization: {
    id: string;
    name: string;
    subdomain: string | null;
  };
  role: {
    id: string;
    name: string;
  };
}

export interface BasicUserRecord {
  id: string;
  email: string | null;
  emailVerified: Date | null;
}

/**
 * Locate a pending invitation by its hashed token.
 */
export async function findPendingInvitationByTokenHash(
  tokenHash: string,
): Promise<InvitationDetails | null> {
  const invitation = await db.query.invitations.findFirst({
    where: and(eq(invitations.token, tokenHash), eq(invitations.status, "pending")),
    columns: {
      id: true,
      email: true,
      status: true,
      expires_at: true,
    },
    with: {
      organization: {
        columns: {
          id: true,
          name: true,
          subdomain: true,
        },
      },
      role: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!invitation) {
    return null;
  }

  return {
    id: invitation.id,
    email: invitation.email,
    status: invitation.status,
    expiresAt: invitation.expires_at,
    organization: {
      id: invitation.organization.id,
      name: invitation.organization.name,
      subdomain: invitation.organization.subdomain,
    },
    role: {
      id: invitation.role.id,
      name: invitation.role.name,
    },
  };
}

/**
 * Mark invitation as expired.
 */
export async function markInvitationExpired(invitationId: string): Promise<void> {
  await db
    .update(invitations)
    .set({
      status: "expired",
      updated_at: new Date(),
    })
    .where(eq(invitations.id, invitationId));
}

/**
 * Mark invitation as accepted.
 */
export async function markInvitationAccepted(invitationId: string): Promise<void> {
  await db
    .update(invitations)
    .set({
      status: "accepted",
      updated_at: new Date(),
    })
    .where(eq(invitations.id, invitationId));
}

/**
 * Find a user by email (used before auth context exists).
 */
export async function findUserByEmailAddress(
  email: string,
): Promise<BasicUserRecord | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: {
      id: true,
      email: true,
      email_verified: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    emailVerified: user.email_verified,
  };
}

/**
 * Mark a user's email as verified.
 */
export async function verifyUserEmail(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      email_verified: new Date(),
      updated_at: new Date(),
    })
    .where(eq(users.id, userId));
}

import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { invitedUsers } from "~/server/db/schema";

/**
 * The invitation for this email, which prefills the signup form, or undefined
 * when there is none. Emails are stored lowercased; the caller lowercases.
 * `cache()`-wrapped per request.
 */
export const getInvitationByEmail = cache(async (email: string) =>
  db.query.invitedUsers.findFirst({
    where: eq(invitedUsers.email, email),
  })
);

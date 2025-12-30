"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";
import { log } from "~/lib/logger";
import { createIssue } from "~/services/issues";
import {
  checkPublicIssueLimit,
  formatResetTime,
  getClientIp,
} from "~/lib/rate-limit";
import { parsePublicIssueForm } from "./validation";
import { db } from "~/server/db";
import { machines, userProfiles, unconfirmedUsers } from "~/server/db/schema";
import { eq, sql } from "drizzle-orm";

const redirectWithError = (message: string): never => {
  const params = new URLSearchParams({ error: message });
  redirect(`/report?${params.toString()}`);
};

/**
 * Server Action: submit anonymous issue
 *
 * Allows unauthenticated visitors to report issues.
 */
export async function submitPublicIssueAction(
  formData: FormData
): Promise<void> {
  const sourceParam = formData.get("source");
  const source = typeof sourceParam === "string" ? sourceParam : undefined;

  // 1. Check Honeypot
  const honeypot = formData.get("website");
  if (honeypot) {
    // Bot detected, silently reject
    log.warn(
      { action: "publicIssueReport", honeypot, source },
      "Honeypot triggered"
    );
    redirect("/report/success");
  }

  // 2. Check Rate Limit
  const ip = await getClientIp();
  const { success, reset } = await checkPublicIssueLimit(ip);

  if (!success) {
    const resetTime = formatResetTime(reset);
    redirectWithError(
      `Too many submissions. Please try again in ${resetTime}.`
    );
  }

  const parsed = parsePublicIssueForm(formData);
  if (!parsed.success) {
    redirectWithError(parsed.error);
    return;
  }

  const {
    machineId,
    title,
    description,
    severity,
    email,
    firstName,
    lastName,
  } = parsed.data;

  // Resolve reporter if email is provided
  let reportedBy: string | null = null;
  let unconfirmedReportedBy: string | null = null;

  if (email) {
    // 1. Check active users
    const activeUser = await db.query.userProfiles.findFirst({
      where: eq(
        userProfiles.id,
        sql`(SELECT id FROM auth.users WHERE email = ${email})`
      ),
    });

    if (activeUser) {
      reportedBy = activeUser.id;
    } else {
      // 2. Check/Create unconfirmed user
      const existingUnconfirmed = await db.query.unconfirmedUsers.findFirst({
        where: eq(unconfirmedUsers.email, email),
      });

      if (existingUnconfirmed) {
        log.info(
          {
            action: "publicIssueReport",
            unconfirmedUserId: existingUnconfirmed.id,
            email,
          },
          "Found existing unconfirmed user"
        );
        unconfirmedReportedBy = existingUnconfirmed.id;
      } else {
        // Create new unconfirmed user
        const [newUnconfirmed] = await db
          .insert(unconfirmedUsers)
          .values({
            email: email,
            firstName: firstName ?? "Anonymous",
            lastName: lastName ?? "User",
            role: "guest",
          })
          .returning();

        if (!newUnconfirmed) {
          throw new Error("Failed to create unconfirmed user");
        }
        log.info(
          {
            action: "publicIssueReport",
            unconfirmedUserId: newUnconfirmed.id,
            email,
          },
          "Created new unconfirmed user"
        );
        unconfirmedReportedBy = newUnconfirmed.id;
      }
    }
  }

  // Resolve machine initials from ID
  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, machineId),
    columns: { initials: true },
  });

  if (!machine) {
    redirectWithError("Machine not found.");
    return;
  }

  try {
    await createIssue({
      title,
      description: description ?? null,
      machineInitials: machine.initials,
      severity,
      reportedBy,
      unconfirmedReportedBy,
    });

    revalidatePath(`/m/${machine.initials}`);
    revalidatePath(`/m/${machine.initials}/i`);
    redirect("/report/success");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    log.error(
      {
        action: "publicIssueReport",
        machineId,
        source,
        error: error instanceof Error ? error.message : "Unknown",
      },
      "Failed to submit public issue"
    );
    redirectWithError("Unable to submit the issue. Please try again.");
  }
}

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
import { eq } from "drizzle-orm";
import { createClient } from "~/lib/supabase/server";
import type { ActionState } from "./unified-report-form";

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
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
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

  const parsedValue = parsePublicIssueForm(formData);
  if (!parsedValue.success) {
    redirectWithError(parsedValue.error);
    return { error: parsedValue.error }; // Should be unreachable
  }

  // After the early return, parsedValue is narrowed to ParsedPublicIssue
  const {
    machineId,
    title,
    description,
    severity,
    email,
    firstName,
    lastName,
    priority,
  } = parsedValue.data;

  // 3. Resolve reporter
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let reportedBy: string | null = user?.id ?? null;
  let unconfirmedReportedBy: string | null = null;
  // 4. Resolve reporter via email if not already logged in
  if (!reportedBy && email) {
    // Check active user profiles directly
    const activeUser = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.email, email),
      columns: { id: true, role: true },
    });

    if (activeUser) {
      log.info(
        { action: "publicIssueReport", email },
        "Blocked attempt to report for confirmed account"
      );
      // Security: Don't reveal account existence unless attempting to use it?
      // Actually, standard behavior here is to block.
      return {
        error:
          "This email is associated with an existing account. Please log in to report this issue.",
      };
    }

    // 2. Check/Create unconfirmed user
    const existingUnconfirmed = await db.query.unconfirmedUsers.findFirst({
      where: eq(unconfirmedUsers.email, email),
    });

    if (existingUnconfirmed) {
      log.info(
        {
          action: "publicIssueReport",
          unconfirmedUserId: String(existingUnconfirmed.id),
          email,
        },
        "Found existing unconfirmed user"
      );
      unconfirmedReportedBy = String(existingUnconfirmed.id);
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
      unconfirmedReportedBy = String(newUnconfirmed.id);
    }
  }

  // Resolve machine initials from ID
  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, machineId),
    columns: { initials: true },
  });

  if (!machine) {
    throw new Error("Machine not found.");
  }

  // Enforce priority for non-members
  let finalPriority = priority;
  let isMemberOrAdmin = false;

  if (reportedBy) {
    // Optimization: Check if we have the profile already?
    // We don't have it in scope if it came from `user.id`.
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, reportedBy),
      columns: { role: true },
    });

    if (profile?.role === "admin" || profile?.role === "member") {
      isMemberOrAdmin = true;
    }
  }

  if (!isMemberOrAdmin) {
    // Force medium for guests/anonymous
    finalPriority = "medium";
  }

  log.info(
    {
      machineId,
      reportedBy,
      unconfirmedReportedBy,
      finalPriority,
      isMemberOrAdmin,
    },
    "Submitting unified issue report..."
  );
  try {
    const issue = await createIssue({
      title,
      description: description ?? null,
      machineInitials: machine.initials,
      severity,
      priority: finalPriority,
      reportedBy,
      unconfirmedReportedBy,
    });
    log.info(
      { issueId: issue.id, issueNumber: issue.issueNumber },
      "Issue created, redirecting..."
    );

    revalidatePath("/m");
    revalidatePath(`/m/${machine.initials}`);
    revalidatePath(`/m/${machine.initials}/i`);

    // Redirect logic:
    // 1. Authenticated users go directly to the issue detail page
    if (reportedBy) {
      log.info(
        {
          reportedBy,
          target: `/m/${machine.initials}/i/${issue.issueNumber}`,
        },
        "Redirecting authenticated user to issue page"
      );
      redirect(`/m/${machine.initials}/i/${issue.issueNumber}`);
    }

    // 2. Anonymous users go to success page
    const successParams = new URLSearchParams();
    if (unconfirmedReportedBy && !reportedBy) {
      successParams.set("new_pending", "true");
    }

    const successUrl = successParams.toString()
      ? `/report/success?${successParams.toString()}`
      : "/report/success";

    redirect(successUrl);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to submit the issue. Please try again.",
    };
  }
}

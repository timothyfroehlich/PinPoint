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
import { verifyTurnstileToken } from "~/lib/security/turnstile";
import { BLOB_CONFIG } from "~/lib/blob/config";
import { db } from "~/server/db";
import {
  machines,
  userProfiles,
  issueImages,
  issues as issuesTable,
} from "~/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { createClient } from "~/lib/supabase/server";
import type { ActionState } from "./unified-report-form";
import { imagesMetadataArraySchema } from "../(app)/issues/schemas";
import { deleteFromBlob } from "~/lib/blob/client";
import { z } from "zod";
import { ok, err, type Result } from "~/lib/result";
import type {
  IssueStatus,
  IssueSeverity,
  IssuePriority,
  IssueFrequency,
} from "~/lib/types";

const recentIssuesParamsSchema = z.object({
  machineInitials: z
    .string()
    .min(1, "machineInitials must not be empty")
    .max(10, "machineInitials must be 10 characters or fewer")
    .regex(
      /^[A-Za-z0-9-]+$/,
      "machineInitials must be alphanumeric with hyphens only"
    ),
  limit: z
    .number()
    .int("limit must be an integer")
    .min(1, "limit must be at least 1")
    .max(20, "limit must be 20 or fewer"),
});

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
    return {
      error: `Too many submissions. Please try again in ${resetTime}.`,
    };
  }

  // 3. Verify Turnstile CAPTCHA
  const turnstileToken = formData.get("cf-turnstile-response");
  const tokenStr = typeof turnstileToken === "string" ? turnstileToken : "";
  const captchaValid = await verifyTurnstileToken(tokenStr, ip);

  if (!captchaValid) {
    log.warn(
      { action: "publicIssueReport", ip },
      "Turnstile CAPTCHA verification failed"
    );
    return {
      error: "CAPTCHA verification failed. Please try again.",
    };
  }

  const parsedValue = parsePublicIssueForm(formData);
  if (!parsedValue.success) {
    return { error: parsedValue.error };
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
    frequency,
    status,
    assignedTo,
    watchIssue,
  } = parsedValue.data;

  // 3. Resolve reporter
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let reportedBy: string | null = user?.id ?? null;
  log.info(
    { reportedBy, email: user?.email, action: "publicIssueReport" },
    "Resolving reporter for public issue"
  );
  let reporterName: string | null = null;
  let reporterEmail: string | null = null;

  // 4. Resolve reporter via name/email if not already logged in
  if (!reportedBy) {
    if (email) {
      // Check active user profiles directly to prevent spoofing
      const activeUser = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.email, email.toLowerCase()),
        columns: { id: true },
      });

      if (activeUser) {
        log.info(
          { action: "publicIssueReport", email },
          "Silently rejected report for confirmed account (anti-enumeration)"
        );
        redirect("/report/success");
      }
      reporterEmail = email;
    }

    // Capture provided name regardless of email
    if (firstName || lastName) {
      reporterName = [firstName, lastName].filter(Boolean).join(" ");
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
  let finalAssignedTo: string | null | undefined = undefined;
  let canSetWorkflowFields = false;

  if (reportedBy) {
    // Optimization: Check if we have the profile already?
    // We don't have it in scope if it came from `user.id`.
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, reportedBy),
      columns: { role: true },
    });

    if (
      profile?.role === "admin" ||
      profile?.role === "technician" ||
      profile?.role === "member"
    ) {
      canSetWorkflowFields = true;
    }
  }

  let finalStatus = status;
  if (canSetWorkflowFields) {
    finalAssignedTo = assignedTo === "" ? undefined : assignedTo;
  } else {
    // Force medium priority and new status for guests/anonymous
    finalPriority = "medium";
    finalStatus = "new";
  }

  log.info(
    {
      machineId,
      reportedBy,
      reporterName,
      reporterEmail,
      finalPriority,
      finalAssignedTo,
      canSetWorkflowFields,
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
      frequency,
      status: finalStatus,
      reportedBy,
      reporterName,
      reporterEmail,
      assignedTo: finalAssignedTo ?? null,
      autoWatchReporter: watchIssue,
    });

    // 5. Link uploaded images
    const imagesMetadataStr = formData.get("imagesMetadata");
    if (imagesMetadataStr && typeof imagesMetadataStr === "string") {
      try {
        const rawJson = JSON.parse(imagesMetadataStr) as unknown;
        const imagesMetadata = imagesMetadataArraySchema.parse(rawJson);

        // Validate count respects limits (security measure against manual JSON editing)
        const limit = reportedBy
          ? BLOB_CONFIG.LIMITS.AUTHENTICATED_USER_MAX
          : BLOB_CONFIG.LIMITS.PUBLIC_USER_MAX;

        if (imagesMetadata.length > limit) {
          log.warn(
            { issueId: issue.id, count: imagesMetadata.length, limit },
            "Blocked attempt to link too many images"
          );
          return {
            error: `Too many images. Maximum ${limit} images allowed.`,
          };
        }

        if (imagesMetadata.length > 0) {
          log.info(
            { issueId: issue.id, count: imagesMetadata.length },
            "Linking images to issue..."
          );
          try {
            await db.insert(issueImages).values(
              imagesMetadata.map((img) => ({
                issueId: issue.id,
                uploadedBy: reportedBy,
                fullImageUrl: img.blobUrl,
                fullBlobPathname: img.blobPathname,
                fileSizeBytes: img.fileSizeBytes,
                mimeType: img.mimeType,
                originalFilename: img.originalFilename,
              }))
            );
          } catch (dbError) {
            log.error(
              {
                error: dbError instanceof Error ? dbError.message : dbError,
                issueId: issue.id,
                orphanedBlobs: imagesMetadata.map((img) => img.blobPathname),
              },
              "Database failed to link images to issue. Cleaning up orphaned blobs."
            );
            // Immediate cleanup of orphaned blobs
            await Promise.allSettled(
              imagesMetadata.map((img) => deleteFromBlob(img.blobPathname))
            );
            // Don't return error here - issue was already created successfully
            // User will be redirected, but images won't appear on the issue
            // TODO: Consider implementing a flash message system to show warning
          }
        }
      } catch (parseError) {
        log.error(
          {
            error:
              parseError instanceof Error ? parseError.message : parseError,
            issueId: issue.id,
          },
          "Failed to parse images metadata"
        );
        // Non-blocking for the user
      }
    }

    log.info(
      { issueId: issue.id, issueNumber: issue.issueNumber },
      "Issue created, redirecting..."
    );

    revalidatePath("/m");
    revalidatePath(`/m/${machine.initials}`);
    revalidatePath(`/m/${machine.initials}/i`);
    revalidatePath(`/m/${machine.initials}/i/${issue.issueNumber}`);

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
    // We can use reporterEmail or reporterName to decide if they provided info
    if ((reporterEmail || reporterName) && !reportedBy) {
      successParams.set("new_pending", "true");
      // Pass name and email information to success page for signup pre-fill
      if (firstName) {
        successParams.set("firstName", firstName);
      }
      if (lastName) {
        successParams.set("lastName", lastName);
      }
      if (reporterEmail) {
        successParams.set("email", reporterEmail);
      }
    }

    const successUrl = successParams.toString()
      ? `/report/success?${successParams.toString()}`
      : "/report/success";

    log.info(
      { reportedBy, target: successUrl },
      "Redirecting anonymous user to success page"
    );
    redirect(successUrl);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    log.error({ error }, "Failed to submit issue");
    return {
      error: "Unable to submit the issue. Please try again.",
    };
  }
}

/** Serializable issue data for client-side rendering */
export interface RecentIssueData {
  id: string;
  issueNumber: number;
  title: string;
  status: IssueStatus;
  severity: IssueSeverity;
  priority: IssuePriority;
  frequency: IssueFrequency;
  createdAt: string; // ISO 8601
}

/** Fetch recent issues for a machine (called client-side on machine change) */
export async function getRecentIssuesAction(
  machineInitials: string,
  limit: number
): Promise<Result<RecentIssueData[], "SERVER">> {
  const parsed = recentIssuesParamsSchema.safeParse({ machineInitials, limit });
  if (!parsed.success) {
    log.warn(
      { machineInitials, limit, issues: parsed.error.issues },
      "getRecentIssuesAction: invalid input"
    );
    return err("SERVER", "Invalid input");
  }

  try {
    const rows = await db.query.issues.findMany({
      where: eq(issuesTable.machineInitials, parsed.data.machineInitials),
      orderBy: [desc(issuesTable.createdAt)],
      limit: parsed.data.limit,
      columns: {
        id: true,
        issueNumber: true,
        title: true,
        status: true,
        severity: true,
        priority: true,
        frequency: true,
        createdAt: true,
      },
    });

    return ok(
      rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    log.error(
      { error, machineInitials },
      "Error fetching recent issues via server action"
    );
    return err("SERVER", "Could not load recent issues");
  }
}

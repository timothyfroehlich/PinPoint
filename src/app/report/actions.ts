"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { log } from "~/lib/logger";
import { createIssue } from "~/services/issues";
import {
  checkPublicIssueLimit,
  formatResetTime,
  getClientIp,
} from "~/lib/rate-limit";
import { parsePublicIssueForm } from "./validation";
import { BLOB_CONFIG } from "~/lib/blob/config";
import { db } from "~/server/db";
import { machines, userProfiles, issueImages } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "~/lib/supabase/server";
import type { ActionState } from "./unified-report-form";

const imageMetadataSchema = z.object({
  blobUrl: z.string().url(), // Removed strict https check for local dev flexibility
  blobPathname: z.string().min(1),
  originalFilename: z.string().min(1),
  fileSizeBytes: z.number().positive(),
  mimeType: z.string().startsWith("image/"),
});

const imagesMetadataArraySchema = z.array(imageMetadataSchema);

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
    consistency,
  } = parsedValue.data;

  // 3. Resolve reporter
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let reportedBy: string | null = user?.id ?? null;
  let reporterName: string | null = null;
  let reporterEmail: string | null = null;

  // 4. Resolve reporter via name/email if not already logged in
  if (!reportedBy) {
    if (email) {
      // Check active user profiles directly to prevent spoofing
      const activeUser = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.email, email),
        columns: { id: true },
      });

      if (activeUser) {
        log.info(
          { action: "publicIssueReport", email },
          "Blocked attempt to report for confirmed account"
        );
        return {
          error:
            "This email is associated with an existing account. Please log in to report this issue.",
        };
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
      reporterName,
      reporterEmail,
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
      consistency,
      reportedBy,
      reporterName,
      reporterEmail,
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
          // Just take the first few that fit the limit
          imagesMetadata.splice(limit);
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
              "Database failed to link images to issue. TODO: Implement cleanup job (BLOB_CONFIG.SOFT_DELETE_RETENTION_HOURS) to remove these pending blobs."
            );
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

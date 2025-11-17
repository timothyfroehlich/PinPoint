/**
 * Public Issue Reporting Server Actions
 *
 * Anonymous/public issue reporting - NO authentication required.
 */

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { createTimelineEvent } from "~/lib/timeline/events";
import { log } from "~/lib/logger";
import { publicReportIssueSchema } from "./schemas";

const toOptionalString = (value: FormDataEntryValue | null): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

/**
 * Public Report Issue Action
 *
 * Creates a new issue from anonymous/public reporter.
 * NO auth check - this is intentionally public (anonymous reporting).
 * Validates input with Zod (CORE-SEC-002).
 * Enforces machine requirement (CORE-ARCH-004).
 *
 * @param formData - Form data from public issue reporting form
 */
export async function publicReportIssueAction(
  formData: FormData
): Promise<void> {
  // Extract and validate form data (CORE-SEC-002)
  const rawData = {
    title: toOptionalString(formData.get("title")),
    description: toOptionalString(formData.get("description")),
    machineId: toOptionalString(formData.get("machineId")),
    severity: toOptionalString(formData.get("severity")),
    reporterName: toOptionalString(formData.get("reporterName")),
  };

  const validation = publicReportIssueSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    log.warn(
      {
        errors: validation.error.issues,
        action: "publicReportIssue",
        rawMachineId: rawData.machineId,
      },
      "Public issue report validation failed"
    );
    // For public form, just redirect back without flash (no session)
    redirect(`/report?error=${encodeURIComponent(firstError?.message ?? "Invalid input")}`);
  }

  const { title, description, machineId, severity, reporterName } =
    validation.data;

  // Create issue (direct Drizzle query - no DAL)
  // reportedBy is NULL for anonymous reports
  try {
    const [issue] = await db
      .insert(issues)
      .values({
        title,
        description: description ?? null,
        machineId,
        severity,
        reportedBy: null, // Anonymous - no user ID
        reporterName: reporterName ?? null, // Optional public reporter name
        status: "new",
      })
      .returning();

    if (!issue) throw new Error("Issue creation failed");

    // Create timeline event for issue creation
    await createTimelineEvent(issue.id, "Issue created");

    log.info(
      {
        issueId: issue.id,
        machineId,
        reporterName: reporterName ?? "Anonymous",
        action: "publicReportIssue",
      },
      "Public issue created successfully"
    );

    revalidatePath("/issues");
    revalidatePath(`/machines/${machineId}`);

    redirect("/report/success");
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        stack: error instanceof Error ? error.stack : undefined,
        action: "publicReportIssue",
      },
      "Public issue creation server error"
    );
    redirect("/report?error=Failed+to+create+issue.+Please+try+again.");
  }
}

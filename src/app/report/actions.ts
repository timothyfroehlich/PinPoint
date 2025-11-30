"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { createTimelineEvent } from "~/lib/timeline/events";
import { log } from "~/lib/logger";
import {
  checkPublicIssueLimit,
  formatResetTime,
  getClientIp,
} from "~/lib/rate-limit";
import { publicIssueSchema, type PublicIssueInput } from "./schemas";

const toOptionalString = (value: FormDataEntryValue | null): string | undefined =>
  typeof value === "string" ? value : undefined;

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
  // 1. Check Honeypot
  const honeypot = formData.get("website");
  if (honeypot) {
    // Bot detected, silently reject
    log.warn({ action: "publicIssueReport", honeypot }, "Honeypot triggered");
    redirect("/report/success");
  }

  // 2. Check Rate Limit
  const ip = await getClientIp();
  const { success, reset } = await checkPublicIssueLimit(ip);

  if (!success) {
    const resetTime = formatResetTime(reset);
    redirectWithError(`Too many submissions. Please try again in ${resetTime}.`);
  }

  const rawData = {
    machineId: toOptionalString(formData.get("machineId")),
    title: toOptionalString(formData.get("title")),
    description: toOptionalString(formData.get("description")),
    severity: toOptionalString(formData.get("severity")),
  };

  const validation = publicIssueSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0]?.message ?? "Invalid input";
    redirectWithError(firstError);
  }

  const parsedData: PublicIssueInput = validation.data!;
  const { machineId, title, description, severity } = parsedData;

  try {
    const [issue] = await db
      .insert(issues)
      .values({
        machineId,
        title,
        description: description ?? null,
        severity,
        reportedBy: null,
        status: "new",
      })
      .returning();

    if (!issue) {
      throw new Error("Issue creation returned empty result");
    }

    await createTimelineEvent(issue.id, "Issue reported via public form");

    log.info(
      { action: "publicIssueReport", issueId: issue.id, machineId },
      "Anonymous issue reported"
    );

    revalidatePath("/issues");
    revalidatePath(`/machines/${machineId}`);
    redirect("/report/success");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    log.error(
      {
        action: "publicIssueReport",
        machineId,
        error: error instanceof Error ? error.message : "Unknown",
      },
      "Failed to submit public issue"
    );
    redirectWithError("Unable to submit the issue. Please try again.");
  }
}

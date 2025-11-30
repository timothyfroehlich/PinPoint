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
    redirectWithError(
      `Too many submissions. Please try again in ${resetTime}.`
    );
  }

  const parsed = parsePublicIssueForm(formData);
  if (!parsed.success) {
    redirectWithError(parsed.error);
    return;
  }

  const parsedData = parsed.data;
  const { machineId, title, description, severity } = parsedData;

  try {
    await createIssue({
      title,
      description: description ?? null,
      machineId,
      severity,
      reportedBy: null,
    });

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

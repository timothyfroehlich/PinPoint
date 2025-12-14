"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";
import { log } from "~/lib/logger";
import { createClient } from "~/lib/supabase/server";
import { createIssue } from "~/services/issues";
import {
  checkPublicIssueLimit,
  formatResetTime,
  getClientIp,
} from "~/lib/rate-limit";
import { parsePublicIssueForm } from "./validation";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import { eq } from "drizzle-orm";

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

  const parsedData = parsed.data;
  const { machineId, title, description, severity } = parsedData;

  // Resolve machine initials from ID
  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, machineId),
    columns: { initials: true },
  });

  if (!machine) {
    redirectWithError("Machine not found.");
    return;
  }

  // 3. Check for authenticated user (optional)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    await createIssue({
      title,
      description: description ?? null,
      machineInitials: machine.initials,
      severity,
      reportedBy: user?.id ?? null,
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

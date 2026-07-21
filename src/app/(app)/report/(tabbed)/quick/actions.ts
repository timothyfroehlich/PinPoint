"use server";

import * as Sentry from "@sentry/nextjs";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import { createClient } from "~/lib/supabase/server";
import { checkPermission } from "~/lib/permissions/helpers";
import { getUserAccessLevel } from "~/lib/permissions/access";
import { createIssue } from "~/services/issues";
import { dispatchNotification } from "~/lib/notifications";
import { reportError } from "~/lib/observability/report-error";
import { log } from "~/lib/logger";
import { parseQuickRow, type ParsedQuickRow } from "./validation";
import { QUICK_MAX_ROWS, type QuickRowInput } from "./schemas";

export type QuickRowResult =
  | { index: number; ok: true; issueNumber: number; machineInitials: string }
  | { index: number; ok: false; error: string };

export type QuickSubmitResponse =
  { ok: true; results: QuickRowResult[] } | { ok: false; error: string };

/** Resolve the current user's technician+ access, or null if not permitted. */
async function requireQuickReporter(): Promise<{ userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const accessLevel = await getUserAccessLevel(user.id);
  if (!checkPermission("issues.report.quick", accessLevel)) return null;
  return { userId: user.id };
}

/** Create a single validated row. Never throws for a row-level problem —
 *  returns an `ok: false` result the caller surfaces inline. */
async function createOne(
  index: number,
  rawRow: QuickRowInput,
  reportedBy: string
): Promise<QuickRowResult> {
  const parsed: ParsedQuickRow = parseQuickRow(rawRow);
  if (!parsed.success) return { index, ok: false, error: parsed.error };
  const data = parsed.data;

  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, data.machineId),
    columns: { initials: true },
  });
  if (!machine) {
    return {
      index,
      ok: false,
      error: "Machine not found — pick one from the list",
    };
  }

  try {
    const { issue, deliveryPlan } = await createIssue({
      title: data.title,
      description: data.description ?? null,
      machineInitials: machine.initials,
      severity: data.severity,
      priority: data.priority,
      frequency: data.frequency,
      status: data.status,
      reportedBy,
      reporterName: null,
      reporterEmail: null,
      assignedTo:
        data.assignedTo && data.assignedTo.length > 0 ? data.assignedTo : null,
      autoWatchReporter: data.watch,
      idempotencyKey: data.idempotencyKey,
    });

    after(() => dispatchNotification(deliveryPlan));

    revalidatePath("/m");
    revalidatePath(`/m/${machine.initials}`);
    revalidatePath(`/m/${machine.initials}/i`);

    return {
      index,
      ok: true,
      issueNumber: issue.issueNumber,
      machineInitials: machine.initials,
    };
  } catch (error) {
    reportError(error, { action: "submitQuickIssueRow", index });
    log.error(
      { index, err: error instanceof Error ? error.message : error },
      "Quick row create failed"
    );
    return {
      index,
      ok: false,
      error: "Could not create this issue — try again",
    };
  }
}

/** Batch submit. Creates each good row; bad rows come back flagged. */
export async function submitQuickIssuesAction(
  rows: QuickRowInput[]
): Promise<QuickSubmitResponse> {
  try {
    const reporter = await requireQuickReporter();
    if (!reporter)
      return { ok: false, error: "You don't have permission to quick report." };
    if (rows.length === 0) return { ok: false, error: "No issues to submit." };
    if (rows.length > QUICK_MAX_ROWS) {
      return {
        ok: false,
        error: `Too many rows — submit at most ${QUICK_MAX_ROWS} at a time.`,
      };
    }

    const results: QuickRowResult[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) {
        results.push({ index: i, ok: false, error: "Empty row" });
        continue;
      }
      results.push(await createOne(i, row, reporter.userId));
    }
    return { ok: true, results };
  } finally {
    await Sentry.flush(2000);
  }
}

/** Single-row submit (quick-submit). */
export async function submitQuickIssueRowAction(
  row: QuickRowInput
): Promise<QuickRowResult> {
  try {
    const reporter = await requireQuickReporter();
    if (!reporter)
      return {
        index: 0,
        ok: false,
        error: "You don't have permission to quick report.",
      };
    return await createOne(0, row, reporter.userId);
  } finally {
    await Sentry.flush(2000);
  }
}

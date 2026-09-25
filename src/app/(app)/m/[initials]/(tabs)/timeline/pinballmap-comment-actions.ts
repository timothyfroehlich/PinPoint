/**
 * Convert an imported Pinball Map comment to an issue (pinballmap spec 7.5,
 * 7.8; PP-o355.4).
 *
 * Always an explicit person's action — PinPoint never creates an issue from a
 * Pinball Map comment on its own. The comment may be converted at most once
 * across every timeline copy; `createIssue` claims it inside the issue's own
 * transaction, so two people converting at once cannot both succeed.
 */

"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { formatIssueId } from "~/lib/issues/utils";
import { log } from "~/lib/logger";
import { dispatchNotification } from "~/lib/notifications";
import { getUserAccessLevel } from "~/lib/permissions/access";
import { checkPermission } from "~/lib/permissions/helpers";
import { convertedIssueDescription } from "~/lib/pinballmap/comment-conversion";
import { err, type Result } from "~/lib/result";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import {
  issues,
  machines,
  pinballmapComments,
  timelineEvents,
} from "~/server/db/schema";
import {
  createIssue,
  PinballMapCommentAlreadyConvertedError,
} from "~/services/issues";

const convertSchema = z.object({
  machineId: z.string().uuid(),
  conditionId: z.coerce.number().int().positive(),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(60, "Title must be 60 characters or less"),
  severity: z.enum(["cosmetic", "minor", "major", "unplayable"], {
    message: "Select a severity",
  }),
});

/** Success redirects to the new issue, so only failures come back. */
export type ConvertPinballMapCommentResult = Result<
  never,
  "UNAUTHORIZED" | "VALIDATION" | "NOT_FOUND" | "ALREADY_CONVERTED" | "SERVER"
>;

function issueUrl(machineInitials: string, issueNumber: number): string {
  return `/m/${machineInitials}/i/${String(issueNumber)}`;
}

export async function convertPinballMapCommentAction(
  _prev: ConvertPinballMapCommentResult | undefined,
  formData: FormData
): Promise<ConvertPinballMapCommentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Sign in to convert a comment");

  const accessLevel = await getUserAccessLevel(user.id);
  if (!checkPermission("issues.report", accessLevel)) {
    return err("UNAUTHORIZED", "You cannot report issues");
  }

  const parsed = convertSchema.safeParse({
    machineId: formData.get("machineId"),
    conditionId: formData.get("conditionId"),
    title: formData.get("title"),
    severity: formData.get("severity"),
  });
  if (!parsed.success) {
    return err(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid conversion"
    );
  }
  const { machineId, conditionId, title, severity } = parsed.data;

  // The comment must have a copy on this machine's timeline: conversion
  // starts from a covering machine (spec 7.5), never an arbitrary pairing.
  const [source] = await db
    .select({
      machineInitials: machines.initials,
      comment: pinballmapComments.comment,
      username: pinballmapComments.username,
      commentedAt: pinballmapComments.commentedAt,
      locationId: pinballmapComments.locationId,
      convertedInitials: issues.machineInitials,
      convertedNumber: issues.issueNumber,
    })
    .from(timelineEvents)
    .innerJoin(machines, eq(timelineEvents.machineId, machines.id))
    .innerJoin(
      pinballmapComments,
      eq(
        pinballmapComments.conditionId,
        sql<number>`(${timelineEvents.eventData}->>'conditionId')::integer`
      )
    )
    .leftJoin(issues, eq(pinballmapComments.convertedIssueId, issues.id))
    .where(
      and(
        eq(timelineEvents.machineId, machineId),
        eq(timelineEvents.sourceType, "pinballmap"),
        sql`${timelineEvents.eventData}->>'conditionId' = ${String(conditionId)}`
      )
    )
    .limit(1);
  if (!source) return err("NOT_FOUND", "Comment not found on this machine");

  if (source.convertedInitials !== null && source.convertedNumber !== null) {
    return err(
      "ALREADY_CONVERTED",
      `Already converted to ${formatIssueId(source.convertedInitials, source.convertedNumber)}`
    );
  }

  let createdUrl: string;
  try {
    const { issue, deliveryPlan } = await createIssue({
      title,
      description: convertedIssueDescription({
        comment: source.comment,
        username: source.username,
        commentedAt: source.commentedAt,
        locationId: source.locationId,
      }),
      machineInitials: source.machineInitials,
      severity,
      frequency: "not_specified",
      reportedBy: user.id,
      pinballmapConditionId: conditionId,
    });
    after(() => dispatchNotification(deliveryPlan));

    // Every copy of the comment now links to the issue (spec 7.8), and the
    // copies can sit on any covering machine's timeline.
    revalidatePath("/m", "layout");
    createdUrl = issueUrl(issue.machineInitials, issue.issueNumber);
  } catch (error) {
    if (error instanceof PinballMapCommentAlreadyConvertedError) {
      revalidatePath("/m", "layout");
      return err("ALREADY_CONVERTED", "Already converted by someone else");
    }
    log.error(
      {
        err: error,
        conditionId,
        machineId,
        action: "convertPinballMapComment",
      },
      "Converting a Pinball Map comment to an issue failed"
    );
    return err("SERVER", "Could not convert the comment. Try again.");
  }
  // Outside the try: `redirect` works by throwing.
  redirect(createdUrl);
}

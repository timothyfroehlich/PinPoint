/**
 * Timeline Event Helpers
 *
 * Helpers for creating system-generated timeline events (issue comments with is_system: true).
 * These events track status changes, assignments, severity changes, etc.
 */

import { db } from "~/server/db";
import { issueComments } from "~/server/db/schema";

/**
 * Create a system timeline event
 *
 * Inserts an issue_comment with is_system: true.
 * System events don't have an author (authorId is null).
 *
 * @param issueId - The issue to create the event for
 * @param content - The event message (e.g., "Status changed from new to in_progress")
 * @returns The created comment
 */
export async function createTimelineEvent(
  issueId: string,
  content: string
): Promise<void> {
  await db.insert(issueComments).values({
    issueId,
    content,
    isSystem: true,
    authorId: null, // System events have no author
  });
}

/**
 * Generate status change event message
 */
export function formatStatusChange(
  oldStatus: "new" | "in_progress" | "resolved",
  newStatus: "new" | "in_progress" | "resolved"
): string {
  const statusLabels: Record<string, string> = {
    new: "New",
    in_progress: "In Progress",
    resolved: "Resolved",
  };

  return `Status changed from ${statusLabels[oldStatus]} to ${statusLabels[newStatus]}`;
}

/**
 * Generate severity change event message
 */
export function formatSeverityChange(
  oldSeverity: "minor" | "playable" | "unplayable",
  newSeverity: "minor" | "playable" | "unplayable"
): string {
  const severityLabels: Record<string, string> = {
    minor: "Minor",
    playable: "Playable",
    unplayable: "Unplayable",
  };

  return `Severity changed from ${severityLabels[oldSeverity]} to ${severityLabels[newSeverity]}`;
}

/**
 * Generate assignment event message
 */
export function formatAssignment(userName: string): string {
  return `Assigned to ${userName}`;
}

/**
 * Generate unassignment event message
 */
export function formatUnassignment(): string {
  return "Unassigned";
}

/**
 * Generate issue resolved event message
 */
export function formatResolved(): string {
  return "Marked as resolved";
}

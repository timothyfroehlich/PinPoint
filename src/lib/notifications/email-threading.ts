/**
 * RFC 5322 email threading helpers for per-issue notification threads.
 *
 * Gmail (and compliant clients) thread messages that share a References header
 * pointing to the same root Message-ID. By deriving a stable synthetic root
 * Message-ID from the issue's formatted ID, every notification about the same
 * issue will be grouped in a single thread — even when no literal message with
 * that ID was ever sent.
 *
 * GitHub uses the same pattern: a stable synthetic root ID per issue,
 * In-Reply-To + References on every notification.
 */

const DOMAIN = "pinpoint.app";

/**
 * Returns the stable synthetic root Message-ID for a given issue.
 *
 * Format: <issue-PP-1234@pinpoint.app>
 *
 * The value is deterministic (no randomness) so it is safe to call on every
 * delivery without persisting the ID to the database.
 */
export function getIssueRootMessageId(formattedIssueId: string): string {
  return `<issue-${formattedIssueId}@${DOMAIN}>`;
}

export interface ThreadingHeaders {
  inReplyTo: string;
  references: string;
}

/**
 * Returns the RFC 5322 threading headers for a notification tied to an issue.
 *
 * Both In-Reply-To and References point to the same stable root Message-ID so
 * that all emails for the issue appear in a single Gmail/Apple Mail/Outlook
 * thread regardless of arrival order.
 *
 * Usage: pass the result to EmailParams.inReplyTo / EmailParams.references.
 */
export function getThreadingHeaders(
  formattedIssueId: string
): ThreadingHeaders {
  const rootId = getIssueRootMessageId(formattedIssueId);
  return {
    inReplyTo: rootId,
    references: rootId,
  };
}

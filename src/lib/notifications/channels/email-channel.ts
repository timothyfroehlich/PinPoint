import "server-only";
import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import sanitizeHtml from "sanitize-html";
import { log } from "~/lib/logger";
import { NON_TEXT_TAGS } from "~/lib/sanitize-html-config";
import { isInternalAccount } from "~/lib/auth/internal-accounts";
import { getSiteUrl } from "~/lib/url";
import { getThreadingHeaders } from "~/lib/notifications/email-threading";
import type {
  NotificationChannel,
  NotificationPreferencesRow,
  ChannelContext,
  DeliveryResult,
} from "./types";
import type { NotificationType } from "~/lib/notifications/dispatch";

/**
 * Strict sanitization policy for email notifications.
 * Prevents remote images, tracking pixels, and complex HTML.
 */
const EMAIL_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h2",
    "h3",
    "p",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "b",
    "i",
    "a",
    "span",
    "br",
    "blockquote",
    "hr",
    "code",
    "pre",
    "s",
  ],
  nonTextTags: [...NON_TEXT_TAGS],
  allowedAttributes: {
    a: ["href"],
    span: ["style"],
  },
};

let warnedMissingSecret = false;

/**
 * Returns the HMAC signing secret for unsubscribe tokens.
 * Uses UNSUBSCRIBE_SIGNING_SECRET, which must be set independently of the
 * Supabase service role key so that Supabase key rotation does not invalidate
 * outstanding unsubscribe URLs.
 *
 * Logs once in production if the secret is missing — without it, unsubscribe
 * links are omitted from outgoing emails and any incoming /api/unsubscribe
 * request will reject, which is a CAN-SPAM compliance risk worth surfacing.
 */
function getUnsubscribeSigningSecret(): string {
  const secret = process.env["UNSUBSCRIBE_SIGNING_SECRET"] ?? "";
  if (!secret && !warnedMissingSecret) {
    warnedMissingSecret = true;
    if (process.env["VERCEL_ENV"] === "production") {
      log.error(
        { action: "unsubscribe.signingSecretMissing" },
        "UNSUBSCRIBE_SIGNING_SECRET not set in production — unsubscribe links " +
          "will be omitted from outgoing emails and incoming requests will reject."
      );
    }
  }
  return secret;
}

/**
 * Generate an HMAC-signed unsubscribe token for a user.
 * Uses UNSUBSCRIBE_SIGNING_SECRET as the signing secret.
 */
export function generateUnsubscribeToken(userId: string): string {
  const secret = getUnsubscribeSigningSecret();
  if (!secret) {
    return "";
  }
  return createHmac("sha256", secret)
    .update(userId + ":unsubscribe")
    .digest("hex");
}

/**
 * Verify an unsubscribe token against a userId.
 */
export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const expected = generateUnsubscribeToken(userId);
  if (!expected || token.length === 0) return false;
  const expectedBuf = Buffer.from(expected, "utf-8");
  const tokenBuf = Buffer.from(token, "utf-8");
  if (expectedBuf.length !== tokenBuf.length) return false;
  return timingSafeEqual(expectedBuf, tokenBuf);
}

function getEmailFooter(userId?: string): string {
  const siteUrl = getSiteUrl();
  const settingsUrl = `${siteUrl}/settings`;

  let unsubscribeLink = "";
  if (userId) {
    const token = generateUnsubscribeToken(userId);
    if (token) {
      const unsubscribeUrl = `${siteUrl}/api/unsubscribe?uid=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;
      unsubscribeLink = ` · <a href="${unsubscribeUrl}" style="color: #888;">Unsubscribe from all emails</a>`;
    }
  }

  return `
    <hr style="margin-top: 32px; border: none; border-top: 1px solid #eee;" />
    <p style="font-size: 12px; color: #888; margin-top: 16px;">
      <a href="${settingsUrl}" style="color: #888;">Manage notification settings</a>${unsubscribeLink}
    </p>
  `;
}

/**
 * Returns the email subject for a notification.
 *
 * The five issue-tied types (new_issue, issue_assigned, issue_status_changed,
 * new_comment, mentioned) all share the same stable format so that email
 * clients thread them together under one row:
 *
 *   [MachineName] PP-1234: Issue Title
 *
 * The event type (what happened) has moved into the email body header so it
 * remains visible once the thread is opened.
 *
 * machine_ownership_changed is NOT issue-tied and keeps its own distinct
 * subject so it does not thread with issue notifications.
 */
export function getEmailSubject(
  type: NotificationType,
  issueTitle?: string,
  machineName?: string,
  formattedIssueId?: string,
  newStatus?: string
): string {
  const prefix = machineName ? `[${machineName}] ` : "";
  switch (type) {
    case "new_issue":
    case "issue_assigned":
    case "issue_status_changed":
    case "new_comment":
    case "mentioned":
      // Stable subject for all issue-tied types — enables Gmail/Apple Mail threading.
      return formattedIssueId
        ? `${prefix}${formattedIssueId}: ${issueTitle}`
        : `${prefix}${issueTitle}`;
    case "machine_ownership_changed":
      return newStatus === "removed"
        ? `${prefix}Ownership Update: You have been removed as an owner`
        : `${prefix}Ownership Update: You have been added as an owner`;
    default:
      return "PinPoint Notification";
  }
}

export interface EmailHtmlOptions {
  type: NotificationType;
  issueTitle?: string | undefined;
  machineName?: string | undefined;
  formattedIssueId?: string | undefined;
  commentContent?: string | undefined;
  newStatus?: string | undefined;
  userId?: string | undefined;
  issueDescription?: string | undefined;
}

/**
 * Returns the human-readable event-type label for issue-tied notifications.
 * This label moves into the email body now that the subject is stable per issue.
 */
export function getEventTypeLabel(type: NotificationType): string {
  switch (type) {
    case "new_issue":
      return "New Issue";
    case "issue_assigned":
      return "Issue Assigned";
    case "issue_status_changed":
      return "Status Changed";
    case "new_comment":
      return "New Comment";
    case "mentioned":
      return "You Were Mentioned";
    case "machine_ownership_changed":
      // Not issue-tied; the email subject already carries the label, so the
      // body header is empty.
      return "";
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

export function getEmailHtml({
  type,
  issueTitle,
  machineName,
  formattedIssueId,
  commentContent,
  newStatus,
  userId,
  issueDescription,
}: EmailHtmlOptions): string {
  let body = "";
  switch (type) {
    case "new_issue":
      body = "A new issue has been reported.";
      break;
    case "issue_assigned":
      body = "You have been assigned to this issue.";
      break;
    case "issue_status_changed":
      body = `Status changed to: <strong>${newStatus ? sanitizeHtml(newStatus, EMAIL_SANITIZE_OPTIONS) : ""}</strong>`;
      break;
    case "new_comment": {
      const sanitizedComment = commentContent
        ? sanitizeHtml(commentContent, EMAIL_SANITIZE_OPTIONS)
        : "";
      body = `New comment:<br/><blockquote>${sanitizedComment}</blockquote>`;
      break;
    }
    case "mentioned": {
      const sanitizedComment = commentContent
        ? sanitizeHtml(commentContent, EMAIL_SANITIZE_OPTIONS)
        : "";
      body = `You were mentioned in an issue${sanitizedComment ? `:<br/><blockquote>${sanitizedComment}</blockquote>` : "."}`;
      break;
    }
    case "machine_ownership_changed":
      body = newStatus?.includes("removed")
        ? `You have been <strong>removed</strong> as an owner of <strong>${machineName ? sanitizeHtml(machineName, EMAIL_SANITIZE_OPTIONS) : "a machine"}</strong>. You will no longer receive notifications for new issues on this machine.`
        : `You have been <strong>added</strong> as an owner of <strong>${machineName ? sanitizeHtml(machineName, EMAIL_SANITIZE_OPTIONS) : "a machine"}</strong>. You will receive notifications for new issues reported on this machine.`;
      break;
  }

  // For issue-tied types, the event-type label moves into the body since the
  // subject is now stable. We render it as a small h3 above the body text.
  const eventLabel = getEventTypeLabel(type);

  const siteUrl = getSiteUrl();
  const sanitizedMachineName = machineName
    ? sanitizeHtml(machineName, EMAIL_SANITIZE_OPTIONS)
    : "";
  const machinePrefix = sanitizedMachineName
    ? `[${sanitizedMachineName}] `
    : "";
  const sanitizedIssueTitle = issueTitle
    ? sanitizeHtml(issueTitle, EMAIL_SANITIZE_OPTIONS)
    : "";
  const sanitizedIssueId = formattedIssueId
    ? sanitizeHtml(formattedIssueId, EMAIL_SANITIZE_OPTIONS)
    : "";

  let issueUrl = `${siteUrl}/issues`;
  if (formattedIssueId) {
    // Format is [INITIALS]-[NUMBER]; initials are 2-6 alphanumeric chars (no hyphens)
    const parts = formattedIssueId.split("-");
    if (parts.length >= 2) {
      const numberPart = parts.pop();
      const initialsPart = parts.join("-");
      // Validate initialsPart matches schema: exactly 2-6 uppercase letters or digits
      if (
        numberPart &&
        /^\d+$/.test(numberPart) &&
        /^[A-Z0-9]{2,6}$/.test(initialsPart)
      ) {
        const issueNumber = parseInt(numberPart, 10);
        // URL encode for defense-in-depth, even though validation ensures only safe characters
        issueUrl = `${siteUrl}/m/${encodeURIComponent(initialsPart)}/i/${issueNumber}`;
      }
    }
  }

  const sanitizedDescription =
    (type === "new_issue" || type === "issue_assigned") && issueDescription
      ? sanitizeHtml(issueDescription, EMAIL_SANITIZE_OPTIONS)
      : "";
  const showDescription = !!sanitizedDescription;

  return `
      <h2>${machinePrefix}${sanitizedIssueId ? `${sanitizedIssueId}: ` : ""}${sanitizedIssueTitle}</h2>
      ${eventLabel ? `<h3 style="color: #555; font-weight: 600; margin-bottom: 8px;">${eventLabel}</h3>` : ""}
      <div>${body}</div>
      ${showDescription ? `<blockquote>${sanitizedDescription}</blockquote>` : ""}
      <p><a href="${issueUrl}">View Issue</a></p>
      ${getEmailFooter(userId)}
    `;
}

export const emailChannel: NotificationChannel = {
  key: "email",
  shouldDeliver(
    prefs: NotificationPreferencesRow,
    type: NotificationType
  ): boolean {
    if (!prefs.emailEnabled) return false;
    switch (type) {
      case "issue_assigned":
        return prefs.emailNotifyOnAssigned;
      case "issue_status_changed":
        return prefs.emailNotifyOnStatusChange;
      case "new_comment":
        return prefs.emailNotifyOnNewComment;
      case "new_issue":
        return prefs.emailNotifyOnNewIssue || prefs.emailWatchNewIssuesGlobal;
      case "machine_ownership_changed":
        // Critical event — preferences cannot opt out (only main switch can).
        return true;
      case "mentioned":
        return prefs.emailNotifyOnMentioned;
    }
  },
  async deliver(ctx: ChannelContext): Promise<DeliveryResult> {
    if (!ctx.email || isInternalAccount(ctx.email)) {
      return { ok: false, reason: "skipped" };
    }

    try {
      const { sendEmail } = await import("~/lib/email/client");

      // Derive RFC 5322 threading headers for issue-tied notification types.
      // machine_ownership_changed is not issue-tied and must not be threaded.
      const isIssueTied =
        ctx.type !== "machine_ownership_changed" &&
        ctx.formattedIssueId !== undefined;
      const threadingHeaders =
        isIssueTied && ctx.formattedIssueId
          ? getThreadingHeaders(ctx.formattedIssueId)
          : undefined;

      await sendEmail({
        to: ctx.email,
        subject: getEmailSubject(
          ctx.type,
          ctx.issueTitle,
          ctx.machineName,
          ctx.formattedIssueId,
          ctx.newStatus
        ),
        html: getEmailHtml({
          type: ctx.type,
          issueTitle: ctx.issueTitle,
          machineName: ctx.machineName,
          formattedIssueId: ctx.formattedIssueId,
          commentContent: ctx.commentContent,
          newStatus: ctx.newStatus,
          userId: ctx.userId,
          issueDescription: ctx.issueDescription,
        }),
        ...threadingHeaders,
      });
      return { ok: true };
    } catch (err) {
      log.error({ err }, "Failed to send email notification");
      return { ok: false, reason: "transient" };
    }
  },
};

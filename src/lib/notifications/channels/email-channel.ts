import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import sanitizeHtml from "sanitize-html";
import { sendEmail } from "~/lib/email/client";
import { log } from "~/lib/logger";
import { isInternalAccount } from "~/lib/auth/internal-accounts";
import { getSiteUrl } from "~/lib/url";
import type {
  NotificationChannel,
  NotificationPreferencesRow,
  ChannelContext,
  DeliveryResult,
} from "./types";
import type { NotificationType } from "~/lib/notifications/dispatch";

/**
 * Generate an HMAC-signed unsubscribe token for a user.
 * Uses SUPABASE_SERVICE_ROLE_KEY as the signing secret.
 */
export function generateUnsubscribeToken(userId: string): string {
  const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"];
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
      return `${prefix}New Issue ${formattedIssueId ? `(${formattedIssueId})` : ""}: ${issueTitle}`;
    case "issue_assigned":
      return `${prefix}Issue Assigned ${formattedIssueId ? `(${formattedIssueId})` : ""}: ${issueTitle}`;
    case "issue_status_changed":
      return `${prefix}Status Changed ${formattedIssueId ? `(${formattedIssueId})` : ""}: ${issueTitle}`;
    case "new_comment":
      return `${prefix}New Comment on ${formattedIssueId ? `(${formattedIssueId})` : ""}: ${issueTitle}`;
    case "mentioned":
      return `${prefix}You were mentioned in ${formattedIssueId ? `(${formattedIssueId})` : ""}: ${issueTitle}`;
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
      body = `Status changed to: <strong>${newStatus ? sanitizeHtml(newStatus) : ""}</strong>`;
      break;
    case "new_comment": {
      const sanitizedComment = commentContent
        ? sanitizeHtml(commentContent)
        : "";
      body = `New comment:<br/><blockquote>${sanitizedComment}</blockquote>`;
      break;
    }
    case "mentioned": {
      const sanitizedComment = commentContent
        ? sanitizeHtml(commentContent)
        : "";
      body = `You were mentioned in an issue${sanitizedComment ? `:<br/><blockquote>${sanitizedComment}</blockquote>` : "."}`;
      break;
    }
    case "machine_ownership_changed":
      body = newStatus?.includes("removed")
        ? `You have been <strong>removed</strong> as an owner of <strong>${machineName ? sanitizeHtml(machineName) : "a machine"}</strong>. You will no longer receive notifications for new issues on this machine.`
        : `You have been <strong>added</strong> as an owner of <strong>${machineName ? sanitizeHtml(machineName) : "a machine"}</strong>. You will receive notifications for new issues reported on this machine.`;
      break;
  }

  const siteUrl = getSiteUrl();
  const sanitizedMachineName = machineName ? sanitizeHtml(machineName) : "";
  const machinePrefix = sanitizedMachineName
    ? `[${sanitizedMachineName}] `
    : "";
  const sanitizedIssueTitle = issueTitle ? sanitizeHtml(issueTitle) : "";
  const sanitizedIssueId = formattedIssueId
    ? sanitizeHtml(formattedIssueId)
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
      ? sanitizeHtml(issueDescription)
      : "";
  const showDescription = !!sanitizedDescription;

  return `
      <h2>${machinePrefix}${sanitizedIssueId ? `${sanitizedIssueId}: ` : ""}${sanitizedIssueTitle}</h2>
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
      });
      return { ok: true };
    } catch (err) {
      log.error({ err }, "Failed to send email notification");
      return { ok: false, reason: "transient" };
    }
  },
};

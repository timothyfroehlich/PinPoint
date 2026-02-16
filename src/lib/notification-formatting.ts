import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import sanitizeHtml from "sanitize-html";
import { getSiteUrl } from "~/lib/url";
import { type NotificationType } from "~/lib/notifications";

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
    case "machine_ownership_changed":
      return newStatus === "removed"
        ? `${prefix}Ownership Update: You have been removed as an owner`
        : `${prefix}Ownership Update: You have been added as an owner`;
    default:
      return "PinPoint Notification";
  }
}

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

export function getEmailHtml(
  type: NotificationType,
  issueTitle?: string,
  machineName?: string,
  formattedIssueId?: string,
  commentContent?: string,
  newStatus?: string,
  userId?: string
): string {
  // Basic HTML for MVP
  let body = "";
  switch (type) {
    case "new_issue":
      body = `A new issue has been reported.`;
      break;
    case "issue_assigned":
      body = `You have been assigned to this issue.`;
      break;
    case "issue_status_changed":
      body = `Status changed to: <strong>${newStatus}</strong>`;
      break;
    case "new_comment": {
      // Sanitize comment content to prevent XSS
      const sanitizedComment = commentContent
        ? sanitizeHtml(commentContent)
        : "";
      body = `New comment:<br/><blockquote>${sanitizedComment}</blockquote>`;
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

  return `
      <h2>${machinePrefix}${sanitizedIssueId ? `${sanitizedIssueId}: ` : ""}${sanitizedIssueTitle}</h2>
      <p>${body}</p>
      <p><a href="${issueUrl}">View Issue</a></p>
      ${getEmailFooter(userId)}
    `;
}

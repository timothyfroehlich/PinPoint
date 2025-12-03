import sanitizeHtml from "sanitize-html";
import { getSiteUrl } from "~/lib/url";
import { type NotificationType } from "~/lib/notifications";

export function getEmailSubject(
  type: NotificationType,
  issueTitle?: string,
  machineName?: string
): string {
  const prefix = machineName ? `[${machineName}] ` : "";
  switch (type) {
    case "new_issue":
      return `${prefix}New Issue: ${issueTitle}`;
    case "issue_assigned":
      return `${prefix}Issue Assigned: ${issueTitle}`;
    case "issue_status_changed":
      return `${prefix}Status Changed: ${issueTitle}`;
    case "new_comment":
      return `${prefix}New Comment on: ${issueTitle}`;
    default:
      return "PinPoint Notification";
  }
}

export function getEmailHtml(
  type: NotificationType,
  issueTitle?: string,
  machineName?: string,
  commentContent?: string,
  newStatus?: string
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
  }

  const siteUrl = getSiteUrl();
  const machinePrefix = machineName ? `[${machineName}] ` : "";

  return `
      <h2>${machinePrefix}${issueTitle}</h2>
      <p>${body}</p>
      <p><a href="${siteUrl}/issues">View Issue</a></p>
    `;
}

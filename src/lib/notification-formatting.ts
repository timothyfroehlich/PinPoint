import sanitizeHtml from "sanitize-html";
import { getSiteUrl } from "~/lib/url";
import { type NotificationType } from "~/lib/notifications";

export function getEmailSubject(
  type: NotificationType,
  issueTitle?: string,
  machineName?: string,
  formattedIssueId?: string
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
    default:
      return "PinPoint Notification";
  }
}

export function getEmailHtml(
  type: NotificationType,
  issueTitle?: string,
  machineName?: string,
  formattedIssueId?: string,
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
    const parts = formattedIssueId.split("-");
    if (parts.length >= 2) {
      const numberPart = parts.pop();
      const initialsPart = parts.join("-");
      if (numberPart && /^\d+$/.test(numberPart)) {
        const issueNumber = parseInt(numberPart, 10);
        issueUrl = `${siteUrl}/m/${initialsPart}/i/${issueNumber}`;
      }
    }
  }

  return `
      <h2>${machinePrefix}${sanitizedIssueId ? `${sanitizedIssueId}: ` : ""}${sanitizedIssueTitle}</h2>
      <p>${body}</p>
      <p><a href="${issueUrl}">View Issue</a></p>
    `;
}

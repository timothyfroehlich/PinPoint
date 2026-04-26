import type { NotificationType } from "~/lib/notifications/dispatch";

export interface DiscordMessageInput {
  type: NotificationType;
  siteUrl: string;
  resourceType: "issue" | "machine";
  resourceId: string;
  issueTitle: string | undefined;
  formattedIssueId: string | undefined;
  machineName: string | undefined;
  newStatus: string | undefined;
  commentContent: string | undefined;
}

export function formatDiscordMessage(input: DiscordMessageInput): string {
  const link = buildResourceLink(input);
  const body = buildBody(input);
  const footer = `Manage notifications: ${input.siteUrl}/settings/notifications`;
  return `${body}\n${link}\n\n${footer}`;
}

function buildResourceLink(input: DiscordMessageInput): string {
  if (input.resourceType === "issue") {
    return `${input.siteUrl}/issues/${input.resourceId}`;
  }
  return `${input.siteUrl}/machines/${input.resourceId}`;
}

function buildBody(input: DiscordMessageInput): string {
  const id = input.formattedIssueId ?? "";
  const title = input.issueTitle ?? "";
  const machine = input.machineName ?? "a machine";

  switch (input.type) {
    case "issue_assigned":
      return `You were assigned ${id} — ${title}`;
    case "issue_status_changed":
      return `${id} — ${title} is now ${input.newStatus ?? "updated"}`;
    case "new_comment":
      return `New comment on ${id} — ${title}`;
    case "new_issue":
      return `New issue on ${machine}: ${id} — ${title}`;
    case "mentioned":
      return `You were mentioned on ${id} — ${title}`;
    case "machine_ownership_changed":
      return `Ownership changed for ${machine}`;
  }
}

import type { NotificationType } from "~/lib/notifications/dispatch";

const DISCORD_MAX_MESSAGE_LENGTH = 2000;

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
  const suffix = `\n${link}\n\n${footer}`;

  // Truncate body if the assembled message would exceed Discord's 2000-char
  // hard limit. The link and footer are auxiliary metadata users rely on, so
  // we preserve them and trim the body instead.
  const bodyBudget = DISCORD_MAX_MESSAGE_LENGTH - suffix.length;
  const safeBody =
    body.length <= bodyBudget ? body : body.slice(0, bodyBudget - 1) + "…";

  return `${safeBody}${suffix}`;
}

function buildResourceLink(input: DiscordMessageInput): string {
  if (input.resourceType === "issue") {
    return `${input.siteUrl}/issues/${input.resourceId}`;
  }
  return `${input.siteUrl}/machines/${input.resourceId}`;
}

function buildBody(input: DiscordMessageInput): string {
  const id = sanitize(input.formattedIssueId ?? "");
  const title = sanitize(input.issueTitle ?? "");
  const machine = sanitize(input.machineName ?? "a machine");
  const status = sanitize(input.newStatus ?? "updated");

  switch (input.type) {
    case "issue_assigned":
      return `You were assigned ${id} — ${title}`;
    case "issue_status_changed":
      return `${id} — ${title} is now ${status}`;
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

/**
 * Make user-supplied content safe to interpolate into a Discord message.
 *
 * Discord renders message content as Markdown and parses mentions
 * (`@everyone`, `@here`, `<@USER_ID>`, `<#CHANNEL_ID>`, `<@&ROLE_ID>`).
 * Without escaping, an issue title containing `@everyone` would ping every
 * member of any guild the bot is a member of, and titles like `**foo**`
 * would render formatted.
 *
 * Strategy:
 *   - Insert a zero-width space after `@` to break mention parsing while
 *     keeping the message readable.
 *   - Backslash-escape Markdown control characters so they render literally.
 */
const ZERO_WIDTH_SPACE = "\u200B";

function sanitize(value: string): string {
  return value
    .replace(/@/g, `@${ZERO_WIDTH_SPACE}`)
    .replace(/[\\*_~`|>]/g, (m) => `\\${m}`);
}

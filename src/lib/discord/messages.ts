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
  /**
   * Comment text passed through from the dispatcher but intentionally NOT
   * rendered in the DM body. Carrying it here keeps the channel signature
   * uniform with the email/in-app channels (which DO show snippets in
   * their own templates) without committing to a Discord layout decision —
   * if a future PR wants to inline a preview, the data is already wired.
   * Privacy: don't add it to the body without an explicit decision.
   */
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
    bodyBudget <= 0 || body.length > bodyBudget
      ? body.slice(0, Math.max(0, bodyBudget - 1)) + "…"
      : body;

  const assembled = `${safeBody}${suffix}`;
  // Belt-and-suspenders: if the suffix alone exceeds the limit (pathological
  // siteUrl), hard-cap the final output. Discord rejects oversized messages
  // with 400, which classifies as transient and would silently retry forever.
  return assembled.length > DISCORD_MAX_MESSAGE_LENGTH
    ? assembled.slice(0, DISCORD_MAX_MESSAGE_LENGTH - 1) + "…"
    : assembled;
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
 * Discord renders message content as Markdown and parses mentions:
 *   - `@everyone` / `@here`
 *   - `<@USER_ID>` / `<@!USER_ID>` (user mentions)
 *   - `<@&ROLE_ID>` (role mentions)
 *   - `<#CHANNEL_ID>` (channel mentions)
 *
 * Two layers of defense, separated by responsibility:
 *
 *   1. `allowed_mentions: { parse: [] }` on the postMessage POST body
 *      (see `src/lib/discord/client.ts`) is the actual security gate —
 *      Discord refuses to deliver any user/role/channel/everyone ping
 *      even if the text matches a mention pattern. Load-bearing — do
 *      not remove it.
 *   2. `sanitize()` is the rendering layer. Even when Discord refuses
 *      to ping, the recipient still SEES `<@123>` rendered as
 *      "@username" in their DM. A malicious issue title could
 *      impersonate "you've been mentioned by @admin" with no actual
 *      ping firing. Inserting a zero-width space after `@` and `<`
 *      breaks the mention syntax so the literal text shows through.
 *
 * Strategy:
 *   - Insert a zero-width space after `@` (covers `@everyone`/`@here`
 *     and the `@` inside `<@…>` forms).
 *   - Insert a zero-width space after `<` (covers `<#CHANNEL_ID>`,
 *     which has no `@`, plus belt-and-suspenders on `<@…>` forms).
 *   - Backslash-escape Markdown control characters so titles like
 *     `**foo**` render literally.
 */
const ZERO_WIDTH_SPACE = "\u200B";

function sanitize(value: string): string {
  return value
    .replace(/@/g, `@${ZERO_WIDTH_SPACE}`)
    .replace(/</g, `<${ZERO_WIDTH_SPACE}`)
    .replace(/[\\*_~`|>]/g, (m) => `\\${m}`);
}

import {
  getIssueFrequencyLabel,
  getIssueSeverityLabel,
  getIssueStatusLabel,
} from "~/lib/issues/status";
import type { IssueStatus } from "~/lib/issues/status";
import type { IssueFrequency, IssueSeverity } from "~/lib/types";
import type { RecipientReason } from "~/lib/notifications/events";
import { buildResourceUrl } from "~/lib/notifications/resource-url";

export {
  formatDiscordImprovementNotice,
  formatDiscordWelcomeMessage,
} from "~/lib/discord/system-messages";

const DISCORD_MAX_MESSAGE_LENGTH = 2000;
const DISCORD_MAX_ACTOR_LABEL_LENGTH = 256;

interface DiscordIssueMessageBase {
  siteUrl: string;
  resourceType: "issue";
  issueTitle: string | undefined;
  formattedIssueId: string | undefined;
  machineName: string | undefined;
  actorName: string | undefined;
  recipientReason: RecipientReason;
}

export type DiscordMessageInput =
  | (DiscordIssueMessageBase & {
      type: "new_issue";
      severity: IssueSeverity | undefined;
      frequency: IssueFrequency | undefined;
    })
  | (DiscordIssueMessageBase & {
      type: "issue_assigned";
      severity: IssueSeverity | undefined;
    })
  | (DiscordIssueMessageBase & {
      type: "issue_status_changed";
      oldStatus: IssueStatus;
      newStatus: IssueStatus;
    })
  | (DiscordIssueMessageBase & {
      type: "new_comment" | "mentioned";
      commentContent: string | undefined;
      commentId: string | undefined;
      attachmentCount: number;
    })
  | {
      type: "machine_ownership_changed";
      siteUrl: string;
      resourceType: "machine";
      machineName: string | undefined;
      machineInitials: string | undefined;
      ownershipChange: "added" | "removed";
    };

export function formatDiscordMessage(input: DiscordMessageInput): string {
  return clampDiscordMessage(formatDiscordMessageBody(input));
}

function clampDiscordMessage(message: string): string {
  return message.length <= DISCORD_MAX_MESSAGE_LENGTH
    ? message
    : `${message.slice(0, DISCORD_MAX_MESSAGE_LENGTH - 1)}…`;
}

function formatDiscordMessageBody(input: DiscordMessageInput): string {
  if (input.type === "machine_ownership_changed") {
    const machine = sanitizeDiscordText(input.machineName ?? "a machine");
    const url = buildResourceUrl(input);
    const prefix =
      input.ownershipChange === "added"
        ? "**You now own ["
        : "**You no longer own [";
    const suffix =
      input.ownershipChange === "added"
        ? `](${url})**\nYou’ll receive issue activity for this machine.`
        : `](${url})**\nYou won’t receive owner notifications for this machine.`;
    const machineBudget =
      DISCORD_MAX_MESSAGE_LENGTH - prefix.length - suffix.length;
    const linkedMachine =
      machine.length <= machineBudget
        ? machine
        : `${machine.slice(0, Math.max(0, machineBudget - 1))}…`;
    return `${prefix}${linkedMachine}${suffix}`;
  }

  const url = buildResourceUrl(input);
  const commentUrl =
    (input.type === "new_comment" || input.type === "mentioned") &&
    input.commentId
      ? `${url}#comment-${encodeURIComponent(input.commentId)}`
      : url;
  const id = sanitizeDiscordText(input.formattedIssueId ?? "Issue");
  const title = sanitizeDiscordText(input.issueTitle ?? "Untitled issue");
  const machine = sanitizeDiscordText(input.machineName ?? "Unknown machine");
  const actorName = input.actorName
    ? sanitizeDiscordText(input.actorName)
    : undefined;
  const actor = actorName ?? "Anonymous";
  const commentActor = clampDiscordText(actor, DISCORD_MAX_ACTOR_LABEL_LENGTH);

  switch (input.type) {
    case "new_issue":
      return [
        `**[${id}](${url}) — ${title}**`,
        [
          machine,
          input.severity ? getIssueSeverityLabel(input.severity) : undefined,
          input.frequency ? getIssueFrequencyLabel(input.frequency) : undefined,
        ]
          .filter((value): value is string => value !== undefined)
          .join(" · "),
        `${actorName ? `Reported by ${actorName}` : "Reported anonymously"} · ${formatRecipientReason(input.recipientReason)}`,
      ].join("\n");
    case "issue_assigned":
      return [
        `**[${id}](${url}) assigned to you**`,
        [
          title,
          machine,
          input.severity ? getIssueSeverityLabel(input.severity) : undefined,
        ]
          .filter((value): value is string => value !== undefined)
          .join(" · "),
        `Assigned by ${actor}`,
      ].join("\n");
    case "issue_status_changed":
      return [
        `**[${id}](${url}) moved to ${getIssueStatusLabel(input.newStatus)}**`,
        `${title} · ${machine} · previously ${getIssueStatusLabel(input.oldStatus)}`,
        `Changed by ${actor} · ${formatRecipientReason(input.recipientReason)}`,
      ].join("\n");
    case "new_comment":
      return formatCommentMessage(
        `**[${id}](${commentUrl}) — ${commentActor} commented**`,
        [`${title} · ${machine}`, formatRecipientReason(input.recipientReason)],
        input.commentContent,
        input.attachmentCount
      );
    case "mentioned":
      return formatCommentMessage(
        `**[${id}](${commentUrl}) — ${commentActor} mentioned you**`,
        [`${title} · ${machine}`],
        input.commentContent,
        input.attachmentCount
      );
  }
}

function formatCommentMessage(
  heading: string,
  contextLines: readonly string[],
  content: string | undefined,
  attachmentCount: number
): string {
  if (content?.trim()) {
    const attachmentLine =
      attachmentCount > 0
        ? `\n\nAdded ${attachmentCount} ${attachmentCount === 1 ? "photo" : "photos"}.`
        : "";
    const minimumQuotedContentLength = "> …".length;
    const boundedContextLines = boundCommentContext(
      heading,
      contextLines,
      "\n\n".length + attachmentLine.length + minimumQuotedContentLength
    );
    const fixedLines = [heading, ...boundedContextLines];
    const fixed = `${fixedLines.join("\n")}\n\n`;
    const quoteBudget =
      DISCORD_MAX_MESSAGE_LENGTH - fixed.length - attachmentLine.length;
    const sanitized = sanitizeDiscordText(content.trim());
    const quote = (value: string): string => value.replace(/^/gm, "> ");
    if (quote(sanitized).length <= quoteBudget) {
      return `${fixed}${quote(sanitized)}${attachmentLine}`;
    }

    let low = 0;
    let high = sanitized.length;
    while (low < high) {
      const midpoint = Math.ceil((low + high) / 2);
      if (quote(sanitized.slice(0, midpoint)).length + 1 <= quoteBudget) {
        low = midpoint;
      } else {
        high = midpoint - 1;
      }
    }
    return `${fixed}${quote(sanitized.slice(0, low))}…${attachmentLine}`;
  }
  if (attachmentCount > 0) {
    const attachmentNotice = `Added ${attachmentCount} ${attachmentCount === 1 ? "photo" : "photos"} — open the issue to view.`;
    const boundedContextLines = boundCommentContext(
      heading,
      contextLines,
      "\n".length + attachmentNotice.length
    );
    return [heading, ...boundedContextLines, attachmentNotice].join("\n");
  }
  return [heading, ...contextLines].join("\n");
}

function boundCommentContext(
  heading: string,
  contextLines: readonly string[],
  reservedAfterContext: number
): readonly string[] {
  const primaryContext = contextLines[0] ?? "";
  const trailingContext = contextLines.slice(1);
  const fixedContentLength =
    heading.length +
    trailingContext.reduce((total, line) => total + line.length, 0);
  const primaryContextBudget = Math.max(
    0,
    DISCORD_MAX_MESSAGE_LENGTH -
      fixedContentLength -
      contextLines.length -
      reservedAfterContext
  );
  return [
    clampDiscordText(primaryContext, primaryContextBudget),
    ...trailingContext,
  ];
}

function clampDiscordText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  if (maxLength <= 0) return "";
  if (maxLength === 1) return "…";
  return `${value.slice(0, maxLength - 1)}…`;
}

function formatRecipientReason(reason: RecipientReason): string {
  switch (reason) {
    case "machine_owner":
      return "You own this machine";
    case "machine_watcher":
      return "You’re watching this machine";
    case "issue_watcher":
      return "You’re watching this issue";
    case "global_watcher":
      return "You follow all machines";
    case "actor":
      return "You made this change";
    case "assignee":
      return "Assigned to you";
    case "mentioned":
      return "Mentioned you";
    case "ownership_added":
    case "ownership_removed":
      return "Ownership changed";
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
 *
 * **`[` and `]` are escaped because of MASKED LINKS.** Discord renders
 * `[label](url)` in bot content as a hyperlink showing only the label, and the
 * region alert (PP-o355.18) puts a stranger-supplied venue name in that label
 * position. Unescaped, a venue called `Foo](https://evil.example)` closes our
 * mask early and publishes an arbitrary link under the bot's name — the reader
 * sees a plausible venue and a URL they never get to inspect.
 *
 * The brackets are the whole fix: a label cannot be closed without an unescaped
 * `]`, so the parentheses that would follow are inert on their own. `(` and `)`
 * are deliberately NOT escaped — pinball titles are full of them
 * ("Godzilla (Premium)", "Medieval Madness (Remake)"), and escaping a character
 * that cannot be exploited buys nothing while making every such title noisier.
 *
 * It is deliberately fixed HERE rather than at the one call site: this is the
 * shared sanitizer precisely so a hardening fix lands on every Discord surface at
 * once, and any surface that later gains a link inherits the protection instead
 * of rediscovering the hole. Discord renders `\[` as a plain `[`, so escaping
 * costs nothing on the surfaces that have no links today.
 */
const ZERO_WIDTH_SPACE = "\u200B";

/**
 * Exported because every Discord surface interpolating text we did not author
 * needs it, not just notification DMs \u2014 the PinballMap region alert renders venue
 * and machine names typed by strangers on pinballmap.com (PP-o355.18). One shared
 * implementation, so a hardening fix lands everywhere at once.
 */
export function sanitizeDiscordText(value: string): string {
  return value
    .replace(/@/g, `@${ZERO_WIDTH_SPACE}`)
    .replace(/</g, `<${ZERO_WIDTH_SPACE}`)
    .replace(/[\\*_~`|>[\]]/g, (m) => `\\${m}`);
}

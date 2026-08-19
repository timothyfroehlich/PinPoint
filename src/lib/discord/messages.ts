import type { NotificationType } from "~/lib/notifications/dispatch";
import { buildResourceUrl } from "~/lib/notifications/resource-url";

const DISCORD_MAX_MESSAGE_LENGTH = 2000;

export interface DiscordMessageInput {
  type: NotificationType;
  siteUrl: string;
  resourceType: "issue" | "machine";
  issueTitle: string | undefined;
  formattedIssueId: string | undefined;
  machineName: string | undefined;
  machineInitials: string | undefined;
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
  const link = buildResourceUrl(input);
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

function buildBody(input: DiscordMessageInput): string {
  const id = sanitizeDiscordText(input.formattedIssueId ?? "");
  const title = sanitizeDiscordText(input.issueTitle ?? "");
  const machine = sanitizeDiscordText(input.machineName ?? "a machine");
  const status = sanitizeDiscordText(input.newStatus ?? "updated");

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

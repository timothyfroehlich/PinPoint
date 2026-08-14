/**
 * Canonical in-app URLs for notification resources.
 *
 * Every notification channel that renders a link (email, Discord) must build it
 * here. PinPoint has no id-addressed routes: an issue lives at
 * `/m/<INITIALS>/i/<issueNumber>` and a machine at `/m/<INITIALS>`. Channels
 * that interpolated `resourceId` directly produced permanent 404s (PP-gzq2) —
 * and Discord DMs can't be edited after the fact, so a bad link there is
 * forever.
 *
 * Pure by design: `siteUrl` is passed in rather than read from `~/lib/url` so
 * the Discord message builder stays a pure formatter and the unit tests don't
 * need env stubbing.
 */

/** Matches the `initials_check` DB constraint: 2-6 uppercase alphanumerics. */
const INITIALS_PATTERN = /^[A-Z0-9]{2,6}$/;

export interface ResourceUrlInput {
  siteUrl: string;
  resourceType: "issue" | "machine";
  /** `[INITIALS]-[NUMBER]`, e.g. `RUSH-01`. */
  formattedIssueId?: string | undefined;
  machineInitials?: string | undefined;
}

/**
 * Absolute URL for the resource a notification is about.
 *
 * Falls back to the relevant list page (`/issues`, `/m`) when the identifying
 * parts are missing or malformed — a list page is a worse landing spot than the
 * resource, but it is a page that exists.
 */
export function buildResourceUrl(input: ResourceUrlInput): string {
  const { siteUrl, resourceType, formattedIssueId, machineInitials } = input;

  if (resourceType === "machine") {
    return machineInitials && INITIALS_PATTERN.test(machineInitials)
      ? `${siteUrl}/m/${encodeURIComponent(machineInitials)}`
      : `${siteUrl}/m`;
  }

  const parsed = parseFormattedIssueId(formattedIssueId);
  if (!parsed) return `${siteUrl}/issues`;
  // URL-encode for defense in depth, even though the pattern above already
  // restricts initials to characters that need no escaping.
  return `${siteUrl}/m/${encodeURIComponent(parsed.initials)}/i/${parsed.issueNumber}`;
}

/**
 * Split `RUSH-01` into `{ initials: "RUSH", issueNumber: 1 }`.
 *
 * Returns null when the input is absent or doesn't match the format. Initials
 * themselves never contain a hyphen (the DB constraint allows only `[A-Z0-9]`),
 * but splitting from the right is still the safer parse.
 */
function parseFormattedIssueId(
  formattedIssueId: string | undefined
): { initials: string; issueNumber: number } | null {
  if (!formattedIssueId) return null;

  const parts = formattedIssueId.split("-");
  if (parts.length < 2) return null;

  const numberPart = parts.pop();
  const initials = parts.join("-");
  if (!numberPart || !/^\d+$/.test(numberPart)) return null;
  if (!INITIALS_PATTERN.test(initials)) return null;

  return { initials, issueNumber: parseInt(numberPart, 10) };
}

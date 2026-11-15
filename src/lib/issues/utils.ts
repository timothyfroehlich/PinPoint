export function formatIssueId(initials: string, number: number): string {
  return `${initials.toUpperCase()}-${number.toString().padStart(2, "0")}`;
}

/** Upper bound of `issues.issue_number`, a Postgres 32-bit `integer` column. */
const MAX_ISSUE_NUMBER = 2_147_483_647;

/**
 * Parse an issue-number route segment (the `3` in `/m/GDZ/i/3`) into a positive
 * integer, or `null` when the segment is not a clean one.
 *
 * `parseInt` must not be used for this: it accepts trailing garbage
 * (`parseInt("1abc", 10) === 1`) and decimals (`parseInt("1.5", 10) === 1`), so
 * `/m/GDZ/i/1abc` and `/m/GDZ/i/1.5` would silently render issue 1 instead of a
 * 404. Requiring a digits-only segment that resolves to a positive integer within
 * the column's range closes that gap (and rejects `0`, negatives, whitespace, and
 * values Postgres would reject as out of range for `integer`).
 */
export function parseIssueNumber(segment: string): number | null {
  if (!/^\d+$/.test(segment)) {
    return null;
  }
  const value = Number(segment);
  if (value < 1 || value > MAX_ISSUE_NUMBER) {
    return null;
  }
  return value;
}

export interface IssueReporterInfo {
  reportedByUser?: { id?: string; name: string } | null;
  invitedReporter?: { id?: string; name: string } | null;
  reporterName?: string | null;
}

export function resolveIssueReporter(issue: IssueReporterInfo): {
  id?: string | null;
  name: string;
  initial: string;
} {
  const name =
    issue.reportedByUser?.name ??
    issue.invitedReporter?.name ??
    issue.reporterName ??
    "Anonymous";

  const id = issue.reportedByUser?.id ?? issue.invitedReporter?.id ?? null;

  return {
    id,
    name,
    initial: (name[0] ?? "A").toUpperCase(),
  };
}

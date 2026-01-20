export function formatIssueId(initials: string, number: number): string {
  return `${initials.toUpperCase()}-${number.toString().padStart(2, "0")}`;
}

export interface IssueReporterInfo {
  reportedByUser?: { id?: string; name: string; email?: string | null } | null;
  invitedReporter?: { id?: string; name: string; email?: string | null } | null;
  reporterName?: string | null;
  reporterEmail?: string | null;
}

export function resolveIssueReporter(issue: IssueReporterInfo): {
  id?: string | null;
  name: string;
  email?: string | null;
  initial: string;
} {
  const name =
    issue.reportedByUser?.name ??
    issue.invitedReporter?.name ??
    issue.reporterName ??
    "Anonymous";

  const email =
    issue.reportedByUser?.email ??
    issue.invitedReporter?.email ??
    issue.reporterEmail ??
    null;

  const id = issue.reportedByUser?.id ?? issue.invitedReporter?.id ?? null;

  return {
    id,
    name,
    email,
    initial: (name[0] ?? "A").toUpperCase(),
  };
}

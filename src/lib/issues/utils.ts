export function formatIssueId(initials: string, number: number): string {
  return `${initials.toUpperCase()}-${number.toString().padStart(2, "0")}`;
}

export interface IssueReporterInfo {
  reportedByUser?: { name: string; email?: string | null } | null;
  invitedReporter?: { name: string; email?: string | null } | null;
  reporterName?: string | null;
  reporterEmail?: string | null;
}

export function getIssueReporter(issue: IssueReporterInfo): {
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

  return {
    name,
    email,
    initial: (name[0] ?? "A").toUpperCase(),
  };
}

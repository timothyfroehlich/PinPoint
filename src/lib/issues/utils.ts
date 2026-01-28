export function formatIssueId(initials: string, number: number): string {
  return `${initials.toUpperCase()}-${number.toString().padStart(2, "0")}`;
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

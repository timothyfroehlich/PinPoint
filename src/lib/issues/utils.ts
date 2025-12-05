export function formatIssueId(initials: string, number: number): string {
  return `${initials.toUpperCase()}-${number.toString().padStart(2, "0")}`;
}

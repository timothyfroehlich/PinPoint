/**
 * The Issues list for one machine (issues-list §7.4). Machine Presence is
 * every presence state, so a machine that is off the floor, on loan, pending
 * arrival, or removed still shows its issues.
 */
export function machineIssuesHref(initials: string): string {
  const params = new URLSearchParams({ machine: initials, presence: "all" });
  return `/issues?${params.toString()}`;
}

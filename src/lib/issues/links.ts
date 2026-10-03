/**
 * The Issues list for one machine (issues-list §7.4). It includes every
 * machine presence state, so a machine that is off the floor, on loan, pending
 * arrival, or removed still shows its issues.
 */
export function machineIssuesHref(initials: string): string {
  const params = new URLSearchParams({
    machine: initials,
    include_inactive_machines: "true",
  });
  return `/issues?${params.toString()}`;
}

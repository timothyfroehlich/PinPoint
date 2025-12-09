export interface BuildMachineReportUrlOptions {
  siteUrl: string;
  machineInitials: string;
  source?: string;
}

/**
 * Builds an absolute URL to the public report form for a specific machine.
 * Adds machine initials as a query param so the form can preselect it.
 */
export function buildMachineReportUrl({
  siteUrl,
  machineInitials,
  source,
}: BuildMachineReportUrlOptions): string {
  const url = new URL("/report", siteUrl);
  url.searchParams.set("machine", machineInitials);

  if (source) {
    url.searchParams.set("source", source);
  }

  return url.toString();
}

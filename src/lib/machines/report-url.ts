export interface BuildMachineReportUrlOptions {
  siteUrl: string;
  machineId: string;
  source?: string;
}

/**
 * Builds an absolute URL to the public report form for a specific machine.
 * Adds machineId as a query param so the form can preselect it.
 */
export function buildMachineReportUrl({
  siteUrl,
  machineId,
  source,
}: BuildMachineReportUrlOptions): string {
  const url = new URL("/report", siteUrl);
  url.searchParams.set("machineId", machineId);

  if (source) {
    url.searchParams.set("source", source);
  }

  return url.toString();
}

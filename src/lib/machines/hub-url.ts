/** Absolute target for the machine QR code. */
export function buildMachineHubUrl(
  siteUrl: string,
  machineInitials: string
): string {
  const url = new URL(`/m/${encodeURIComponent(machineInitials)}/hub`, siteUrl);
  url.searchParams.set("source", "apron");
  return url.toString();
}

export function constructReportUrl(machine: {
  id: string;
  organization: { subdomain: string | null };
}): string {
  const domain = machine.organization.subdomain
    ? `${machine.organization.subdomain}.pinpoint.app`
    : "app.pinpoint.app";

  return `https://${domain}/machines/${machine.id}/report-issue`;
}

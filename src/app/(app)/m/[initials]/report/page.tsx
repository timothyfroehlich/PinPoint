import { redirect } from "next/navigation";

/**
 * Redirects legacy report routes to the new unified report page.
 * Example: /m/AFM/report -> /report?machine=AFM
 */
export default async function LegacyReportRedirect({
  params,
}: {
  params: Promise<{ initials: string }>;
}): Promise<never> {
  const { initials } = await params;
  redirect(`/report?machine=${initials}`);
}

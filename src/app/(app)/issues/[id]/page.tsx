import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getIssueLocation } from "./_data";

const uuidSchema = z.uuid();

/**
 * Legacy id-addressed issue link → canonical `/m/<INITIALS>/i/<number>`.
 *
 * Discord notifications shipped `/issues/<uuid>` links for every issue event
 * until PP-gzq2. That route never existed, so all of them 404'd — and a Discord
 * DM can't be edited after delivery, so the only way to make those links work is
 * to make the URL resolve. This stub does that and nothing else.
 *
 * No permission check here (CORE-ARCH-008 is about surfacing data): the page
 * renders nothing and leaks nothing — the redirect target runs the real
 * `checkPermission()` gate before showing the issue.
 */
export default async function LegacyIssueRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<never> {
  const { id } = await params;

  // `issues.id` is a uuid column, so a non-UUID segment makes Postgres raise
  // 22P02 rather than returning no rows — crawlers and truncated pastes would
  // hit the error boundary and report to Sentry instead of 404ing.
  if (!uuidSchema.safeParse(id).success) notFound();

  const issue = await getIssueLocation(id);

  if (!issue) notFound();

  redirect(
    `/m/${encodeURIComponent(issue.machineInitials)}/i/${issue.issueNumber}`
  );
}

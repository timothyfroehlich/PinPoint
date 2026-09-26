import type React from "react";
import { notFound } from "next/navigation";
import { MachineGroupIssuesTab } from "~/components/collections/MachineGroupIssuesTab";
import { getViewer } from "~/lib/collections/viewer";
import { getTagForLayout } from "~/app/(app)/c/tags/[type]/[slug]/_data";

interface PageProps {
  params: Promise<{ type: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TagIssuesPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { type, slug } = await params;
  const tag = await getTagForLayout(type, slug);
  if (!tag) notFound();

  const viewer = await getViewer();
  return (
    <MachineGroupIssuesTab
      machines={tag.machines}
      searchParams={await searchParams}
      viewer={{
        userId: viewer.userId,
        isAdmin: viewer.role === "admin", // permissions-audit-allow: SQL visibility flag, mirrors /issues page
      }}
    />
  );
}

import type React from "react";
import { notFound } from "next/navigation";
import { MachineGroupIssuesTab } from "~/components/collections/MachineGroupIssuesTab";
import { getViewer } from "~/lib/collections/viewer";
import { getManufacturerTagForLayout } from "~/app/(app)/c/tags/manufacturer/[slug]/_data";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ManufacturerTagIssuesPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { slug } = await params;
  const tag = await getManufacturerTagForLayout(slug);
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

import type React from "react";
import { notFound } from "next/navigation";
import { MachineGroupIssuesTab } from "~/components/collections/MachineGroupIssuesTab";
import { getViewer } from "~/lib/collections/viewer";
import { getCollectionForLayout } from "~/app/(app)/c/[id]/_data";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CollectionIssuesPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const data = await getCollectionForLayout(id);
  if (!data) notFound();

  // Request-deduped with the layout/resolver — one getUser() + role read.
  const viewer = await getViewer();
  return (
    <MachineGroupIssuesTab
      machines={data.collection.machines}
      searchParams={await searchParams}
      viewer={{
        userId: viewer.userId,
        isAdmin: viewer.role === "admin", // permissions-audit-allow: SQL visibility flag, mirrors /issues page
      }}
    />
  );
}

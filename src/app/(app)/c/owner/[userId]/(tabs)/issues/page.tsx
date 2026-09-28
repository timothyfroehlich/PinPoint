import type React from "react";
import { notFound } from "next/navigation";
import { MachineGroupIssuesTab } from "~/components/collections/MachineGroupIssuesTab";
import { getViewer } from "~/lib/collections/viewer";
import { getOwnerCollectionForLayout } from "~/app/(app)/c/owner/[userId]/_data";

interface PageProps {
  params: Promise<{ userId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CollectionIssuesPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { userId } = await params;
  const collection = await getOwnerCollectionForLayout(userId);
  if (!collection) notFound();

  const viewer = await getViewer();
  return (
    <MachineGroupIssuesTab
      machines={collection.machines}
      searchParams={await searchParams}
      viewer={{
        userId: viewer.userId,
        isAdmin: viewer.role === "admin", // permissions-audit-allow: SQL visibility flag, mirrors /issues page
      }}
    />
  );
}

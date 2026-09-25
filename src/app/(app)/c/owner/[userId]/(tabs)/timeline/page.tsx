import type React from "react";
import { notFound } from "next/navigation";
import { MachineGroupTimelineTab } from "~/components/collections/MachineGroupTimelineTab";
import { getOwnerCollectionForLayout } from "~/app/(app)/c/owner/[userId]/_data";

interface PageProps {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ tag?: string; page?: string; m?: string }>;
}

export default async function CollectionTimelinePage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { userId } = await params;
  const collection = await getOwnerCollectionForLayout(userId);
  if (!collection) notFound();
  return (
    <MachineGroupTimelineTab
      machines={collection.machines}
      basePath={`/c/owner/${collection.owner.id}/timeline`}
      searchParams={await searchParams}
    />
  );
}

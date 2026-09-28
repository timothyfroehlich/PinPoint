import type React from "react";
import { notFound } from "next/navigation";
import { MachineGroupTimelineTab } from "~/components/collections/MachineGroupTimelineTab";
import { getCollectionForLayout } from "~/app/(app)/c/[id]/_data";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CollectionTimelinePage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const data = await getCollectionForLayout(id);
  if (!data) notFound();
  return (
    <MachineGroupTimelineTab
      machines={data.collection.machines}
      basePath={`/c/${id}/timeline`}
      searchParams={await searchParams}
    />
  );
}

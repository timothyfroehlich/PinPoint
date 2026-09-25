import type React from "react";
import { notFound } from "next/navigation";
import { MachineGroupTimelineTab } from "~/components/collections/MachineGroupTimelineTab";
import { manufacturerTagHref } from "~/lib/machines/manufacturer";
import { getManufacturerTagForLayout } from "~/app/(app)/c/tags/manufacturer/[slug]/_data";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tag?: string; page?: string; m?: string }>;
}

export default async function ManufacturerTagTimelinePage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { slug } = await params;
  const tag = await getManufacturerTagForLayout(slug);
  if (!tag) notFound();
  return (
    <MachineGroupTimelineTab
      machines={tag.machines}
      basePath={`${manufacturerTagHref(tag.slug)}/timeline`}
      searchParams={await searchParams}
    />
  );
}

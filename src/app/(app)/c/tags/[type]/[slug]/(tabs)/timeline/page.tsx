import type React from "react";
import { notFound } from "next/navigation";
import { MachineGroupTimelineTab } from "~/components/collections/MachineGroupTimelineTab";
import { tagHref } from "~/lib/tags/types";
import { getTagForLayout } from "~/app/(app)/c/tags/[type]/[slug]/_data";

interface PageProps {
  params: Promise<{ type: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TagTimelinePage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { type, slug } = await params;
  const tag = await getTagForLayout(type, slug);
  if (!tag) notFound();
  return (
    <MachineGroupTimelineTab
      machines={tag.machines}
      basePath={`${tagHref(tag.type, tag.slug)}/timeline`}
      searchParams={await searchParams}
    />
  );
}

import type React from "react";
import { notFound, redirect } from "next/navigation";
import { MachineGroupTimelineTab } from "~/components/collections/MachineGroupTimelineTab";
import {
  canonicalTagPath,
  getTagForLayout,
} from "~/app/(app)/c/tags/[type]/[slug]/_data";

interface PageProps {
  params: Promise<{ type: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TagTimelinePage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const [{ type, slug }, rawSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const resolved = await getTagForLayout(type, slug);
  if (!resolved) notFound();
  const canonical = canonicalTagPath(
    resolved,
    type,
    "/timeline",
    rawSearchParams
  );
  if (canonical !== null) redirect(canonical);
  return (
    <MachineGroupTimelineTab
      machines={resolved.tag.machines}
      basePath={`${resolved.tag.href}/timeline`}
      searchParams={rawSearchParams}
    />
  );
}

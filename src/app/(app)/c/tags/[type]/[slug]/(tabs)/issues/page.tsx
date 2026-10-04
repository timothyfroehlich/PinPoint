import type React from "react";
import { notFound, redirect } from "next/navigation";
import { MachineGroupIssuesTab } from "~/components/collections/MachineGroupIssuesTab";
import { getViewer } from "~/lib/collections/viewer";
import {
  canonicalTagPath,
  getTagForLayout,
} from "~/app/(app)/c/tags/[type]/[slug]/_data";

interface PageProps {
  params: Promise<{ type: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TagIssuesPage({
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
    "/issues",
    rawSearchParams
  );
  if (canonical !== null) redirect(canonical);

  const viewer = await getViewer();
  return (
    <MachineGroupIssuesTab
      machines={resolved.tag.machines}
      searchParams={rawSearchParams}
      viewer={viewer}
      exportScope={{ kind: "tag", type, slug }}
    />
  );
}

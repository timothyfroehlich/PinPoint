import type React from "react";
import { notFound } from "next/navigation";
import { MachineView } from "~/components/machines/view";
import { loadMachineView } from "~/lib/machines/view/queries";
import { toMachineViewSearchParams } from "~/lib/machines/view/state";
import { loadMachineViewSavedViews } from "~/lib/machines/view/saved-views";
import { getTagForLayout } from "~/app/(app)/c/tags/[type]/[slug]/_data";

interface PageProps {
  params: Promise<{ type: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TagOverviewPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const [{ type, slug }, rawSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const tag = await getTagForLayout(type, slug);
  if (!tag) notFound();

  const viewSearchParams = toMachineViewSearchParams(rawSearchParams);
  const [{ savedViews }, result] = await Promise.all([
    loadMachineViewSavedViews("collection", viewSearchParams),
    loadMachineView({
      scope: { kind: "tag", tagType: tag.type, slug: tag.slug },
      preset: "collection",
      searchParams: viewSearchParams,
    }),
  ]);
  return (
    <MachineView result={result} preset="collection" savedViews={savedViews} />
  );
}

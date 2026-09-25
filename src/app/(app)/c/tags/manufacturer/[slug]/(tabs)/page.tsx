import type React from "react";
import { notFound } from "next/navigation";
import { MachineView } from "~/components/machines/view";
import { loadMachineView } from "~/lib/machines/view/queries";
import { toMachineViewSearchParams } from "~/lib/machines/view/state";
import { getManufacturerTagForLayout } from "../_data";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ManufacturerTagOverviewPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const tag = await getManufacturerTagForLayout(slug);
  if (!tag) notFound();

  const result = await loadMachineView({
    scope: { kind: "tag", tagType: "manufacturer", slug: tag.slug },
    preset: "collection",
    searchParams: toMachineViewSearchParams(rawSearchParams),
  });
  return <MachineView result={result} preset="collection" />;
}

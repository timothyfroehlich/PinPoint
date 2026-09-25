import type React from "react";
import { notFound } from "next/navigation";
import { AddMachinesInline } from "~/components/collections/AddMachinesInline";
import { MachineView } from "~/components/machines/view";
import { loadMachineView } from "~/lib/machines/view/queries";
import { toMachineViewSearchParams } from "~/lib/machines/view/state";
import { getCollectionForLayout, getPickerMachines } from "../_data";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CollectionOverviewPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const [{ id }, rawSearchParams] = await Promise.all([params, searchParams]);
  const data = await getCollectionForLayout(id);
  if (!data) notFound();

  if (data.collection.machines.length === 0) {
    if (data.viewerCanManage) {
      const allMachines = await getPickerMachines();
      return (
        <AddMachinesInline
          collectionId={data.collection.id}
          collectionName={data.collection.name}
          allMachines={allMachines}
        />
      );
    }
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No machines in this collection yet.
      </p>
    );
  }

  const result = await loadMachineView({
    scope: { kind: "collection", collectionId: data.collection.id },
    preset: "collection",
    searchParams: toMachineViewSearchParams(rawSearchParams),
  });
  return <MachineView result={result} preset="collection" />;
}

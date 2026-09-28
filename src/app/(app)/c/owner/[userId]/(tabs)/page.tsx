import type React from "react";
import { notFound, redirect } from "next/navigation";
import { MachineView } from "~/components/machines/view";
import { loadMachineView } from "~/lib/machines/view/queries";
import { toMachineViewSearchParams } from "~/lib/machines/view/state";
import { loadMachineViewSurfacePageState } from "~/app/(app)/m/saved-view-surface";
import { getOwnerCollectionForLayout } from "../_data";

interface PageProps {
  params: Promise<{ userId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CollectionOverviewPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const [{ userId }, rawSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const collection = await getOwnerCollectionForLayout(userId);
  if (!collection) notFound();

  if (collection.machines.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No machines in this collection yet.
      </p>
    );
  }

  const viewSearchParams = toMachineViewSearchParams(rawSearchParams);
  const { savedViews, redirectTo } = await loadMachineViewSurfacePageState(
    { kind: "owner", ownerId: collection.owner.id },
    viewSearchParams
  );
  if (redirectTo) redirect(redirectTo);
  const result = await loadMachineView({
    scope: { kind: "owner", ownerId: collection.owner.id },
    preset: "collection",
    searchParams: viewSearchParams,
  });
  return (
    <MachineView result={result} preset="collection" savedViews={savedViews} />
  );
}

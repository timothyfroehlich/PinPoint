import type React from "react";
import { notFound } from "next/navigation";
import { getLatestTimelineEventPerMachine } from "~/lib/collections/latest-activity";
import { deriveMachineStatus } from "~/lib/machines/status";
import { getCollectionForLayout, getPickerMachines } from "../_data";
import {
  CollectionOverviewTable,
  type CollectionOverviewRow,
} from "~/components/collections/CollectionOverviewTable";
import { AddMachinesInline } from "~/components/collections/AddMachinesInline";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CollectionOverviewPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const data = await getCollectionForLayout(id);
  if (!data) notFound();
  const { machines } = data.collection;

  // Editing (rename / machine set / delete) lives in the header's "Edit
  // collection" modal. Here, an empty collection the viewer owns gets an inline
  // machine picker so it's fillable the moment it's created.
  if (machines.length === 0) {
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

  const latest = await getLatestTimelineEventPerMachine(
    undefined,
    machines.map((m) => m.id)
  );

  const rows: CollectionOverviewRow[] = machines.map((m) => ({
    id: m.id,
    initials: m.initials,
    name: m.name,
    status: deriveMachineStatus(m.issues),
    openCount: m.issues.length,
    lastActivity: latest.get(m.id) ?? null,
    // `issues` is open-only (filtered in the resolver), so the minimum
    // createdAt is the longest-outstanding open issue.
    oldestOpenAt:
      m.issues.length > 0
        ? new Date(Math.min(...m.issues.map((i) => i.createdAt.getTime())))
        : null,
    presence: m.presenceStatus,
  }));

  return <CollectionOverviewTable rows={rows} />;
}

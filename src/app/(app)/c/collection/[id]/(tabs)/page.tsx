import type React from "react";
import { asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "~/server/db";
import { machines as machinesTable } from "~/server/db/schema";
import { getLatestTimelineEventPerMachine } from "~/lib/collections/latest-activity";
import { deriveMachineStatus } from "~/lib/machines/status";
import { getCollectionForLayout } from "../_data";
import {
  CollectionOverviewTable,
  type CollectionOverviewRow,
} from "~/components/collections/CollectionOverviewTable";
import { CollectionOwnerControls } from "~/components/collections/CollectionOwnerControls";
import { ManageCollectionMachines } from "~/components/collections/ManageCollectionMachines";

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

  // Owner-only management surface: rename/delete + a full-machine multi-select.
  // The all-machines fetch runs only on the owner's own view.
  let ownerControls: React.JSX.Element | null = null;
  if (data.viewerCanManage) {
    const allMachines = await db.query.machines.findMany({
      columns: { id: true, initials: true, name: true },
      orderBy: [asc(machinesTable.name)],
    });
    ownerControls = (
      <div className="space-y-3 rounded-md border border-outline-variant p-4">
        <CollectionOwnerControls
          collectionId={data.collection.id}
          currentName={data.collection.name}
        />
        <ManageCollectionMachines
          collectionId={data.collection.id}
          allMachines={allMachines}
          currentIds={machines.map((m) => m.id)}
        />
      </div>
    );
  }

  if (machines.length === 0) {
    return (
      <div className="space-y-4">
        {ownerControls}
        <p className="py-8 text-center text-sm text-muted-foreground">
          No machines in this collection yet.
        </p>
      </div>
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

  return (
    <div className="space-y-4">
      {ownerControls}
      <CollectionOverviewTable rows={rows} />
    </div>
  );
}

import type React from "react";
import { notFound } from "next/navigation";
import { getLatestTimelineEventPerMachine } from "~/lib/collections/latest-activity";
import { deriveMachineStatus } from "~/lib/machines/status";
import { getOwnerCollectionForLayout } from "../_data";
import {
  CollectionOverviewTable,
  type CollectionOverviewRow,
} from "~/components/collections/CollectionOverviewTable";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function CollectionOverviewPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { userId } = await params;
  const collection = await getOwnerCollectionForLayout(userId);
  if (!collection) notFound();

  if (collection.machines.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No machines in this collection yet.
      </p>
    );
  }

  const latest = await getLatestTimelineEventPerMachine(
    undefined,
    collection.machines.map((m) => m.id)
  );

  const rows: CollectionOverviewRow[] = collection.machines.map((m) => ({
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

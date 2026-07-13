import type React from "react";
import { notFound } from "next/navigation";
import { getLatestTimelineEventPerMachine } from "~/lib/collections/latest-activity";
import { deriveMachineStatus } from "~/lib/machines/status";
import { getCollectionForLayout } from "../_data";
import {
  CollectionOverviewTable,
  type CollectionOverviewRow,
} from "~/components/collections/CollectionOverviewTable";

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

  if (machines.length === 0) {
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

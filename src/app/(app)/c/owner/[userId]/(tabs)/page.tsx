import type React from "react";
import { notFound } from "next/navigation";
import { getLatestTimelineEventPerMachine } from "~/lib/collections/latest-activity";
import { deriveMachineStatus, worstOpenSeverity } from "~/lib/machines/status";
import { getOwnerCollectionForLayout } from "../_data";
// CollectionOverviewTable arrives in Task 6 (PP-slrd.1) — placeholder below.
// import type { CollectionOverviewRow } from "~/components/collections/CollectionOverviewTable";

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

  const rows = collection.machines.map((m) => ({
    id: m.id,
    initials: m.initials,
    name: m.name,
    status: deriveMachineStatus(m.issues),
    openCount: m.issues.length,
    worstSeverity: worstOpenSeverity(m.issues),
    lastActivity: latest.get(m.id) ?? null,
    presence: m.presenceStatus,
  }));

  return <pre>{JSON.stringify(rows.map((r) => r.initials))}</pre>;
}

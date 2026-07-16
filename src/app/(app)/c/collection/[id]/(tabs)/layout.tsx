import type React from "react";
import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "~/server/db";
import { machines as machinesTable } from "~/server/db/schema";
import { PageContainer } from "~/components/layout/PageContainer";
import { CollectionHeader } from "~/components/collections/CollectionHeader";
import { CollectionTabStrip } from "~/components/collections/CollectionTabStrip";
import { EditCollectionDialog } from "~/components/collections/EditCollectionDialog";
import { summarizeCollection } from "~/lib/collections/summary";
import { getCollectionForLayout } from "../_data";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getCollectionForLayout(id);
  return {
    title: data
      ? `${data.collection.name} | PinPoint`
      : "Collection | PinPoint",
  };
}

export default async function CollectionLayout({
  children,
  params,
}: LayoutProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const data = await getCollectionForLayout(id);
  if (!data) notFound();

  const summary = summarizeCollection(data.collection.machines);
  const worstStatus =
    summary.unplayable > 0
      ? "unplayable"
      : summary.needsService > 0
        ? "needs_service"
        : "operational";

  // Owner-only "Edit collection" lives in the header (rename + machine set +
  // delete). The all-machines fetch runs only on the owner's own view.
  let headerAction: React.ReactNode = null;
  if (data.viewerCanManage) {
    const allMachines = await db.query.machines.findMany({
      columns: { id: true, initials: true, name: true },
      orderBy: [asc(machinesTable.name)],
    });
    headerAction = (
      <EditCollectionDialog
        collectionId={data.collection.id}
        currentName={data.collection.name}
        allMachines={allMachines}
        currentIds={data.collection.machines.map((m) => m.id)}
      />
    );
  }

  return (
    <PageContainer size="standard">
      <div className="space-y-2">
        <CollectionHeader
          title={data.collection.name}
          summary={summary}
          action={headerAction}
        />
        <CollectionTabStrip
          basePath={`/c/collection/${data.collection.id}`}
          openIssueCount={summary.openIssues}
          status={worstStatus}
        />
        <div className="pt-2">{children}</div>
      </div>
    </PageContainer>
  );
}

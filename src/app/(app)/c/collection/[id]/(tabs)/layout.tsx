import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "~/components/layout/PageContainer";
import { CollectionHeader } from "~/components/collections/CollectionHeader";
import { CollectionTabStrip } from "~/components/collections/CollectionTabStrip";
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

  return (
    <PageContainer size="standard">
      <div className="space-y-2">
        <CollectionHeader title={data.collection.name} summary={summary} />
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

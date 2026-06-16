import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "~/components/layout/PageContainer";
import { CollectionHeader } from "~/components/collections/CollectionHeader";
import { CollectionTabStrip } from "~/components/collections/CollectionTabStrip";
import { summarizeCollection } from "~/lib/collections/summary";
import { getOwnerCollectionForLayout } from "../_data";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ userId: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const collection = await getOwnerCollectionForLayout(userId);
  return {
    title: collection
      ? `${collection.owner.name}'s Machines | PinPoint`
      : "Machines | PinPoint",
  };
}

export default async function CollectionLayout({
  children,
  params,
}: LayoutProps): Promise<React.JSX.Element> {
  const { userId } = await params;
  const collection = await getOwnerCollectionForLayout(userId);
  if (!collection) notFound();

  const summary = summarizeCollection(collection.machines);
  const worstStatus =
    summary.unplayable > 0
      ? "unplayable"
      : summary.needsService > 0
        ? "needs_service"
        : "operational";

  return (
    <PageContainer size="standard">
      <div className="space-y-2">
        <CollectionHeader
          title={`${collection.owner.name}'s Machines`}
          summary={summary}
        />
        <CollectionTabStrip
          basePath={`/c/owner/${collection.owner.id}`}
          openIssueCount={summary.openIssues}
          status={worstStatus}
        />
        <div className="pt-2">{children}</div>
      </div>
    </PageContainer>
  );
}

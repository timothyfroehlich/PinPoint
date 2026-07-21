import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "~/components/layout/PageContainer";
import { CollectionHeader } from "~/components/collections/CollectionHeader";
import { CollectionTabStrip } from "~/components/collections/CollectionTabStrip";
import { EditCollectionDialog } from "~/components/collections/EditCollectionDialog";
import { CollectionShareDialog } from "~/components/collections/CollectionShareDialog";
import { summarizeCollection } from "~/lib/collections/summary";
import {
  getEditorCollaborators,
  getGrantableMembers,
} from "~/lib/collections/collaborators";
import { db } from "~/server/db";
import { getCollectionForLayout, getPickerMachines } from "../_data";

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
    // A token-shared view keeps the capability out of the Referer header when
    // the visitor navigates away, so the link can't leak to third parties.
    ...(data?.viaViewToken ? { referrer: "no-referrer" } : {}),
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

  // "Edit collection" is shown to the owner AND editor collaborators; "Share"
  // and the owner-only Delete stay on the manage gate. The all-machines fetch
  // and token value are surfaced only to editors/managers, never to a plain
  // view-token or admin visitor.
  let headerAction: React.ReactNode = null;
  if (data.viewerCanEdit) {
    const allMachines = await getPickerMachines();
    let sharePanel: React.ReactNode = null;
    if (data.viewerCanManage) {
      const [editors, grantableMembers] = await Promise.all([
        getEditorCollaborators(db, data.collection.id),
        getGrantableMembers(db, data.collection.owner.id),
      ]);
      sharePanel = (
        <CollectionShareDialog
          collectionId={data.collection.id}
          viewToken={data.collection.viewToken}
          ownerName={data.collection.owner.name}
          editors={editors}
          grantableMembers={grantableMembers}
        />
      );
    }
    headerAction = (
      <div className="flex items-center gap-2">
        {sharePanel}
        <EditCollectionDialog
          collectionId={data.collection.id}
          currentName={data.collection.name}
          allMachines={allMachines}
          currentIds={data.collection.machines.map((m) => m.id)}
          canDelete={data.viewerCanManage}
        />
      </div>
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
          basePath={`/c/${data.handle}`}
          openIssueCount={summary.openIssues}
          status={worstStatus}
        />
        <div className="pt-2">{children}</div>
      </div>
    </PageContainer>
  );
}

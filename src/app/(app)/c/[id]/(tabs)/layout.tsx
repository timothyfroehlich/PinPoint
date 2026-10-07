import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MachineGroupShell } from "~/components/collections/MachineGroupShell";
import { EditCollectionDialog } from "~/components/collections/EditCollectionDialog";
import { CollectionShareDialog } from "~/components/collections/CollectionShareDialog";
import { PrintSettingsSheetsLink } from "~/components/machines/settings/PrintSettingsSheetsLink";
import { ClampedDescription } from "~/components/collections/ClampedDescription";
import { RichTextDisplay } from "~/components/editor/RichTextDisplay";
import { docIsEmpty, docToPlainText } from "~/lib/tiptap/types";
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

  // "Edit collection" is shown to the owner AND editor collaborators; "Share"
  // and the owner-only Delete stay on the manage gate. The all-machines fetch
  // and token value are surfaced only to editors/managers, never to a plain
  // view-token or admin visitor.
  let editActions: React.ReactNode = null;
  if (data.viewerCanEdit) {
    const allMachines = await getPickerMachines(data.collection.id);
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
    editActions = (
      <>
        {sharePanel}
        <EditCollectionDialog
          collectionId={data.collection.id}
          currentName={data.collection.name}
          currentDescription={data.collection.description}
          allMachines={allMachines}
          currentIds={data.collection.machines.map((m) => m.id)}
          canDelete={data.viewerCanManage}
        />
      </>
    );
  }
  // Everyone can print settings sheets (settings-sheets §2.1, §2.6).
  const headerAction = (
    <div className="flex items-center gap-2">
      <PrintSettingsSheetsLink machines={data.collection.machines} />
      {editActions}
    </div>
  );

  // Saves store a blank description as null; the text check also covers an
  // empty doc written some other way, so the header never paints an empty block.
  const { description } = data.collection;
  const descriptionBlock =
    !docIsEmpty(description) && docToPlainText(description).trim() ? (
      <ClampedDescription>
        <RichTextDisplay content={description} />
      </ClampedDescription>
    ) : null;

  return (
    <MachineGroupShell
      title={data.collection.name}
      machines={data.collection.machines}
      basePath={`/c/${data.handle}`}
      action={headerAction}
      description={descriptionBlock}
    >
      {children}
    </MachineGroupShell>
  );
}

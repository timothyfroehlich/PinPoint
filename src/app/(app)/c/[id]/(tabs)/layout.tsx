import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MachineGroupShell } from "~/components/collections/MachineGroupShell";
import { CollectionPageActions } from "~/components/collections/CollectionPageActions";
import { PageExportProvider } from "~/components/list-view";
import { ClampedDescription } from "~/components/collections/ClampedDescription";
import { RichTextDisplay } from "~/components/editor/RichTextDisplay";
import { docIsEmpty, docToPlainText } from "~/lib/tiptap/types";
import { groupSettingsSheetsHref } from "~/lib/collections/settings-sheets-href";
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
  type Actions = React.ComponentProps<typeof CollectionPageActions>;
  let edit: Actions["edit"] = null;
  let share: Actions["share"] = null;
  if (data.viewerCanEdit) {
    const allMachines = await getPickerMachines(data.collection.id);
    if (data.viewerCanManage) {
      const [editors, grantableMembers] = await Promise.all([
        getEditorCollaborators(db, data.collection.id),
        getGrantableMembers(db, data.collection.owner.id),
      ]);
      share = {
        viewToken: data.collection.viewToken,
        ownerName: data.collection.owner.name,
        editors,
        grantableMembers,
      };
    }
    edit = {
      currentName: data.collection.name,
      currentDescription: data.collection.description,
      allMachines,
      currentIds: data.collection.machines.map((m) => m.id),
      canDelete: data.viewerCanManage,
    };
  }
  // Everyone can print settings sheets (settings-sheets §2.1, §2.6).
  const headerAction = (
    <CollectionPageActions
      collectionId={data.collection.id}
      settingsSheetsHref={groupSettingsSheetsHref(data.collection.machines)}
      share={share}
      edit={edit}
    />
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

  // The tab's list offers its Export to the header's ⋯ (collections-and-tags
  // 4.17).
  return (
    <PageExportProvider>
      <MachineGroupShell
        title={data.collection.name}
        machines={data.collection.machines}
        basePath={`/c/${data.handle}`}
        action={headerAction}
        description={descriptionBlock}
      >
        {children}
      </MachineGroupShell>
    </PageExportProvider>
  );
}

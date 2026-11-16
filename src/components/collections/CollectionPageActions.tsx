"use client";

import type React from "react";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { CollectionShareDialog } from "~/components/collections/CollectionShareDialog";
import { EditCollectionDialog } from "~/components/collections/EditCollectionDialog";
import {
  GROUP_FOLD_STEPS,
  groupPrintAction,
} from "~/components/collections/group-page-actions";
import {
  PageActions,
  usePageExportEntry,
  useReturnFocus,
  type PageAction,
  type PageMenuEntry,
} from "~/components/list-view";
import type { CollaboratorUser } from "~/lib/collections/collaborators";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

interface CollectionPageActionsProps {
  collectionId: string;
  /** Print settings sheets with the group's machines On the Floor added. */
  settingsSheetsHref: string;
  /** The owner's sharing controls (3.3–3.7); null for everyone else. */
  share: {
    viewToken: string | null;
    ownerName: string;
    editors: CollaboratorUser[];
    grantableMembers: CollaboratorUser[];
  } | null;
  /** Edit collection, for the owner and Editors (3.8); null otherwise. */
  edit: {
    currentName: string;
    currentDescription: ProseMirrorDoc | null;
    allMachines: { id: string; initials: string; name: string }[];
    currentIds: string[];
    /** Only the owner may delete the Collection. */
    canDelete: boolean;
  } | null;
}

/**
 * A Collection page's actions (collections-and-tags 4.14–4.18): Share for
 * the owner, Print, then ⋯ holding Edit collection for the owner and
 * Editors and the current tab's Export. Share and Print fold together.
 */
export function CollectionPageActions({
  collectionId,
  settingsSheetsHref,
  share,
  edit,
}: CollectionPageActionsProps): React.JSX.Element {
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const exportEntry = usePageExportEntry();
  const returnFocus = useReturnFocus();

  const actions: PageAction[] = [];
  if (share) {
    actions.push({
      key: "share",
      label: "Share",
      icon: Share2,
      onSelect: returnFocus.opens(() => setShareOpen(true)),
      testId: "collection-share-trigger",
    });
  }
  actions.push(groupPrintAction(settingsSheetsHref));

  const editing: PageMenuEntry[] = edit
    ? [
        {
          key: "edit-collection",
          label: "Edit collection",
          onSelect: returnFocus.opens(() => setEditOpen(true)),
          testId: "collection-edit-trigger",
        },
      ]
    : [];

  return (
    <>
      <PageActions
        actions={actions}
        menu={[editing, exportEntry ? [exportEntry] : []]}
        foldSteps={GROUP_FOLD_STEPS}
      />
      {share ? (
        <CollectionShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          onCloseAutoFocus={returnFocus.onCloseAutoFocus}
          collectionId={collectionId}
          viewToken={share.viewToken}
          ownerName={share.ownerName}
          editors={share.editors}
          grantableMembers={share.grantableMembers}
        />
      ) : null}
      {edit ? (
        <EditCollectionDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          onCloseAutoFocus={returnFocus.onCloseAutoFocus}
          collectionId={collectionId}
          currentName={edit.currentName}
          currentDescription={edit.currentDescription}
          allMachines={edit.allMachines}
          currentIds={edit.currentIds}
          canDelete={edit.canDelete}
        />
      ) : null}
    </>
  );
}

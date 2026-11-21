"use client";

import type React from "react";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { CollectionDeleteDialog } from "~/components/collections/CollectionDeleteDialog";
import { CollectionShareDialog } from "~/components/collections/CollectionShareDialog";
import { EditCollectionDialog } from "~/components/collections/EditCollectionDialog";
import {
  GROUP_FOLD_STEPS,
  groupPrintEntry,
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

type CollectionDialog = "share" | "edit" | "delete";

/**
 * A Collection page's actions (collections-and-tags 4.14–4.18): Share for
 * the owner, then ⋯ holding Edit collection for the owner and Editors, the
 * current tab's Export, Print settings sheets for everyone, and Delete
 * collection for the owner. Share folds into ⋯.
 */
export function CollectionPageActions({
  collectionId,
  settingsSheetsHref,
  share,
  edit,
}: CollectionPageActionsProps): React.JSX.Element {
  const [dialog, setDialog] = useState<CollectionDialog | null>(null);
  const exportEntry = usePageExportEntry();
  const returnFocus = useReturnFocus();
  const dialogProps = (
    name: CollectionDialog
  ): {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCloseAutoFocus: (event: Event) => void;
  } => ({
    open: dialog === name,
    onOpenChange: (open) => setDialog(open ? name : null),
    onCloseAutoFocus: returnFocus.onCloseAutoFocus,
  });

  const actions: PageAction[] = [];
  if (share) {
    actions.push({
      key: "share",
      label: "Share",
      icon: Share2,
      onSelect: returnFocus.opens(() => setDialog("share")),
      testId: "collection-share-trigger",
    });
  }

  const editing: PageMenuEntry[] = edit
    ? [
        {
          key: "edit-collection",
          label: "Edit collection…",
          onSelect: returnFocus.opens(() => setDialog("edit")),
          testId: "collection-edit-trigger",
        },
      ]
    : [];
  const output: PageMenuEntry[] = [
    ...(exportEntry ? [exportEntry] : []),
    groupPrintEntry(settingsSheetsHref),
  ];
  const deleting: PageMenuEntry[] = edit?.canDelete
    ? [
        {
          key: "delete-collection",
          label: "Delete collection",
          destructive: true,
          onSelect: returnFocus.opens(() => setDialog("delete")),
          testId: "collection-delete-trigger",
        },
      ]
    : [];

  return (
    <>
      <PageActions
        actions={actions}
        menu={[editing, output, deleting]}
        foldSteps={GROUP_FOLD_STEPS}
      />
      {share ? (
        <CollectionShareDialog
          {...dialogProps("share")}
          collectionId={collectionId}
          viewToken={share.viewToken}
          ownerName={share.ownerName}
          editors={share.editors}
          grantableMembers={share.grantableMembers}
        />
      ) : null}
      {edit ? (
        <EditCollectionDialog
          {...dialogProps("edit")}
          collectionId={collectionId}
          currentName={edit.currentName}
          currentDescription={edit.currentDescription}
          allMachines={edit.allMachines}
          currentIds={edit.currentIds}
        />
      ) : null}
      {edit?.canDelete ? (
        <CollectionDeleteDialog
          {...dialogProps("delete")}
          collectionId={collectionId}
        />
      ) : null}
    </>
  );
}

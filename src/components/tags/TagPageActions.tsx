"use client";

import type React from "react";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  GROUP_FOLD_STEPS,
  groupPrintEntry,
} from "~/components/collections/group-page-actions";
import {
  PageActions,
  usePageExportEntry,
  useReturnFocus,
  type PageActionSelect,
  type PageMenuEntry,
} from "~/components/list-view";
import {
  EditTagMachinesDialog,
  type TagMachinesEditor,
} from "~/components/tags/EditTagMachinesDialog";
import {
  TagDeleteDialog,
  TagRenameDialog,
} from "~/components/tags/TagManageDialogs";
import { MergeTagDialog } from "~/components/tags/MergeTagDialog";
import { MoveTagDialog } from "~/components/tags/MoveTagDialog";
import { deleteTagAction, renameTagAction } from "~/app/(app)/c/tags/actions";
import type { TagMerge, TagMove } from "~/app/(app)/c/tags/[type]/[slug]/_data";

interface TagPageActionsProps {
  /** The tag page's path, which Share copies as a full address (4.15). */
  tagHref: string;
  /** Print settings sheets with the tag's machines On the Floor added. */
  settingsSheetsHref: string;
  /**
   * A hand-applied tag's editing, for technicians and admins (4.17); null
   * for an automatic tag and for everyone else.
   */
  editing: {
    editor: TagMachinesEditor;
    /** The tag type's page, or the tag browse for a tag with no tag type. */
    parentHref: string;
    /** What the Move dialog offers and what blocks each choice. */
    move: TagMove;
    /** What the Merge dialog offers and what blocks each choice. */
    merge: TagMerge;
  } | null;
}

type TagDialog = "machines" | "rename" | "move" | "merge" | "delete";

/**
 * A tag page's actions (collections-and-tags 4.14–4.18): Share, which
 * copies the page's address for everyone, then ⋯ holding a hand-applied
 * tag's editing (Edit machines, Rename, Move to another tag type, Merge
 * into another tag), the current tab's Export, Print settings sheets for
 * everyone, and the tag's Delete. Share folds into ⋯.
 */
export function TagPageActions({
  tagHref,
  settingsSheetsHref,
  editing,
}: TagPageActionsProps): React.JSX.Element {
  const [dialog, setDialog] = useState<TagDialog | null>(null);
  const exportEntry = usePageExportEntry();
  const returnFocus = useReturnFocus();
  const openDialog = (name: TagDialog): PageActionSelect =>
    returnFocus.opens(() => setDialog(name));
  const dialogProps = (
    name: TagDialog
  ): {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCloseAutoFocus: (event: Event) => void;
  } => ({
    open: dialog === name,
    onOpenChange: (open) => setDialog(open ? name : null),
    onCloseAutoFocus: returnFocus.onCloseAutoFocus,
  });

  async function copyAddress(): Promise<void> {
    try {
      await navigator.clipboard.writeText(
        new URL(tagHref, window.location.origin).toString()
      );
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link.");
    }
  }

  const editingEntries: PageMenuEntry[] = editing
    ? [
        {
          key: "edit-machines",
          label: "Edit machines…",
          onSelect: openDialog("machines"),
        },
        {
          key: "rename",
          label: "Rename…",
          onSelect: openDialog("rename"),
        },
        {
          key: "move",
          label: "Move to another tag type…",
          onSelect: openDialog("move"),
        },
        {
          key: "merge",
          label: "Merge into another tag…",
          onSelect: openDialog("merge"),
        },
      ]
    : [];
  const deleteEntries: PageMenuEntry[] = editing
    ? [
        {
          key: "delete",
          label: "Delete tag",
          destructive: true,
          onSelect: openDialog("delete"),
        },
      ]
    : [];

  const machineCount = editing?.editor.currentIds.length ?? 0;
  const machinesPhrase =
    machineCount === 0
      ? ""
      : ` and removes it from ${String(machineCount)} ${machineCount === 1 ? "machine" : "machines"}`;

  return (
    <>
      <PageActions
        actions={[
          {
            key: "share",
            label: "Share",
            icon: Share2,
            onSelect: () => {
              void copyAddress();
            },
            testId: "tag-share-button",
          },
        ]}
        menu={[
          editingEntries,
          [
            ...(exportEntry ? [exportEntry] : []),
            groupPrintEntry(settingsSheetsHref),
          ],
          deleteEntries,
        ]}
        foldSteps={GROUP_FOLD_STEPS}
      />
      {editing ? (
        <>
          <EditTagMachinesDialog
            {...editing.editor}
            {...dialogProps("machines")}
          />
          <TagRenameDialog
            {...dialogProps("rename")}
            title="Rename tag"
            currentName={editing.editor.tagName}
            onRename={(next) =>
              renameTagAction({ tagId: editing.editor.tagId, name: next })
            }
          />
          <MoveTagDialog {...dialogProps("move")} move={editing.move} />
          <MergeTagDialog {...dialogProps("merge")} merge={editing.merge} />
          <TagDeleteDialog
            {...dialogProps("delete")}
            title={`Delete ${editing.editor.tagName}?`}
            description={`Deletes this tag${machinesPhrase}. The machines are otherwise unaffected. This cannot be undone.`}
            confirmLabel="Delete tag"
            onDelete={() => deleteTagAction({ tagId: editing.editor.tagId })}
            redirectTo={editing.parentHref}
          />
        </>
      ) : null}
    </>
  );
}

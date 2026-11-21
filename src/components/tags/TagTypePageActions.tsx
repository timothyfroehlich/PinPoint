"use client";

import type React from "react";
import { useState } from "react";
import { Plus } from "lucide-react";
import {
  PageActions,
  useReturnFocus,
  type PageActionSelect,
} from "~/components/list-view";
import { AddTagDialog } from "~/components/tags/AddTagDialog";
import {
  TagDeleteDialog,
  TagRenameDialog,
} from "~/components/tags/TagManageDialogs";
import { TagTypeExclusiveDialog } from "~/components/tags/TagTypeExclusiveDialog";
import {
  deleteTagTypeAction,
  renameTagTypeAction,
} from "~/app/(app)/c/tags/actions";
import type { TagConflictMachine } from "~/lib/tags/types";

interface TagTypePageActionsProps {
  tagTypeId: string;
  name: string;
  tagCount: number;
  exclusive: boolean;
  /** Machines holding more than one of its tags; empty when exclusive. */
  exclusiveConflicts: TagConflictMachine[];
}

type TagTypeDialog = "add" | "rename" | "exclusive" | "delete";

/**
 * A hand-applied tag type's page actions, for technicians and admins (spec
 * 11.7–11.9, 11.12; design-bible §26): Add tag, the page's create action,
 * then ⋯ holding Rename, the one-per-machine change, and Delete.
 */
export function TagTypePageActions({
  tagTypeId,
  name,
  tagCount,
  exclusive,
  exclusiveConflicts,
}: TagTypePageActionsProps): React.JSX.Element {
  const [dialog, setDialog] = useState<TagTypeDialog | null>(null);
  const returnFocus = useReturnFocus();
  const openDialog = (next: TagTypeDialog): PageActionSelect =>
    returnFocus.opens(() => setDialog(next));
  const dialogProps = (
    which: TagTypeDialog
  ): {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCloseAutoFocus: (event: Event) => void;
  } => ({
    open: dialog === which,
    onOpenChange: (open) => setDialog(open ? which : null),
    onCloseAutoFocus: returnFocus.onCloseAutoFocus,
  });
  const tagsPhrase =
    tagCount === 0
      ? ""
      : ` and its ${String(tagCount)} ${tagCount === 1 ? "tag" : "tags"}, removing them from every machine`;

  return (
    <>
      <PageActions
        actions={[
          {
            key: "add-tag",
            label: "Add tag",
            icon: Plus,
            primary: true,
            onSelect: openDialog("add"),
          },
        ]}
        menu={[
          [
            { key: "rename", label: "Rename…", onSelect: openDialog("rename") },
            {
              key: "exclusive",
              label: exclusive
                ? "Allow more than one per machine"
                : "Make one per machine",
              onSelect: openDialog("exclusive"),
            },
          ],
          [
            {
              key: "delete",
              label: "Delete tag type",
              destructive: true,
              onSelect: openDialog("delete"),
            },
          ],
        ]}
        foldSteps={[["add-tag"]]}
      />
      <AddTagDialog {...dialogProps("add")} type={{ id: tagTypeId, name }} />
      <TagRenameDialog
        {...dialogProps("rename")}
        title="Rename tag type"
        currentName={name}
        onRename={(next) => renameTagTypeAction({ tagTypeId, name: next })}
      />
      <TagTypeExclusiveDialog
        {...dialogProps("exclusive")}
        tagTypeId={tagTypeId}
        name={name}
        exclusive={exclusive}
        conflicts={exclusiveConflicts}
      />
      <TagDeleteDialog
        {...dialogProps("delete")}
        title={`Delete ${name}?`}
        description={`Deletes this tag type${tagsPhrase}. The machines are otherwise unaffected. This cannot be undone.`}
        confirmLabel="Delete tag type"
        onDelete={() => deleteTagTypeAction({ tagTypeId })}
        redirectTo="/c/tags"
      />
    </>
  );
}

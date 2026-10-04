"use client";

import type React from "react";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  TagDeleteDialog,
  TagRenameDialog,
} from "~/components/tags/TagManageDialogs";
import {
  deleteTagTypeAction,
  renameTagTypeAction,
} from "~/app/(app)/c/tags/actions";

interface TagTypeActionsMenuProps {
  tagTypeId: string;
  name: string;
  tagCount: number;
}

/** A hand-applied tag type's ⋯ menu: Rename and Delete (spec 11.8–11.9). */
export function TagTypeActionsMenu({
  tagTypeId,
  name,
  tagCount,
}: TagTypeActionsMenuProps): React.JSX.Element {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const tagsPhrase =
    tagCount === 0
      ? ""
      : ` and its ${String(tagCount)} ${tagCount === 1 ? "tag" : "tags"}, removing them from every machine`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Tag type actions">
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
            Rename…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            Delete tag type…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TagRenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename tag type"
        currentName={name}
        onRename={(next) => renameTagTypeAction({ tagTypeId, name: next })}
      />
      <TagDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${name}?`}
        description={`Deletes this tag type${tagsPhrase}. The machines are otherwise unaffected. This cannot be undone.`}
        confirmLabel="Delete tag type"
        onDelete={() => deleteTagTypeAction({ tagTypeId })}
        redirectTo="/c/tags"
      />
    </>
  );
}

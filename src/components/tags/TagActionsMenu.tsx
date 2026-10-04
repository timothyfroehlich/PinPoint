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
import { deleteTagAction, renameTagAction } from "~/app/(app)/c/tags/actions";

interface TagActionsMenuProps {
  tagId: string;
  name: string;
  machineCount: number;
  /** The tag type's page, or the tag browse for a tag with no tag type. */
  parentHref: string;
}

/** A hand-applied tag's ⋯ menu: Rename and Delete (spec 11.8–11.9). */
export function TagActionsMenu({
  tagId,
  name,
  machineCount,
  parentHref,
}: TagActionsMenuProps): React.JSX.Element {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const machinesPhrase =
    machineCount === 0
      ? ""
      : ` and removes it from ${String(machineCount)} ${machineCount === 1 ? "machine" : "machines"}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Tag actions">
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
            Delete tag…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TagRenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename tag"
        currentName={name}
        onRename={(next) => renameTagAction({ tagId, name: next })}
      />
      <TagDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${name}?`}
        description={`Deletes this tag${machinesPhrase}. The machines are otherwise unaffected. This cannot be undone.`}
        confirmLabel="Delete tag"
        onDelete={() => deleteTagAction({ tagId })}
        redirectTo={parentHref}
      />
    </>
  );
}

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
import { MoveTagDialog } from "~/components/tags/MoveTagDialog";
import { deleteTagAction, renameTagAction } from "~/app/(app)/c/tags/actions";
import type { TagMove } from "~/app/(app)/c/tags/[type]/[slug]/_data";

interface TagActionsMenuProps {
  tagId: string;
  name: string;
  machineCount: number;
  /** The tag type's page, or the tag browse for a tag with no tag type. */
  parentHref: string;
  /** What the Move dialog offers and what blocks each choice. */
  move: TagMove;
}

/**
 * A hand-applied tag's ⋯ menu: Rename, Move to another tag type, and Delete
 * (spec 11.8–11.9, 11.16).
 */
export function TagActionsMenu({
  tagId,
  name,
  machineCount,
  parentHref,
  move,
}: TagActionsMenuProps): React.JSX.Element {
  const [renameOpen, setRenameOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
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
          <DropdownMenuItem onSelect={() => setMoveOpen(true)}>
            Move to another tag type…
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
      <MoveTagDialog open={moveOpen} onOpenChange={setMoveOpen} move={move} />
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

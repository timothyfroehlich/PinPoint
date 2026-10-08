"use client";

import type React from "react";
import { useState } from "react";
import { MoreVertical } from "lucide-react";

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
  SETTINGS_TAGS_HREF,
  setsOnMachinesPhrase,
} from "~/lib/machines/settings-tags";
import {
  deleteSettingsTagAction,
  renameSettingsTagAction,
} from "~/app/(app)/c/settings-tags/actions";

interface SettingsTagActionsMenuProps {
  tagId: string;
  name: string;
  setCount: number;
  machineCount: number;
}

/**
 * A settings tag's ⋮ menu: Rename and Delete (machine-settings §3.3). Not
 * offered for House and Tournament (§3.2).
 */
export function SettingsTagActionsMenu({
  tagId,
  name,
  setCount,
  machineCount,
}: SettingsTagActionsMenuProps): React.JSX.Element {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const removes =
    setCount === 0
      ? "No sets carry this tag."
      : `Removes the tag from ${setsOnMachinesPhrase(setCount, machineCount)}. The sets themselves stay.`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="max-md:size-11"
            aria-label="More options for this tag"
          >
            <MoreVertical aria-hidden="true" />
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
        onRename={(next) => renameSettingsTagAction({ tagId, name: next })}
      />
      <TagDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete “${name}”?`}
        description={`${removes} This can't be undone.`}
        confirmLabel="Delete tag"
        onDelete={() => deleteSettingsTagAction({ tagId })}
        redirectTo={SETTINGS_TAGS_HREF}
      />
    </>
  );
}

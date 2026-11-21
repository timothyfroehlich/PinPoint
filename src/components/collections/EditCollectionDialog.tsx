"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import { CollectionFields } from "~/components/collections/CollectionFields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { updateCollectionAction } from "~/app/(app)/c/collections/actions";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

interface Props {
  /** The dialog opens from Edit collection in ⋯ (collections-and-tags 4.17). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string;
  currentName: string;
  currentDescription: ProseMirrorDoc | null;
  allMachines: { id: string; initials: string; name: string }[];
  currentIds: string[];
  /** Where focus goes when the dialog closes (useReturnFocus). */
  onCloseAutoFocus?: ((event: Event) => void) | undefined;
}

/**
 * "Edit collection" modal: renames the collection, edits its description, and
 * edits its machine set in one place, saved together via `updateCollectionAction`. Available to the owner
 * and editor collaborators. Deleting is its own ⋯ entry, for the owner
 * (CollectionDeleteDialog, collections-and-tags 4.17).
 */
export function EditCollectionDialog({
  open,
  onOpenChange: setOpen,
  collectionId,
  currentName,
  currentDescription,
  allMachines,
  currentIds,
  onCloseAutoFocus,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [description, setDescription] = useState<ProseMirrorDoc | null>(
    currentDescription
  );
  const [selected, setSelected] = useState<string[]>(currentIds);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savePending, startSave] = useTransition();

  // Re-seed the form to the current server state each time the modal opens, so
  // a cancelled edit or a change from another tab never leaves stale values.
  useEffect(() => {
    if (open) {
      setName(currentName);
      setDescription(currentDescription);
      setSelected(currentIds);
      setSaveError(null);
    }
  }, [open, currentName, currentDescription, currentIds]);

  function save(): void {
    setSaveError(null);
    startSave(async () => {
      const result = await updateCollectionAction({
        collectionId,
        name,
        description,
        machineIds: selected,
      });
      if (!result.success) setSaveError(result.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-lg"
        onCloseAutoFocus={onCloseAutoFocus}
        // A stray backdrop click shouldn't discard an in-progress edit — only
        // Cancel / the X / Esc close it (unsaved-form dismissal guidance).
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Edit collection</DialogTitle>
          <DialogDescription>
            Rename the collection, describe it, and choose which machines belong
            to it.
          </DialogDescription>
        </DialogHeader>

        <CollectionFields
          name={name}
          onNameChange={setName}
          initialDescription={currentDescription}
          onDescriptionChange={setDescription}
          selected={selected}
          onSelectedChange={setSelected}
          allMachines={allMachines}
          idPrefix="edit-collection"
        />

        {saveError && (
          <p className="mt-4 text-sm text-destructive-text" role="alert">
            {saveError}
          </p>
        )}

        <div className="flex flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={save}
            loading={savePending}
            data-testid="collection-save"
          >
            {savePending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

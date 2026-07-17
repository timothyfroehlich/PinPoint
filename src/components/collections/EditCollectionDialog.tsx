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
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import {
  deleteCollectionAction,
  updateCollectionAction,
} from "~/app/(app)/c/collections/actions";

interface Props {
  collectionId: string;
  currentName: string;
  allMachines: { id: string; initials: string; name: string }[];
  currentIds: string[];
}

/**
 * Owner-only "Edit collection" modal: renames the collection and edits its
 * machine set in one place, saved together via `updateCollectionAction`. A
 * footer "Delete collection" button removes it behind a nested confirm.
 */
export function EditCollectionDialog({
  collectionId,
  currentName,
  allMachines,
  currentIds,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [selected, setSelected] = useState<string[]>(currentIds);
  const [error, setError] = useState<string | null>(null);
  const [savePending, startSave] = useTransition();
  const [deletePending, startDelete] = useTransition();

  // Re-seed the form to the current server state each time the modal opens, so
  // a cancelled edit or a change from another tab never leaves stale values.
  useEffect(() => {
    if (open) {
      setName(currentName);
      setSelected(currentIds);
      setError(null);
    }
  }, [open, currentName, currentIds]);

  function save(): void {
    setError(null);
    startSave(async () => {
      const result = await updateCollectionAction({
        collectionId,
        name,
        machineIds: selected,
      });
      if (!result.success) setError(result.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  function remove(): void {
    setError(null);
    startDelete(async () => {
      const result = await deleteCollectionAction({ collectionId });
      if (!result.success) setError(result.error);
      else router.push("/c/collections");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="collection-edit-trigger">
          Edit collection
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-lg"
        // A stray backdrop click shouldn't discard an in-progress edit — only
        // Cancel / the X / Esc close it (unsaved-form dismissal guidance).
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Edit collection</DialogTitle>
          <DialogDescription>
            Rename the collection and choose which machines belong to it.
          </DialogDescription>
        </DialogHeader>

        <CollectionFields
          name={name}
          onNameChange={setName}
          selected={selected}
          onSelectedChange={setSelected}
          allMachines={allMachines}
          idPrefix="edit-collection"
        />

        {error && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="@container flex flex-row items-center justify-between gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                data-testid="collection-delete-trigger"
              >
                {/* Narrow footer (mobile dialog): shorten the label to one row. */}
                <span className="@sm:hidden">Delete</span>
                <span className="hidden @sm:inline">Delete collection</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this collection?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the collection and its machine list. The machines
                  themselves and their issues are not affected. This cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 sm:gap-0">
                <AlertDialogCancel>Keep collection</AlertDialogCancel>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={remove}
                  disabled={deletePending}
                  data-testid="collection-delete-confirm"
                >
                  {deletePending ? "Deleting…" : "Delete collection"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex gap-2">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

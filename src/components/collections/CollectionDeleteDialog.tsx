"use client";

import type React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { deleteCollectionAction } from "~/app/(app)/c/collections/actions";

interface Props {
  /** Opens from Delete collection in ⋯, for the owner (collections-and-tags 4.17). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string;
  /** Where focus goes when the dialog closes (useReturnFocus). */
  onCloseAutoFocus?: ((event: Event) => void) | undefined;
}

/**
 * Confirms deleting a Collection, then goes to the Collections list. A
 * Collection already gone offers the way back instead. The dialog stays
 * open while the delete runs.
 */
export function CollectionDeleteDialog({
  open,
  onOpenChange,
  collectionId,
  onCloseAutoFocus,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [deleteError, setDeleteError] = useState<{
    message: string;
    code: "not_found" | undefined;
  } | null>(null);
  const [deletePending, startDelete] = useTransition();

  // Each opening starts without the last attempt's error.
  useEffect(() => {
    if (open) setDeleteError(null);
  }, [open]);

  function remove(): void {
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteCollectionAction({ collectionId });
      if (!result.success)
        setDeleteError({ message: result.error, code: result.code });
      else router.push("/c/collections");
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && deletePending) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={(event) => {
          if (deletePending) event.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {deleteError?.code === "not_found"
              ? "Collection unavailable"
              : "Delete this collection?"}
          </AlertDialogTitle>
          {deleteError?.code !== "not_found" && (
            <AlertDialogDescription>
              This removes the collection and its machine list. The machines
              themselves and their issues are not affected. This cannot be
              undone.
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        {deleteError && (
          <div
            role="alert"
            className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-destructive-text"
          >
            <p className="text-sm font-medium">{deleteError.message}</p>
          </div>
        )}
        <AlertDialogFooter className="gap-2 sm:gap-0">
          {deleteError?.code === "not_found" ? (
            <Button asChild>
              <Link href="/c/collections">Back to collections</Link>
            </Button>
          ) : (
            <>
              <AlertDialogCancel disabled={deletePending}>
                Keep collection
              </AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                onClick={remove}
                disabled={deletePending}
                data-testid="collection-delete-confirm"
              >
                {deletePending ? "Deleting…" : "Delete collection"}
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

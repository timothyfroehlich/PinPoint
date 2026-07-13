"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
  renameCollectionAction,
} from "~/app/(app)/c/collections/actions";

interface Props {
  collectionId: string;
  currentName: string;
}

export function CollectionOwnerControls({
  collectionId,
  currentName,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [renamePending, startRename] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function rename(formData: FormData): void {
    setError(null);
    const raw = formData.get("name");
    const name = typeof raw === "string" ? raw : "";
    startRename(async () => {
      const result = await renameCollectionAction({ collectionId, name });
      if (!result.success) setError(result.error);
      else router.refresh();
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
    <div className="flex flex-wrap items-start gap-3">
      <form action={rename} className="flex items-start gap-2">
        <Input
          name="name"
          required
          maxLength={120}
          defaultValue={currentName}
          aria-label="Collection name"
          enterKeyHint="done"
          className="w-64"
        />
        <Button type="submit" variant="outline" disabled={renamePending}>
          {renamePending ? "Saving…" : "Rename"}
        </Button>
      </form>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" data-testid="collection-delete-trigger">
            Delete collection
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

      {error && (
        <p className="w-full text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { CollectionFields } from "~/components/collections/CollectionFields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { createCollectionAction } from "~/app/(app)/c/collections/actions";

interface Props {
  allMachines: { id: string; initials: string; name: string }[];
}

/**
 * "New collection" modal: name + machine set in one step, so a collection can
 * be created with its machines already attached. Shares the form body with the
 * edit dialog via {@link CollectionFields}; navigates to the new collection on
 * success.
 */
export function CreateCollectionDialog({
  allMachines,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Reset the form each time the modal opens.
  useEffect(() => {
    if (open) {
      setName("");
      setSelected([]);
      setError(null);
    }
  }, [open]);

  function create(): void {
    setError(null);
    startTransition(async () => {
      const result = await createCollectionAction({
        name,
        machineIds: selected,
      });
      if (!result.success) setError(result.error);
      else if (result.data) {
        setOpen(false);
        router.push(`/c/${result.data.id}`);
      } else setError("Create failed");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="create-collection-trigger">
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          New collection
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-lg"
        // A stray backdrop click shouldn't discard an in-progress collection —
        // only Cancel / the X / Esc close it (unsaved-form dismissal guidance).
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>New collection</DialogTitle>
          <DialogDescription>
            Name your collection and add machines to it.
          </DialogDescription>
        </DialogHeader>

        <CollectionFields
          name={name}
          onNameChange={setName}
          selected={selected}
          onSelectedChange={setSelected}
          allMachines={allMachines}
          idPrefix="new-collection"
        />

        {error && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={create}
            loading={pending}
            disabled={name.trim() === ""}
            data-testid="create-collection-submit"
          >
            {pending ? "Creating…" : "Create collection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

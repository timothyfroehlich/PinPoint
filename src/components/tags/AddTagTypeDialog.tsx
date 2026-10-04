"use client";

import type React from "react";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { TagNameField } from "~/components/tags/TagNameField";
import { createTagTypeAction } from "~/app/(app)/c/tags/actions";

/** "Add tag type" on the tag browse (spec 11.1, 11.12). */
export function AddTagTypeDialog(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          Add tag type
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        {/* Mounts with the content, so each open starts clean. */}
        <AddTagTypeForm onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddTagTypeForm({
  onClose,
}: {
  onClose: () => void;
}): React.JSX.Element {
  const id = useId();
  const router = useRouter();
  const [name, setName] = useState("");
  const [exclusive, setExclusive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createTagTypeAction({ name, exclusive });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>Add tag type</DialogTitle>
        <DialogDescription>
          A kind of tag, like Location or Features.
        </DialogDescription>
      </DialogHeader>
      <TagNameField
        id={`${id}-name`}
        value={name}
        onChange={setName}
        errorId={error === null ? undefined : `${id}-error`}
      />
      <div className="flex items-start gap-3">
        <Checkbox
          id={`${id}-exclusive`}
          checked={exclusive}
          onCheckedChange={(checked) => setExclusive(checked === true)}
          aria-describedby={`${id}-exclusive-hint`}
          className="mt-0.5"
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-exclusive`}>One per machine</Label>
          <p
            id={`${id}-exclusive-hint`}
            className="text-xs text-muted-foreground"
          >
            A machine can hold only one of its tags.
          </p>
        </div>
      </div>
      {error !== null ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-sm text-destructive-text"
        >
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={pending} disabled={name.trim() === ""}>
          Add tag type
        </Button>
      </DialogFooter>
    </form>
  );
}

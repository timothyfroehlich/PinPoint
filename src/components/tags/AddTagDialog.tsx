"use client";

import type React from "react";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { TagNameField } from "~/components/tags/TagNameField";
import { createTagAction } from "~/app/(app)/c/tags/actions";

/** Radix Select cannot hold an empty value, so "no tag type" is this. */
const NO_TYPE = "none";

interface TagTypeOption {
  id: string;
  name: string;
}

type AddTagDialogProps =
  /** From the tag browse: the person picks a hand-applied type, or none. */
  | { types: TagTypeOption[]; type?: undefined }
  /** From a hand-applied type's page: the tag joins that type. */
  | { type: TagTypeOption; types?: undefined };

/** "Add tag" on the tag browse and on a hand-applied type's page (spec 11.3, 11.12). */
export function AddTagDialog(props: AddTagDialogProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          Add tag
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        {/* Mounts with the content, so each open starts clean. */}
        <AddTagForm {...props} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddTagForm({
  types,
  type,
  onClose,
}: AddTagDialogProps & { onClose: () => void }): React.JSX.Element {
  const id = useId();
  const router = useRouter();
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState(type?.id ?? NO_TYPE);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createTagAction({
        name,
        tagTypeId: typeId === NO_TYPE ? null : typeId,
      });
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
        <DialogTitle>
          {type ? `Add tag to ${type.name}` : "Add tag"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Name a new tag to apply to machines.
        </DialogDescription>
      </DialogHeader>
      <TagNameField
        id={`${id}-name`}
        value={name}
        onChange={setName}
        errorId={error === null ? undefined : `${id}-error`}
      />
      {types ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-type`}>Tag type</Label>
          <Select value={typeId} onValueChange={setTypeId}>
            <SelectTrigger id={`${id}-type`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_TYPE}>No type</SelectItem>
              {types.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
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
          Add tag
        </Button>
      </DialogFooter>
    </form>
  );
}

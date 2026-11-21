"use client";

import type React from "react";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  normalizeTagName,
  TAG_NAME_MAX,
  tagNameLength,
} from "~/lib/tags/names";
import { cn } from "~/lib/utils";
import { createSettingsTagAction } from "~/app/(app)/c/settings-tags/actions";

interface NewSettingsTagDialogProps {
  /** Opens from the page's New settings tag action (design-bible §26.1). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes when the dialog closes (useReturnFocus). */
  onCloseAutoFocus?: ((event: Event) => void) | undefined;
}

/** "New settings tag" on the Settings tags page (machine-settings §3.3). */
export function NewSettingsTagDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: NewSettingsTagDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-sm"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {/* Mounts with the content, so each open starts clean. */}
        <NewSettingsTagForm onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function NewSettingsTagForm({
  onClose,
}: {
  onClose: () => void;
}): React.JSX.Element {
  const id = useId();
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const length = tagNameLength(normalizeTagName(name));
  const tooLong = length > TAG_NAME_MAX;

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createSettingsTagAction({ name });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  const describedBy = [
    `${id}-count`,
    error === null ? undefined : `${id}-error`,
  ]
    .filter((part) => part !== undefined)
    .join(" ");

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>New settings tag</DialogTitle>
        <DialogDescription className="sr-only">
          Name a tag to apply to settings sets on any machine.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-name`}>Name</Label>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          required
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={tooLong || error !== null}
          aria-describedby={describedBy}
          className="max-md:h-11"
        />
        <span
          id={`${id}-count`}
          className={cn(
            "self-end text-xs tabular-nums",
            tooLong ? "text-destructive-text" : "text-muted-foreground"
          )}
        >
          <span className="sr-only">Characters used: </span>
          {length}/{TAG_NAME_MAX}
        </span>
        {error !== null ? (
          <p
            id={`${id}-error`}
            role="alert"
            className="text-sm text-destructive-text"
          >
            {error}
          </p>
        ) : null}
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="max-md:h-11"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={pending}
          disabled={name.trim() === "" || tooLong}
          className="max-md:h-11"
        >
          Create tag
        </Button>
      </DialogFooter>
    </form>
  );
}

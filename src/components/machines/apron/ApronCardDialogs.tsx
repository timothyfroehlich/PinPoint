"use client";

import type React from "react";
import { useId, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
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
import { APRON_CARD_NAME_MAX } from "~/app/(app)/m/[initials]/(tabs)/apron/schemas";

/** Rename card (spec §11.5): names stay unique within the machine (§11.2). */
export function RenameCardDialog({
  open,
  onOpenChange,
  name,
  otherNames,
  onRename,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  otherNames: readonly string[];
  onRename: (name: string) => void;
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {open ? (
          <RenameForm
            name={name}
            otherNames={otherNames}
            onCancel={() => {
              onOpenChange(false);
            }}
            onRename={(next) => {
              onRename(next);
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({
  name,
  otherNames,
  onCancel,
  onRename,
}: {
  name: string;
  otherNames: readonly string[];
  onCancel: () => void;
  onRename: (name: string) => void;
}): React.JSX.Element {
  const id = useId();
  const [value, setValue] = useState(name);
  const trimmed = value.trim();
  const error =
    trimmed === ""
      ? "Name required"
      : otherNames.includes(trimmed)
        ? "Name already used"
        : null;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (error === null) onRename(trimmed);
      }}
    >
      <DialogHeader>
        <DialogTitle>Rename card</DialogTitle>
        <DialogDescription className="sr-only">
          A new name for {name}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-name`}>Name</Label>
        <Input
          id={`${id}-name`}
          value={value}
          maxLength={APRON_CARD_NAME_MAX}
          aria-invalid={error !== null && trimmed !== name}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            setValue(event.target.value);
          }}
        />
        {error !== null && trimmed !== "" ? (
          <p id={`${id}-error`} className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={error !== null}>
          Rename
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Delete card (spec §11.5): takes effect when the tab is saved. */
export function DeleteCardDialog({
  open,
  onOpenChange,
  name,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onDelete: () => void;
}): React.JSX.Element {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its description, tip and settings are removed when you save.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete}>
            Delete card
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

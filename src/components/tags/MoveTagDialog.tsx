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
import { TagConflictNotice } from "~/components/tags/TagConflictNotice";
import { moveTagAction } from "~/app/(app)/c/tags/actions";
import type {
  TagMove,
  TagMoveDestination,
} from "~/app/(app)/c/tags/[type]/[slug]/_data";
import { nameTakenMessage, wouldHoldTwoMessage } from "~/lib/tags/messages";
import type { TagConflictMachine } from "~/lib/tags/types";

interface MoveTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  move: TagMove;
}

/** The `<select>` value standing for no tag type. */
const NO_TYPE = "none";

function optionValue(typeId: string | null): string {
  return typeId ?? NO_TYPE;
}

function optionLabel(
  destination: TagMoveDestination,
  current: boolean
): string {
  const name =
    destination.id === null
      ? "No type"
      : destination.exclusive
        ? `${destination.name} · one per machine`
        : destination.name;
  return current ? `${name} (current)` : name;
}

function moveHelp(typeName: string): string {
  return `Remove their ${typeName} tags first, or pick another tag type.`;
}

interface Block {
  message: string;
  machines?: readonly TagConflictMachine[];
  help?: string;
}

/** Why the tag cannot move to `destination`, or null when it can (11.16). */
function blockFor(
  destination: TagMoveDestination,
  tagName: string
): Block | null {
  const typeName = destination.id === null ? null : destination.name;
  if (destination.nameTaken) {
    return { message: nameTakenMessage(typeName, tagName) };
  }
  if (destination.conflicts.length > 0) {
    return {
      message: wouldHoldTwoMessage(
        destination.name,
        destination.conflicts.length
      ),
      machines: destination.conflicts,
      help: moveHelp(destination.name),
    };
  }
  return null;
}

/**
 * Move a hand-applied tag into a tag type, to another, or out of its tag type
 * (spec 11.16). Each choice is checked as soon as it is picked, from what the
 * page read; the action checks again, and its refusal replaces the page's.
 */
export function MoveTagDialog({
  open,
  onOpenChange,
  move,
}: MoveTagDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {/* Mounts with the content, so each open starts at the current type. */}
        <MoveTagForm move={move} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function MoveTagForm({
  move,
  onClose,
}: {
  move: TagMove;
  onClose: () => void;
}): React.JSX.Element {
  const id = useId();
  const router = useRouter();
  const currentValue = optionValue(move.typeId);
  const [choice, setChoice] = useState(currentValue);
  const [refused, setRefused] = useState<Block | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Where the tag would go; undefined while the current type is picked.
  const destination =
    choice === currentValue
      ? undefined
      : move.destinations.find(
          (candidate) => optionValue(candidate.id) === choice
        );
  const block =
    refused ??
    (destination === undefined ? null : blockFor(destination, move.tagName));
  const machines = `${String(move.machineCount)} ${move.machineCount === 1 ? "machine" : "machines"}`;

  function pick(value: string): void {
    setChoice(value);
    setRefused(null);
    setError(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (destination === undefined || block !== null) return;
    setError(null);
    startTransition(async () => {
      const result = await moveTagAction({
        tagId: move.tagId,
        tagTypeId: destination.id,
      });
      if (!result.ok) {
        if (result.code === "CONFLICT") {
          setRefused({
            message: result.message,
            ...(result.meta !== undefined && {
              machines: result.meta.machines,
              help: moveHelp(destination.name),
            }),
          });
        } else {
          setError(result.message);
        }
        return;
      }
      onClose();
      router.push(result.value.href);
    });
  }

  return (
    <form className="flex min-w-0 flex-col gap-4" onSubmit={submit}>
      <DialogHeader className="text-left">
        <DialogTitle>Move {move.tagName}</DialogTitle>
        <DialogDescription>
          {move.typeName === null
            ? `No type · ${machines}`
            : `Now in ${move.typeName} · ${machines}`}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-type`} className="text-sm font-medium">
          Tag type
        </label>
        <select
          id={`${id}-type`}
          value={choice}
          onChange={(event) => pick(event.target.value)}
          className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-base text-foreground md:text-sm"
        >
          {move.destinations.map((candidate) => {
            const value = optionValue(candidate.id);
            const current = value === currentValue;
            return (
              <option key={value} value={value} disabled={current}>
                {optionLabel(candidate, current)}
              </option>
            );
          })}
        </select>
      </div>
      {block !== null ? <TagConflictNotice {...block} /> : null}
      {error !== null ? (
        <p role="alert" className="text-sm text-destructive-text">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          loading={pending}
          disabled={destination === undefined || block !== null}
        >
          Move tag
        </Button>
      </DialogFooter>
    </form>
  );
}

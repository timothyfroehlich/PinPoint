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
import { mergeTagAction } from "~/app/(app)/c/tags/actions";
import type {
  TagMerge,
  TagMergeGroup,
  TagMergeTarget,
} from "~/app/(app)/c/tags/[type]/[slug]/_data";
import {
  machines,
  mergeSummary,
  wouldHoldTwoMessage,
} from "~/lib/tags/messages";
import type { TagConflictMachine } from "~/lib/tags/types";

interface MergeTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merge: TagMerge;
}

function groupLabel(group: TagMergeGroup): string {
  if (group.typeName === null) return "Other tags";
  return group.exclusive
    ? `${group.typeName} · one per machine`
    : group.typeName;
}

function mergeHelp(typeName: string): string {
  return `Remove their ${typeName} tags first, or pick another tag.`;
}

interface Block {
  message: string;
  machines?: readonly TagConflictMachine[];
  help?: string;
}

/** Why the tag cannot be merged into `target`, or null when it can (11.18). */
function blockFor(target: TagMergeTarget, group: TagMergeGroup): Block | null {
  if (target.conflicts.length === 0 || group.typeName === null) return null;
  return {
    message: wouldHoldTwoMessage(group.typeName, target.conflicts.length),
    machines: target.conflicts,
    help: mergeHelp(group.typeName),
  };
}

/**
 * Merge a hand-applied tag into another (spec 11.17–11.19). Each choice is
 * checked as soon as it is picked, from what the page read; the action checks
 * again, and its refusal replaces the page's.
 */
export function MergeTagDialog({
  open,
  onOpenChange,
  merge,
}: MergeTagDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {/* Mounts with the content, so each open starts with nothing chosen. */}
        <MergeTagForm merge={merge} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function MergeTagForm({
  merge,
  onClose,
}: {
  merge: TagMerge;
  onClose: () => void;
}): React.JSX.Element {
  const id = useId();
  const router = useRouter();
  const [choice, setChoice] = useState("");
  const [refused, setRefused] = useState<Block | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The chosen tag and its group; undefined until one is picked.
  const picked = merge.groups
    .flatMap((group) => group.targets.map((target) => ({ group, target })))
    .find(({ target }) => target.id === choice);
  const block =
    refused ??
    (picked === undefined ? null : blockFor(picked.target, picked.group));

  function pick(value: string): void {
    setChoice(value);
    setRefused(null);
    setError(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (picked === undefined || block !== null) return;
    const { target, group } = picked;
    setError(null);
    startTransition(async () => {
      const result = await mergeTagAction({
        tagId: merge.tagId,
        targetTagId: target.id,
      });
      if (!result.ok) {
        if (result.code === "CONFLICT") {
          setRefused({
            message: result.message,
            ...(group.typeName !== null && { help: mergeHelp(group.typeName) }),
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
        <DialogTitle>Merge {merge.tagName} into another tag</DialogTitle>
        <DialogDescription>
          {`${merge.typeName ?? "No type"} · ${machines(merge.machineCount)}`}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-target`} className="text-sm font-medium">
          Merge into
        </label>
        <select
          id={`${id}-target`}
          value={choice}
          onChange={(event) => pick(event.target.value)}
          className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-base text-foreground md:text-sm"
        >
          <option value="" disabled>
            Choose a tag
          </option>
          {merge.groups.map((group) => (
            <optgroup key={group.typeName ?? ""} label={groupLabel(group)}>
              {group.targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {`${target.name} · ${machines(target.machineCount)}`}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {block !== null ? (
        <TagConflictNotice {...block} />
      ) : picked !== undefined ? (
        <p className="text-sm text-muted-foreground">
          {mergeSummary(
            merge.tagName,
            picked.target.name,
            merge.machineCount,
            picked.target.alreadyCount
          )}
        </p>
      ) : null}
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
          variant="destructive"
          loading={pending}
          disabled={picked === undefined || block !== null}
        >
          Merge tags
        </Button>
      </DialogFooter>
    </form>
  );
}

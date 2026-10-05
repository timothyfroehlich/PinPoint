"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { TagConflictNotice } from "~/components/tags/TagConflictNotice";
import { setTagTypeExclusiveAction } from "~/app/(app)/c/tags/actions";
import { tooManyTagsMessage } from "~/lib/tags/messages";
import type { TagConflictMachine } from "~/lib/tags/types";

interface TagTypeExclusiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tagTypeId: string;
  name: string;
  /** Whether the tag type is exclusive now; the dialog offers the opposite. */
  exclusive: boolean;
  /** Machines holding more than one of its tags, as the page last read them. */
  conflicts: readonly TagConflictMachine[];
}

/**
 * Confirm making a tag type one per machine, or allowing more than one (spec
 * 11.7). Making it one per machine is blocked while any machine holds more
 * than one of its tags: the dialog then lists them and offers only Close.
 */
export function TagTypeExclusiveDialog({
  open,
  onOpenChange,
  tagTypeId,
  name,
  exclusive,
  conflicts,
}: TagTypeExclusiveDialogProps): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Machines the action found in the way after the page was read.
  const [refused, setRefused] = useState<readonly TagConflictMachine[] | null>(
    null
  );
  const [pending, startTransition] = useTransition();

  const making = !exclusive;
  const blockers = making ? (refused ?? conflicts) : [];
  const blocked = blockers.length > 0;

  function confirm(): void {
    setError(null);
    startTransition(async () => {
      const result = await setTagTypeExclusiveAction({
        tagTypeId,
        exclusive: making,
      });
      if (!result.ok) {
        if (result.meta !== undefined) setRefused(result.meta.machines);
        else setError(result.message);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && pending) return;
        if (next) {
          setError(null);
          setRefused(null);
        }
        onOpenChange(next);
      }}
    >
      {/* Scrolls rather than running off a short phone screen. */}
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <AlertDialogHeader className="place-items-start text-left">
          <AlertDialogTitle>
            {making
              ? `Make ${name} one per machine?`
              : `Allow more than one ${name} tag per machine?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {making
              ? `Each machine can then hold only one ${name} tag. Tagging a machine replaces its other ${name} tag.`
              : `Machines can then hold several ${name} tags at once. Their current tags stay as they are.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {blocked ? (
          <TagConflictNotice
            message={tooManyTagsMessage(name, blockers.length)}
            machines={blockers}
            help="Remove the extra tags from these machines first."
          />
        ) : null}
        {error !== null ? (
          <p role="alert" className="text-sm text-destructive-text">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {blocked ? "Close" : "Cancel"}
          </AlertDialogCancel>
          {blocked ? null : (
            <Button type="button" onClick={confirm} loading={pending}>
              {making ? "Make one per machine" : "Allow more than one"}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

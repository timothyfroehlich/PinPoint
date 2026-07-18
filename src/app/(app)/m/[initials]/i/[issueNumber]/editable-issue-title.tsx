"use client";

import type React from "react";
import { useState, useRef, useEffect, useActionState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { toast } from "sonner";
import {
  updateIssueTitleAction,
  type UpdateIssueTitleResult,
} from "~/app/(app)/issues/actions";
import { cn } from "~/lib/utils";

interface EditableIssueTitleProps {
  issueId: string;
  title: string;
  canEdit: boolean;
  className?: string;
}

export function EditableIssueTitle({
  issueId,
  title,
  canEdit,
  className,
}: EditableIssueTitleProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState<
    UpdateIssueTitleResult | undefined,
    FormData
  >(updateIssueTitleAction, undefined);

  // Track edit sessions so a state.ok=false left over from a previous
  // (already-canceled) edit doesn't bleed into the onBlur logic of a fresh
  // edit session. useActionState has no built-in reset, so we tag the
  // session that owned an error and only suppress the auto-cancel for
  // that session.
  const editSessionRef = useRef(0);
  const erroredSessionRef = useRef<number | null>(null);

  // Focus input + bump the session counter when entering edit mode
  useEffect(() => {
    if (isEditing) {
      editSessionRef.current += 1;
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  // Tag the current edit session whenever the action returns an error
  useEffect(() => {
    if (state?.ok === false) {
      erroredSessionRef.current = editSessionRef.current;
    }
  }, [state]);

  // Re-sync editValue when title prop changes (e.g., from server revalidation)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(title);
    }
  }, [title, isEditing]);

  // Handle action result
  useEffect(() => {
    if (state?.ok) {
      toast.success("Title updated");
      setIsEditing(false);
    } else if (state?.ok === false) {
      toast.error(state.message);
    }
  }, [state]);

  const handleCancel = (): void => {
    setEditValue(title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Escape") {
      handleCancel();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = editValue.trim();
      if (trimmed.length === 0 || trimmed === title) {
        handleCancel();
        return;
      }
      formRef.current?.requestSubmit();
    }
  };

  if (!canEdit) {
    return (
      <h1
        className={cn(
          "text-balance font-extrabold tracking-tight",
          className ?? "text-3xl @3xl:text-4xl"
        )}
        title={title.length > 60 ? title : undefined}
      >
        {title.length > 60 ? `${title.slice(0, 60)}...` : title}
      </h1>
    );
  }

  if (isEditing) {
    return (
      <form
        ref={formRef}
        action={formAction}
        className="flex items-center gap-2"
      >
        <input type="hidden" name="issueId" value={issueId} />
        <Input
          ref={inputRef}
          name="title"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Small delay to allow form submit to fire first
            window.setTimeout(() => {
              // Skip cancel if THIS edit session's submission errored —
              // the user's typed edit would otherwise be silently
              // discarded when they move focus to read the error toast.
              // Press Escape to explicitly abandon a failed edit. The
              // session-counter check ensures a stale error from a
              // previous session doesn't block a fresh session's cancel.
              const currentSessionErrored =
                erroredSessionRef.current === editSessionRef.current;
              if (!isPending && !currentSessionErrored) {
                handleCancel();
              }
            }, 200);
          }}
          maxLength={100}
          className={cn(
            "h-auto py-1 font-extrabold tracking-tight",
            className ?? "text-2xl @3xl:text-3xl"
          )}
          aria-label="Edit issue title"
          disabled={isPending}
        />
        {isPending && (
          <Loader2 className="size-5 animate-spin motion-reduce:animate-none text-muted-foreground shrink-0" />
        )}
      </form>
    );
  }

  return (
    <div className="group/title flex items-center gap-2">
      <h1
        className={cn(
          "text-balance font-extrabold tracking-tight",
          className ?? "text-3xl @3xl:text-4xl"
        )}
        title={title.length > 60 ? title : undefined}
      >
        {title.length > 60 ? `${title.slice(0, 60)}...` : title}
      </h1>
      <Button
        variant="ghost"
        size="icon-sm"
        className="opacity-0 group-hover/title:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 shrink-0"
        onClick={() => setIsEditing(true)}
        aria-label="Edit title"
      >
        <Pencil className="size-4" />
      </Button>
    </div>
  );
}

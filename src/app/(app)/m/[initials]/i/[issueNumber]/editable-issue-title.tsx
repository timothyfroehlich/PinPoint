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
import { ISSUE_TITLE_MAX, ISSUE_TITLE_MAX_MESSAGE } from "~/lib/issues/title";

interface EditableIssueTitleProps {
  issueId: string;
  title: string;
  canEdit: boolean;
  /** Controls after Edit title, e.g. the Move button. */
  actions?: React.ReactNode;
}

const titleClassName =
  "min-w-0 flex-1 text-balance break-words text-2xl font-bold tracking-tight md:text-3xl";

export function EditableIssueTitle({
  issueId,
  title,
  canEdit,
  actions,
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
      if (trimmed.length > ISSUE_TITLE_MAX) {
        toast.error(ISSUE_TITLE_MAX_MESSAGE);
        return;
      }
      formRef.current?.requestSubmit();
    }
  };

  const heading = (
    <h1 className={titleClassName} data-testid="issue-title">
      {title}
    </h1>
  );

  if (isEditing) {
    const length = editValue.trim().length;
    return (
      <form ref={formRef} action={formAction} className="space-y-1">
        <input type="hidden" name="issueId" value={issueId} />
        <div className="flex items-center gap-2">
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
            // An older title may already exceed the limit (§4.4): the browser
            // keeps an over-long value but blocks typing more, so it can only
            // be edited down.
            maxLength={ISSUE_TITLE_MAX}
            className="h-auto py-1 text-xl font-bold tracking-tight md:text-2xl"
            aria-label="Edit issue title"
            aria-describedby="issue-title-length"
            disabled={isPending}
          />
          {isPending && (
            <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" />
          )}
        </div>
        <div
          id="issue-title-length"
          className={cn(
            "text-xs",
            length > ISSUE_TITLE_MAX
              ? "text-destructive-text"
              : "text-muted-foreground"
          )}
        >
          {length}/{ISSUE_TITLE_MAX}
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-start gap-1">
      {heading}
      {canEdit || actions ? (
        <div className="-mr-2 flex shrink-0 items-center gap-1 md:mr-0 md:gap-2">
          {canEdit ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-11 text-muted-foreground hover:text-foreground md:size-9"
              onClick={() => setIsEditing(true)}
              aria-label="Edit title"
              data-testid="issue-edit-title"
            >
              <Pencil className="size-4" />
            </Button>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}

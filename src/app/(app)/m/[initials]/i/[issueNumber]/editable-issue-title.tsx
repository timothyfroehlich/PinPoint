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

interface EditableIssueTitleProps {
  issueId: string;
  title: string;
  canEdit: boolean;
}

export function EditableIssueTitle({
  issueId,
  title,
  canEdit,
}: EditableIssueTitleProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState<
    UpdateIssueTitleResult | undefined,
    FormData
  >(updateIssueTitleAction, undefined);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

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
        className="text-3xl lg:text-4xl font-extrabold tracking-tight"
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
              if (!isPending) {
                handleCancel();
              }
            }, 200);
          }}
          maxLength={100}
          className="text-2xl lg:text-3xl font-extrabold tracking-tight h-auto py-1"
          aria-label="Edit issue title"
          disabled={isPending}
        />
        {isPending && (
          <Loader2 className="size-5 animate-spin text-muted-foreground flex-shrink-0" />
        )}
      </form>
    );
  }

  return (
    <div className="group/title flex items-center gap-2">
      <h1
        className="text-3xl lg:text-4xl font-extrabold tracking-tight"
        title={title.length > 60 ? title : undefined}
      >
        {title.length > 60 ? `${title.slice(0, 60)}...` : title}
      </h1>
      <Button
        variant="ghost"
        size="icon-sm"
        className="opacity-0 group-hover/title:opacity-100 focus-visible:opacity-100 transition-opacity flex-shrink-0"
        onClick={() => setIsEditing(true)}
        aria-label="Edit title"
      >
        <Pencil className="size-4" />
      </Button>
    </div>
  );
}

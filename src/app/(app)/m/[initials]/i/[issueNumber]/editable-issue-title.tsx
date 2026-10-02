"use client";

import type React from "react";
import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useActionState,
} from "react";
import { ArrowLeftRight, Loader2, MoreHorizontal, Pencil } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "sonner";
import {
  updateIssueTitleAction,
  type UpdateIssueTitleResult,
} from "~/app/(app)/issues/actions";
import { useIsMobile } from "~/hooks/use-is-mobile";
import { cn } from "~/lib/utils";
import { ISSUE_TITLE_MAX, ISSUE_TITLE_MAX_MESSAGE } from "~/lib/issues/title";
import { ReassignMachineForm } from "./reassign-machine-form";
import {
  withTransportFailure,
  type TransportFailure,
} from "./transport-failure";

const updateTitleOrFail = withTransportFailure(updateIssueTitleAction);

interface EditableIssueTitleProps {
  issueId: string;
  title: string;
  canEdit: boolean;
  /**
   * The header's first row (Issue ID chip and machine link). On mobile the ⋯
   * menu sits at its end so the title gets the full width (spec §4.1, §4.5).
   */
  eyebrow?: React.ReactNode;
  /** Present when the viewer can move the issue to another machine. */
  move?: {
    currentInitials: string;
    machines: { initials: string; name: string }[];
  };
}

// The input matches the heading's type so the header doesn't jump.
const titleTypeClassName = "text-2xl font-bold tracking-tight md:text-3xl";
const titleClassName = cn(
  "min-w-0 flex-1 text-balance break-words",
  titleTypeClassName
);

/**
 * The issue title with its edit and move actions (spec issue-detail §4.2–§4.6).
 *
 * Editing happens in place:
 * - Desktop: Enter saves, Escape cancels, and leaving the field cancels unless
 *   the save just failed.
 * - Mobile (below `md:`): Save and Cancel buttons sit under the input, the
 *   keyboard's Done key saves, and leaving the field does not cancel — on a
 *   phone, focus leaves the field for many reasons that aren't "cancel"
 *   (scrolling, the keyboard closing). A behavior swap, so it reads
 *   `useIsMobile` (CORE-RESP-002 exception).
 *
 * When the editor or the Move dialog closes, focus goes back to the control
 * that opened it (the Edit title or Move button on desktop, the ⋯ menu on
 * mobile) rather than falling to `<body>`.
 */
export function EditableIssueTitle({
  issueId,
  title,
  canEdit,
  eyebrow,
  move,
}: EditableIssueTitleProps): React.JSX.Element {
  const isMobile = useIsMobile();
  const [isEditing, setIsEditing] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  // A menu choice keeps focus where the choice put it (the title input or
  // the move dialog) instead of returning it to the ⋯ trigger, which would
  // blur — and so cancel — a fresh title edit.
  const menuChoiceRef = useRef(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const moveButtonRef = useRef<HTMLButtonElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  // Set when the editor closes while focus is inside it.
  const restoreFocusRef = useRef(false);

  const [state, formAction, isPending] = useActionState<
    UpdateIssueTitleResult | TransportFailure | undefined,
    FormData
  >(updateTitleOrFail, undefined);
  // Why the last save didn't happen, shown under the field until the next
  // keystroke or edit.
  const [error, setError] = useState<string | null>(null);

  // The blur handler runs in a timeout, after the render it was created in;
  // a ref gives it the current pending state rather than a stale one.
  const isPendingRef = useRef(isPending);
  isPendingRef.current = isPending;

  // Track edit sessions so a state.ok=false left over from a previous
  // (already-canceled) edit doesn't bleed into the onBlur logic of a fresh
  // edit session. useActionState has no built-in reset, so we tag the
  // session that owned an error and only suppress the auto-cancel for
  // that session.
  const editSessionRef = useRef(0);
  const erroredSessionRef = useRef<number | null>(null);

  // Focus the input with the cursor at the end, and bump the session counter,
  // when entering edit mode.
  useEffect(() => {
    if (isEditing) {
      editSessionRef.current += 1;
      const input = inputRef.current;
      if (input) {
        input.focus();
        const end = input.value.length;
        input.setSelectionRange(end, end);
      }
    }
  }, [isEditing]);

  // Grow the field to fit its text. `field-sizing: content` does this where
  // supported; setting the height covers browsers without it.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!isEditing || !input) return;
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  }, [isEditing, editValue]);

  // Return focus to the control that opened the editor once it closes.
  useEffect(() => {
    if (isEditing || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    (isMobile ? menuTriggerRef.current : editButtonRef.current)?.focus();
  }, [isEditing, isMobile]);

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

  // Restore focus on close only when it was inside the editor (or already
  // lost); a blur to another control keeps focus where the person put it.
  const focusIsInEditor = (): boolean => {
    const active = document.activeElement;
    return (
      active === null ||
      active === document.body ||
      (formRef.current?.contains(active) ?? false)
    );
  };

  const closeEditor = (): void => {
    restoreFocusRef.current = focusIsInEditor();
    setError(null);
    setIsEditing(false);
  };

  // Handle action result
  useEffect(() => {
    if (state?.ok) {
      toast.success("Title updated");
      const active = document.activeElement;
      restoreFocusRef.current =
        active === null ||
        active === document.body ||
        (formRef.current?.contains(active) ?? false);
      setError(null);
      setIsEditing(false);
    } else if (state?.ok === false) {
      setError(state.message);
      toast.error(state.message);
    }
  }, [state]);

  const handleCancel = (): void => {
    setEditValue(title);
    closeEditor();
  };

  const handleSave = (): void => {
    if (isPendingRef.current) return;
    const trimmed = editValue.trim();
    if (trimmed.length === 0 || trimmed === title) {
      handleCancel();
      return;
    }
    if (trimmed.length > ISSUE_TITLE_MAX) {
      setError(ISSUE_TITLE_MAX_MESSAGE);
      toast.error(ISSUE_TITLE_MAX_MESSAGE);
      return;
    }
    formRef.current?.requestSubmit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Enter that confirms an IME composition is not a save.
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      handleSave();
    }
  };

  const heading = (
    <h1 className={titleClassName} data-testid="issue-title">
      {title}
    </h1>
  );

  const length = editValue.trim().length;
  const atLimit = length >= ISSUE_TITLE_MAX;
  const editor = (
    <form ref={formRef} action={formAction} className="space-y-1">
      {/* The page keeps its h1 while the title is being edited. */}
      <h1 className="sr-only">{title}</h1>
      <input type="hidden" name="issueId" value={issueId} />
      <div className="flex items-center gap-2">
        <Textarea
          ref={inputRef}
          name="title"
          // One logical line that wraps like the heading it replaces, so a
          // long title stays fully visible while it's edited. Enter saves,
          // and pasted line breaks become spaces.
          rows={1}
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value.replace(/\r?\n/g, " "));
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // On mobile, leaving the field never cancels: Save and Cancel
            // are explicit.
            if (isMobile) return;
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
              if (!isPendingRef.current && !currentSessionErrored) {
                handleCancel();
              }
            }, 200);
          }}
          // An older title may already exceed the limit (§4.4): the browser
          // keeps an over-long value but blocks typing more, so it can only
          // be edited down.
          maxLength={ISSUE_TITLE_MAX}
          enterKeyHint="done"
          className={cn(
            "min-h-0 resize-none overflow-hidden px-2 py-0.5",
            titleTypeClassName
          )}
          aria-label="Edit issue title"
          aria-describedby={cn(
            error && "issue-title-error",
            "issue-title-length issue-title-edit-help"
          )}
          aria-invalid={error ? true : undefined}
          // Read-only, not disabled, while saving: a disabled input drops
          // focus to <body>.
          readOnly={isPending}
          aria-busy={isPending || undefined}
        />
        {isPending && (
          <Loader2
            className="size-5 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
      </div>
      {error ? (
        <p
          id="issue-title-error"
          role="alert"
          className="text-sm text-destructive-text"
        >
          {error}
        </p>
      ) : null}
      {/* Reaching the limit is announced; every keystroke is not. */}
      <span className="sr-only" aria-live="polite">
        {atLimit ? `${length} of ${ISSUE_TITLE_MAX} characters` : ""}
      </span>
      <span id="issue-title-edit-help" className="sr-only">
        {isMobile
          ? "Done or Save saves. Cancel discards the edit."
          : "Enter saves. Escape cancels."}
      </span>
      <div className="flex items-start justify-between gap-2">
        <div
          id="issue-title-length"
          className={cn(
            "text-xs",
            atLimit ? "text-destructive-text" : "text-muted-foreground"
          )}
        >
          {length}/{ISSUE_TITLE_MAX}
        </div>
        {isMobile ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              // 44px hit area without a taller button.
              className="relative after:absolute after:inset-x-0 after:-inset-y-1.5"
              onClick={handleCancel}
              aria-disabled={isPending || undefined}
              data-testid="issue-title-cancel"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="relative after:absolute after:inset-x-0 after:-inset-y-1.5"
              onClick={handleSave}
              aria-disabled={isPending || undefined}
              data-testid="issue-title-save"
            >
              Save
            </Button>
          </div>
        ) : null}
      </div>
    </form>
  );

  const moveDialog = move ? (
    <ReassignMachineForm
      issueId={issueId}
      currentInitials={move.currentInitials}
      machines={move.machines}
      open={moveOpen}
      onOpenChange={setMoveOpen}
      returnFocusTo={() =>
        isMobile ? menuTriggerRef.current : moveButtonRef.current
      }
    />
  ) : null;

  const hasActions = canEdit || move !== undefined;

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{eyebrow}</div>
        {hasActions ? (
          <>
            {/* Mobile: both actions behind one ⋯ menu. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  ref={menuTriggerRef}
                  variant="ghost"
                  size="icon"
                  className="-my-2.5 -mr-2 size-11 shrink-0 text-muted-foreground hover:text-foreground md:hidden"
                  aria-label="Issue actions"
                  data-testid="issue-actions-menu-trigger"
                >
                  <MoreHorizontal className="size-5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onCloseAutoFocus={(event) => {
                  if (menuChoiceRef.current) {
                    event.preventDefault();
                    menuChoiceRef.current = false;
                    // The menu stays mounted beside the editor, so it hands
                    // focus to the field itself once it has closed.
                    inputRef.current?.focus();
                  }
                }}
              >
                {canEdit ? (
                  <DropdownMenuItem
                    className="min-h-11"
                    onSelect={() => {
                      menuChoiceRef.current = true;
                      setIsEditing(true);
                    }}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit title
                  </DropdownMenuItem>
                ) : null}
                {move ? (
                  <DropdownMenuItem
                    className="min-h-11"
                    onSelect={() => {
                      menuChoiceRef.current = true;
                      setMoveOpen(true);
                    }}
                    data-testid="issue-actions-menu-reassign"
                  >
                    <ArrowLeftRight className="size-4" aria-hidden="true" />
                    Move to another machine
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
      </div>

      {isEditing ? (
        editor
      ) : (
        <div className="flex items-start gap-1">
          {heading}
          {/* Desktop: Edit title and a labeled Move button (spec §4.3, §4.5). */}
          <div
            className={
              hasActions
                ? "hidden shrink-0 items-center gap-2 md:flex"
                : "hidden"
            }
          >
            {canEdit ? (
              <Button
                ref={editButtonRef}
                variant="ghost"
                size="icon"
                className="size-9 text-muted-foreground hover:text-foreground"
                onClick={() => setIsEditing(true)}
                aria-label="Edit title"
                data-testid="issue-edit-title"
              >
                <Pencil className="size-4" aria-hidden="true" />
              </Button>
            ) : null}
            {move ? (
              <Button
                ref={moveButtonRef}
                type="button"
                variant="outline"
                className="h-9 gap-2 px-3"
                onClick={() => setMoveOpen(true)}
                aria-label="Move to another machine"
                data-testid="issue-move-button"
              >
                <ArrowLeftRight className="size-4" aria-hidden="true" />
                Move
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {moveDialog}
    </>
  );
}

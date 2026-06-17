"use client";

import type React from "react";
import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  GripVertical,
  Loader2,
  MoreVertical,
  Pencil,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { usePrefersReducedMotion } from "~/hooks/use-prefers-reduced-motion";
import { cn } from "~/lib/utils";

interface SortableSectionProps {
  id: string;
  /** Whether THIS section unit is in edit mode (PP-43q3). Swaps its Edit button
   *  for a primary Save + a Cancel. Independent per section. */
  editing: boolean;
  /** Permission to edit at all. Governs whether the whole control cluster (grip,
   *  kebab, Edit) renders; read-only viewers see none of it. */
  canEdit: boolean;
  /** This section unit's Save is awaiting the server (PP-43q3 atomic commit) —
   *  disables Save/Cancel and shows a "Saving…" spinner on the Save button. */
  saving: boolean;
  /** Last save error for this unit, or null. Shown inline; the unit stays open
   *  with the typed values intact and the Save button doubles as Retry. */
  saveError: string | null;
  /** Disable "Move up" on the first section / "Move down" on the last. */
  isFirst: boolean;
  isLast: boolean;
  /** Human label for the section, used to disambiguate the several "Edit" /
   *  kebab controls for AT (e.g. "Software settings section"). */
  describe: string;
  onEdit: () => void;
  /** Commit this section unit's slice onto the committed baseline (atomic). */
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  children: React.ReactNode;
}

/**
 * One reorderable section inside a settings set. Owns the section-header control
 * cluster so the kind-specific section components (software / DIP / note / table)
 * don't repeat it:
 *  - a per-section Edit / Save+Cancel toggle (the unit's atomic commit boundary
 *    for its title + body + table edits — see SettingsTab);
 *  - a kebab (⋮): Delete section (confirmed), Move up, Move down — the non-drag
 *    reorder path that satisfies WCAG 2.2 SC 2.5.7 and is the only reorder path
 *    on mobile;
 *  - a persistent (no hover) drag grip (⋮⋮) for pointer reorder, hidden on
 *    mobile via CSS (`max-md:hidden`) — never JS width;
 *  - the faint top hairline that separates sections (the first section's
 *    hairline doubles as the header/body divider).
 *
 * The cluster is absolutely positioned over the heading row's (empty) right end,
 * so the section body never reflows between view and edit.
 */
export function SortableSection({
  id,
  editing,
  canEdit,
  saving,
  saveError,
  isFirst,
  isLast,
  describe,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onMoveUp,
  onMoveDown,
  children,
}: SortableSectionProps): React.JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  // dnd-kit applies its reorder animation via an inline `transition` style,
  // which a `motion-reduce:` class can't override — so honor the preference in
  // JS by dropping the transition entirely when reduced motion is requested.
  const prefersReducedMotion = usePrefersReducedMotion();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: prefersReducedMotion ? undefined : transition,
      }}
      className={cn(
        "border-t border-outline-variant/60",
        isDragging && "relative z-10 rounded-md bg-card shadow-lg"
      )}
    >
      {/* The grip + kebab + Edit cluster floats over the heading row's right end,
          so content never reflows between view and edit. */}
      <div className="relative">
        {canEdit && (
          <div className="absolute right-0 top-2 z-[1] flex items-center gap-1">
            {/* Persistent drag grip — desktop only (max-md:hidden). On mobile
                the kebab's Move up/down is the reorder path. */}
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              aria-label={`Drag to reorder ${describe}`}
              className="cursor-grab touch-none rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none max-md:hidden"
            >
              <GripVertical className="size-4" aria-hidden="true" />
            </button>

            {editing ? (
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-7"
                    aria-label={`Save ${describe}`}
                    disabled={saving}
                    onClick={onSave}
                  >
                    {saving ? (
                      <Loader2
                        aria-hidden="true"
                        className="animate-spin motion-reduce:animate-none"
                      />
                    ) : (
                      <Check aria-hidden="true" />
                    )}
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    aria-label={`Cancel editing ${describe}`}
                    disabled={saving}
                    onClick={onCancel}
                  >
                    Cancel
                  </Button>
                </div>
                {/* On failure the unit stays open with the typed values intact;
                    the Save button itself is the Retry. */}
                {saveError !== null && (
                  <span role="alert" className="mt-1 text-xs text-destructive">
                    {saveError}
                  </span>
                )}
              </div>
            ) : (
              // Sections use a small icon-only pencil (the full labelled Edit
              // button is reserved for the set-header unit, so the header reads
              // as the primary edit affordance and sections stay quiet). Default
              // foreground keeps it a notch more present than the muted ⋮ beside
              // it. (PP-43q3)
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`Edit ${describe}`}
                onClick={onEdit}
              >
                <Pencil className="size-4" aria-hidden="true" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground"
                  aria-label={`More options for ${describe}`}
                >
                  <MoreVertical className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={isFirst} onSelect={onMoveUp}>
                  Move up
                </DropdownMenuItem>
                <DropdownMenuItem disabled={isLast} onSelect={onMoveDown}>
                  Move down
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => {
                    setDeleteDialogOpen(true);
                  }}
                >
                  Delete section
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <div className="min-w-0">{children}</div>
      </div>

      {canEdit && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {describe}?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the section and everything in it. This can’t be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction type="button" onClick={onDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

"use client";

import type React from "react";
import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreVertical } from "lucide-react";
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
  /** Permission to edit at all. Governs whether the whole control cluster
   *  (grip, kebab) renders; read-only viewers see none of it. */
  canEdit: boolean;
  /** Disable "Move up" on the first section / "Move down" on the last. */
  isFirst: boolean;
  isLast: boolean;
  /** Human label for the section, used to disambiguate the several kebab
   *  controls for AT (e.g. "Software settings section"). */
  describe: string;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  children: React.ReactNode;
}

/**
 * One reorderable section inside a settings set. Owns the section-header
 * control cluster so the kind-specific section components (software / DIP /
 * note / table) don't repeat it:
 *  - a kebab (⋮): Delete section (confirmed), Move up, Move down — the non-
 *    drag reorder path that satisfies WCAG 2.2 SC 2.5.7 and is the only
 *    reorder path on mobile;
 *  - a persistent (no hover) drag grip (⋮⋮) for pointer reorder, hidden on
 *    mobile via CSS (`max-md:hidden`) — never JS width;
 *  - the faint top hairline that separates sections (the first section's
 *    hairline doubles as the header/body divider).
 *
 * The cluster is absolutely positioned over the heading row's (empty) right
 * end, so the section body never reflows.
 *
 * Note: in the always-live auto-save model (PP-43q3 pivot) there are NO
 * per-section Edit/Save/Cancel buttons — fields are always editable for
 * permitted users and auto-save handles persistence.
 */
export function SortableSection({
  id,
  canEdit,
  isFirst,
  isLast,
  describe,
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
      {/* The grip + kebab cluster floats over the heading row's right end,
          so content never reflows. */}
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
              // Pointer-only reorder handle: keep it OUT of the keyboard tab
              // order (dnd-kit's attributes set tabIndex=0, which made tabbing
              // between sections land on the grip and arm dnd-kit's keyboard
              // drag — confusing). Keyboard reorder is the kebab's Move up/down
              // (WCAG 2.2 SC 2.5.7), so the grip stays mouse-only. Override
              // AFTER the attribute spread so this wins.
              tabIndex={-1}
              aria-label={`Drag to reorder ${describe}`}
              className="cursor-grab touch-none rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none max-md:hidden"
            >
              <GripVertical className="size-4" aria-hidden="true" />
            </button>

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
                This removes the section and everything in it. This can't be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                type="button"
                variant="destructive"
                onClick={onDelete}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

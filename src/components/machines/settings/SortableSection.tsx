"use client";

import type React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface SortableSectionProps {
  id: string;
  /** Edit mode: surface the drag handle + section-level delete control. */
  editing: boolean;
  onDelete: () => void;
  deleteLabel: string;
  children: React.ReactNode;
}

/**
 * One reorderable section inside a settings set. Owns three shared concerns so
 * the kind-specific section components (software / DIP / note) don't repeat
 * them:
 *  - the drag handle (mouse + keyboard via dnd-kit's KeyboardSensor; only the
 *    handle starts a drag, so inline editing inside the section is unaffected);
 *  - a section-level delete;
 *  - the faint top hairline that separates sections — the first section's
 *    hairline doubles as the header/body divider.
 */
export function SortableSection({
  id,
  editing,
  onDelete,
  deleteLabel,
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

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "border-t border-outline-variant/30",
        isDragging && "relative z-10 rounded-md bg-card shadow-lg"
      )}
    >
      <div className="flex items-start gap-1">
        {editing && (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder section"
            className="mt-3 shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none"
          >
            <GripVertical className="size-4" aria-hidden="true" />
          </button>
        )}

        <div className="min-w-0 flex-1">{children}</div>

        {editing && (
          <Button
            variant="ghost"
            size="icon"
            className="mt-2 size-6 shrink-0 text-muted-foreground transition-colors hover:text-destructive focus-visible:opacity-100 motion-reduce:transition-none"
            onClick={onDelete}
            aria-label={deleteLabel}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}

"use client";

import type React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { ConfirmingDeleteButton } from "~/components/machines/settings/ConfirmingDeleteButton";
import { usePrefersReducedMotion } from "~/hooks/use-prefers-reduced-motion";
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
  // dnd-kit applies its reorder animation via an inline `transition` style,
  // which a `motion-reduce:` class can't override — so honor the preference in
  // JS by dropping the transition entirely when reduced motion is requested.
  const prefersReducedMotion = usePrefersReducedMotion();

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
      {/* No reserved gutters in either mode — the section's hanging indent
          carries the structure. While editing, the grip + delete float as a
          cluster over the heading row's (empty) right end, so content never
          reflows between modes. */}
      <div className="relative">
        {editing && (
          <div className="absolute right-0 top-2 z-[1] flex items-center gap-1">
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              aria-label="Drag to reorder section"
              className="cursor-grab touch-none rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none"
            >
              <GripVertical className="size-4" aria-hidden="true" />
            </button>
            <ConfirmingDeleteButton
              ariaLabel={deleteLabel}
              onConfirmedDelete={onDelete}
            />
          </div>
        )}

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

import type React from "react";
import { Button } from "~/components/ui/button";
import { Pencil } from "lucide-react";

/**
 * Disabled "Edit Machine" button with a visible reason label.
 *
 * Replaces the previous Tooltip-based pattern which was inaccessible on touch
 * devices (Radix tooltips do not fire on tap). The reason is now always-visible
 * text associated with the button via aria-describedby, satisfying
 * CORE-A11Y-005 and WCAG 1.4.13.
 */
export function EditButtonWithTooltip({
  reason,
}: {
  reason: string;
}): React.JSX.Element {
  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        size="sm"
        aria-disabled="true"
        aria-describedby="edit-machine-disabled-reason"
        className="w-full border-outline text-muted-foreground opacity-50 cursor-not-allowed pointer-events-none"
        data-testid="edit-machine-button-disabled"
      >
        <Pencil className="mr-2 size-4" />
        Edit Machine
      </Button>
      <p
        id="edit-machine-disabled-reason"
        className="text-center text-xs text-muted-foreground"
      >
        {reason}
      </p>
    </div>
  );
}

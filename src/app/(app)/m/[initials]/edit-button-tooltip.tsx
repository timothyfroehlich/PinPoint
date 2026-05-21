import type React from "react";
import { Button } from "~/components/ui/button";
import { Pencil } from "lucide-react";

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
        disabled
        aria-disabled="true"
        aria-describedby="edit-machine-disabled-reason"
        className="w-full border-outline text-muted-foreground"
        data-testid="edit-machine-button-disabled"
      >
        <Pencil className="mr-2 size-4" />
        Edit Machine
      </Button>
      <p
        id="edit-machine-disabled-reason"
        className="text-xs text-muted-foreground"
      >
        {reason}
      </p>
    </div>
  );
}

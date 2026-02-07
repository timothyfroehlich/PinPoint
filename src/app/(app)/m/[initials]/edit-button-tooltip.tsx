"use client";

import type React from "react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Pencil } from "lucide-react";

export function EditButtonWithTooltip({
  reason,
}: {
  reason: string;
}): React.JSX.Element {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-block w-full">
            <Button
              variant="outline"
              size="sm"
              disabled
              className="w-full border-outline text-on-surface-variant"
              data-testid="edit-machine-button-disabled"
            >
              <Pencil className="mr-2 size-4" />
              Edit Machine
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

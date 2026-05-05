"use client";

import type React from "react";
import { RelativeTime } from "~/components/issues/RelativeTime";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

interface IssueUpdatedTimestampProps {
  value: string;
  fallback: string;
}

export function IssueUpdatedTimestamp({
  value,
  fallback,
}: IssueUpdatedTimestampProps): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="cursor-help rounded-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Updated <RelativeTime value={value} fallback={fallback} />
        </span>
      </TooltipTrigger>
      <TooltipContent>{fallback}</TooltipContent>
    </Tooltip>
  );
}

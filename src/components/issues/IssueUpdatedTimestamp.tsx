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
        {/* `<button type="button">` rather than `<span tabIndex={0}>` so the
            tooltip is reachable via keyboard focus, not just hover. Browser
            button defaults are reset (`bg-transparent p-0 text-left` plus the
            arbitrary `[font:inherit]` so the parent's text-sm styling carries
            through) to preserve the original inline visual. */}
        <button
          type="button"
          aria-label={`Updated. ${fallback}`}
          className="cursor-help rounded-sm bg-transparent p-0 text-left [font:inherit] text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Updated <RelativeTime value={value} fallback={fallback} />
        </button>
      </TooltipTrigger>
      <TooltipContent>{fallback}</TooltipContent>
    </Tooltip>
  );
}

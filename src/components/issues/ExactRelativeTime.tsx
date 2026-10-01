"use client";

import type React from "react";
import { formatDateTime } from "~/lib/dates";
import { RelativeTime } from "~/components/issues/RelativeTime";
import { useRelativeNow } from "~/components/issues/RelativeTimeProvider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

interface ExactRelativeTimeProps {
  value: Date | string;
  /**
   * Absolute label computed on the server, used before hydration and as the
   * accessible name. Without it the name is a static "Show exact time" until
   * the client ticker mounts, because `formatDateTime` resolves the runtime's
   * own zone and React never patches a mismatched attribute (see
   * `RelativeTime`).
   */
  fallback?: string;
  /** Visible text before the relative time, e.g. "reported". */
  prefix?: string;
  className?: string;
}

/**
 * A relative time ("3 minutes ago") whose exact time is one hover or focus
 * away. A `<button>` rather than a focusable span so the tooltip is reachable
 * by keyboard; browser button styling is reset so it reads as inline text.
 */
export function ExactRelativeTime({
  value,
  fallback,
  prefix,
  className,
}: ExactRelativeTimeProps): React.JSX.Element {
  // Subscribing here, not only inside `<RelativeTime>`, re-renders the
  // button's `aria-label` once the client has mounted.
  const now = useRelativeNow();
  const exact =
    fallback ?? (now === null ? "Show exact time" : formatDateTime(value));

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={prefix ? `${prefix} ${exact}` : exact}
          className={cn(
            "cursor-help rounded-sm bg-transparent p-0 text-left [font:inherit] text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            className
          )}
        >
          {prefix ? `${prefix} ` : null}
          <RelativeTime value={value} {...(fallback ? { fallback } : {})} />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {fallback ?? (now === null ? null : formatDateTime(value))}
      </TooltipContent>
    </Tooltip>
  );
}

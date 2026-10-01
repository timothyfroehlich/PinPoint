"use client";

import type React from "react";
import { useId, useRef, useState } from "react";
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
   * Visible label computed on the server, shown until the client ticker
   * mounts (and used as the exact time until then). Pass
   * `formatDateTime(...)` from a Server Component so the string is built once,
   * in one zone. After mount the exact time is always formatted on the client,
   * in the viewer's zone — a server-built string is in the server's zone (UTC
   * on Vercel).
   */
  fallback?: string;
  /** Visible text before the relative time, e.g. "reported". */
  prefix?: string;
  className?: string;
}

/**
 * A relative time ("3 minutes ago") whose exact time is one hover, focus, or
 * tap away. A `<button>` rather than a focusable span so the exact time is
 * reachable by keyboard and touch; browser button styling is reset so it
 * reads as inline text.
 *
 * - The visible text is the accessible name (WCAG 2.5.3); the exact time is
 *   the description, from a hidden element the button points at.
 * - No attribute in the server HTML depends on the zone (PP-h490): React never
 *   patches a mismatched attribute on hydration. `dateTime` is ISO.
 * - On phones the hit area grows to 44px tall without moving the layout, and
 *   a tap toggles the exact time (a tooltip otherwise opens only on hover).
 */
export function ExactRelativeTime({
  value,
  fallback,
  prefix,
  className,
}: ExactRelativeTimeProps): React.JSX.Element {
  const now = useRelativeNow();
  const descriptionId = useId();
  const [open, setOpen] = useState(false);
  // Radix closes an open tooltip on pointerdown, before the click lands.
  // Remember whether it was open so a tap on an open tooltip closes it.
  const openAtPointerDownRef = useRef<boolean | null>(null);

  const date = typeof value === "string" ? new Date(value) : value;
  const iso = Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  const exact =
    now === null || iso === undefined ? (fallback ?? "") : formatDateTime(date);

  return (
    <>
      <Tooltip open={open && exact !== ""} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-describedby={descriptionId}
            onPointerDown={() => {
              openAtPointerDownRef.current = open;
            }}
            onClick={(event) => {
              // Keeps Radix's own click handler from closing it again.
              event.preventDefault();
              const wasOpen = openAtPointerDownRef.current ?? open;
              openAtPointerDownRef.current = null;
              setOpen(!wasOpen);
            }}
            className={cn(
              "relative cursor-help rounded-sm bg-transparent p-0 text-left [font:inherit] text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              // 44px touch target on phones without changing the line box.
              "max-md:after:absolute max-md:after:-inset-x-1 max-md:after:-inset-y-3",
              className
            )}
          >
            {prefix ? `${prefix} ` : null}
            <time dateTime={iso}>
              <RelativeTime value={value} {...(fallback ? { fallback } : {})} />
            </time>
          </button>
        </TooltipTrigger>
        <TooltipContent>{exact}</TooltipContent>
      </Tooltip>
      <span id={descriptionId} hidden>
        {exact}
      </span>
    </>
  );
}

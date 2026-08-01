"use client";

import type React from "react";
import { cn } from "~/lib/utils";
import { IssueBadge } from "~/components/issues/IssueBadge";
import type { Issue } from "~/lib/types";

interface IssueBadgeGridProps {
  issue: Pick<Issue, "status" | "severity" | "priority" | "frequency">;
  variant?: "normal" | "strip";
  size?: "normal" | "lg";
  className?: string;
  showPriority?: boolean; // Default true, but maybe hide for guests externally
  /**
   * Strip only: collapse Priority + Frequency below the `@md/card-header`
   * container tier so a narrow row keeps only Status + Severity and never
   * wraps to a second line (design §4, PP-dnk8). Needs a `@container/card-header`
   * ancestor (the shadcn `CardHeader` provides it).
   */
  capNarrow?: boolean;
}

export function IssueBadgeGrid({
  issue,
  variant = "normal",
  size = "normal",
  className,
  showPriority = true,
  capNarrow = false,
}: IssueBadgeGridProps): React.JSX.Element {
  if (variant === "strip") {
    // `contents` keeps the badge a direct flex item (gaps intact) when shown;
    // `hidden` removes it below the tier when capped.
    const capClass = capNarrow ? "hidden @md/card-header:contents" : "contents";
    return (
      <div
        className={cn("flex flex-wrap gap-2", className)}
        role="group"
        aria-label="Issue metadata"
      >
        <IssueBadge
          type="status"
          value={issue.status}
          variant={variant}
          size={size}
        />
        {showPriority && (
          <span className={capClass}>
            <IssueBadge
              type="priority"
              value={issue.priority}
              variant={variant}
              size={size}
            />
          </span>
        )}
        <IssueBadge
          type="severity"
          value={issue.severity}
          variant={variant}
          size={size}
        />
        <span className={capClass}>
          <IssueBadge
            type="frequency"
            value={issue.frequency}
            variant={variant}
            size={size}
          />
        </span>
      </div>
    );
  }

  // A fixed 2-col grid (never a self-measuring `@container`): the badge column
  // is an auto-width `shrink-0` flex item in IssueCard's/IssueRow's row layout,
  // and `container-type: inline-size` would zero its intrinsic width, collapsing
  // the box so the fixed-width pills overflow and get clipped (PP-ytao).
  return (
    <div
      className={cn("grid grid-cols-2 gap-2", className)}
      role="group"
      aria-label="Issue metadata"
    >
      <IssueBadge
        type="status"
        value={issue.status}
        variant={variant}
        size={size}
      />
      {showPriority && (
        <IssueBadge
          type="priority"
          value={issue.priority}
          variant={variant}
          size={size}
        />
      )}
      <IssueBadge
        type="severity"
        value={issue.severity}
        variant={variant}
        size={size}
      />
      <IssueBadge
        type="frequency"
        value={issue.frequency}
        variant={variant}
        size={size}
      />
    </div>
  );
}

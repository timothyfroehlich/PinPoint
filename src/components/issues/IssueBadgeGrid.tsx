"use client";

import type React from "react";
import { cn } from "~/lib/utils";
import { IssueBadge } from "~/components/issues/IssueBadge";
import type { Issue } from "~/lib/types";

interface IssueBadgeGridProps {
  issue: Pick<Issue, "status" | "severity" | "priority" | "consistency">;
  variant?: "normal" | "strip";
  size?: "normal" | "lg";
  className?: string;
  showPriority?: boolean; // Default true, but maybe hide for guests externally
}

export function IssueBadgeGrid({
  issue,
  variant = "normal",
  size = "normal",
  className,
  showPriority = true,
}: IssueBadgeGridProps): React.JSX.Element {
  const gridClass = cn(
    variant === "strip"
      ? "flex flex-wrap gap-2"
      : "grid grid-cols-1 sm:grid-cols-2 gap-2",
    className
  );

  return (
    <div className={gridClass} role="group" aria-label="Issue metadata">
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
        type="consistency"
        value={issue.consistency}
        variant={variant}
        size={size}
      />
    </div>
  );
}

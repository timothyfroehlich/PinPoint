import type React from "react";

import { cn } from "~/lib/utils";

/** The lineup page's tag tones (lineup spec §5, v3 design). */
export type LineupTone =
  "destructive" | "success" | "warning" | "secondary" | "note";

export const LINEUP_TONE: Record<LineupTone, string> = {
  destructive:
    "border-error-container bg-error-container/40 text-on-error-container",
  success:
    "border-success-container bg-success-container/40 text-on-success-container",
  warning:
    "border-warning-container bg-warning-container/40 text-on-warning-container",
  secondary:
    "border-secondary-container bg-secondary-container/40 text-on-secondary-container",
  note: "border-outline-variant bg-transparent text-foreground",
};

/** A row's small status tag: To add, To remove, Alert, and the like. */
export function LineupTag({
  label,
  tone,
  className,
}: {
  label: string;
  tone: LineupTone;
  className?: string;
}): React.JSX.Element {
  return (
    <span
      className={cn(
        "mr-2 inline-flex h-5 shrink-0 items-center rounded-[5px] border px-1.5 text-[11px] font-bold whitespace-nowrap",
        LINEUP_TONE[tone],
        className
      )}
    >
      {label}
    </span>
  );
}

import type React from "react";

/** Marks an exclusive tag type: a machine holds at most one of its tags (spec 11.5). */
export function ExclusiveBadge(): React.JSX.Element {
  return (
    <span className="rounded-full border border-outline-variant px-2 py-px text-[11px] font-semibold normal-case tracking-normal text-muted-foreground">
      One per machine
    </span>
  );
}

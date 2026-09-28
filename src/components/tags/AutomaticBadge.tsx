import type React from "react";

/** Marks a tag type whose membership PinPoint derives (spec 7.8). */
export function AutomaticBadge(): React.JSX.Element {
  return (
    <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-on-secondary-container">
      Automatic
    </span>
  );
}

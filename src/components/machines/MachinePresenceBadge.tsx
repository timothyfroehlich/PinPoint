import type React from "react";
import { Badge } from "~/components/ui/badge";
import {
  getMachinePresenceStyles,
  getMachinePresenceLabel,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";
import { cn } from "~/lib/utils";

interface MachinePresenceBadgeProps {
  status: MachinePresenceStatus;
  /**
   * xs — info-grid / very dense contexts (px-2 py-0.5 text-[10px])
   * sm — card listings and dense rows (px-2.5 py-0.5 text-xs)
   * md — page headers and prominent placements (px-3 py-1 text-sm)
   */
  size?: "xs" | "sm" | "md";
  className?: string;
  "data-testid"?: string;
}

const sizeClasses: Record<"xs" | "sm" | "md", string> = {
  xs: "px-2 py-0.5 text-[10px] font-bold",
  sm: "px-2.5 py-0.5 text-xs font-semibold",
  md: "px-3 py-1 text-sm font-semibold",
};

/**
 * MachinePresenceBadge — physical location / presence status for a machine.
 *
 * Encapsulates the `getMachinePresenceStyles` helper + canonical badge padding
 * so call sites only pass `status` (and optionally `size`).
 *
 * Only render this when `!isOnTheFloor(status)` — "on the floor" is the
 * default state and typically not badged.
 *
 * Design bible §18: badge tokens come from the MD colour system defined in
 * globals.css (`bg-tertiary-container`, `bg-secondary-container`, etc.).
 */
export function MachinePresenceBadge({
  status,
  size = "md",
  className,
  "data-testid": testId,
}: MachinePresenceBadgeProps): React.JSX.Element {
  return (
    <Badge
      data-testid={testId}
      className={cn(
        getMachinePresenceStyles(status),
        "border",
        sizeClasses[size],
        className
      )}
    >
      {getMachinePresenceLabel(status)}
    </Badge>
  );
}

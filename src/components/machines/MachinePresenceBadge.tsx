import type React from "react";
import { Badge } from "~/components/ui/badge";
import {
  getMachinePresenceStyles,
  getMachinePresenceLabel,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";
import { cn } from "~/lib/utils";
import { badgeSizeClasses, type BadgeSize } from "./badge-size";

interface MachinePresenceBadgeProps {
  status: MachinePresenceStatus;
  size?: BadgeSize;
  className?: string;
  "data-testid"?: string;
}

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
        badgeSizeClasses[size],
        className
      )}
    >
      {getMachinePresenceLabel(status)}
    </Badge>
  );
}

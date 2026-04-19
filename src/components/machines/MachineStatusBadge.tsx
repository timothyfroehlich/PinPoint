import type React from "react";
import { Badge } from "~/components/ui/badge";
import {
  getMachineStatusStyles,
  getMachineStatusLabel,
  type MachineStatus,
} from "~/lib/machines/status";
import { cn } from "~/lib/utils";
import { badgeSizeClasses, type BadgeSize } from "./badge-size";

interface MachineStatusBadgeProps {
  status: MachineStatus;
  size?: BadgeSize;
  className?: string;
  "data-testid"?: string;
}

/**
 * MachineStatusBadge — derived health status for a machine.
 *
 * Encapsulates the `getMachineStatusStyles` helper + canonical badge padding
 * so call sites only pass `status` (and optionally `size`).
 *
 * Design bible §18: badge tokens come from the MD colour system defined in
 * globals.css (`bg-success-container`, `bg-warning-container`, etc.).
 */
export function MachineStatusBadge({
  status,
  size = "md",
  className,
  "data-testid": testId,
}: MachineStatusBadgeProps): React.JSX.Element {
  return (
    <Badge
      data-testid={testId}
      className={cn(
        getMachineStatusStyles(status),
        "border",
        badgeSizeClasses[size],
        className
      )}
    >
      {getMachineStatusLabel(status)}
    </Badge>
  );
}

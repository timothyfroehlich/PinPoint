import type React from "react";
import { Badge } from "~/components/ui/badge";
import {
  getMachineStatusStyles,
  getMachineStatusLabel,
  type MachineStatus,
} from "~/lib/machines/status";
import { cn } from "~/lib/utils";

interface MachineStatusBadgeProps {
  status: MachineStatus;
  /**
   * xs — info-grid / very dense contexts (px-2 py-0.5 text-[10px])
   * sm — card listings and dense rows (px-2.5 py-0.5 text-xs)
   * md — page headers and prominent placements (px-3 py-1 text-sm)
   */
  size?: "xs" | "sm" | "md";
  className?: string;
  /** Override the label. Defaults to the canonical status label. */
  "data-testid"?: string;
}

const sizeClasses: Record<"xs" | "sm" | "md", string> = {
  xs: "px-2 py-0.5 text-[10px] font-bold",
  sm: "px-2.5 py-0.5 text-xs font-semibold",
  md: "px-3 py-1 text-sm font-semibold",
};

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
        sizeClasses[size],
        className
      )}
    >
      {getMachineStatusLabel(status)}
    </Badge>
  );
}

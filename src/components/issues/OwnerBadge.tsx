import type React from "react";
import { Crown } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface OwnerBadgeProps {
  className?: string;
  size?: "sm" | "default";
}

/**
 * OwnerBadge Component
 *
 * Displays a badge indicating that a user is the machine owner.
 * Used in issue details to highlight the owner in the timeline,
 * comments, and reporter field.
 */
export function OwnerBadge({
  className,
  size = "default",
}: OwnerBadgeProps): React.JSX.Element {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 font-semibold uppercase tracking-wide",
        size === "sm" && "text-[10px] px-1.5 py-0",
        className
      )}
      data-testid="owner-badge"
    >
      <Crown className="size-3" />
      Game Owner
    </Badge>
  );
}

import type React from "react";
import { Crown } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface OwnerBadgeProps {
  className?: string;
  size?: "sm" | "default";
  /**
   * Visual weight.
   *  · `solid` (default) — the filled pill used on issue pages, where it sits
   *    beside body text and is meant to catch the eye.
   *  · `inline` — crown + label only, no fill. For dense muted metadata lines
   *    (the machine-settings audit line), where a filled pill shouts over the
   *    12px copy it annotates.
   */
  tone?: "solid" | "inline";
}

/**
 * OwnerBadge Component
 *
 * Displays a badge indicating that a user is the machine owner.
 * Used in issue details to highlight the owner in the timeline,
 * comments, and reporter field, and — in its `inline` tone — on the
 * machine-settings audit line.
 */
export function OwnerBadge({
  className,
  size = "default",
  tone = "solid",
}: OwnerBadgeProps): React.JSX.Element {
  if (tone === "inline") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 align-baseline text-secondary",
          className
        )}
        data-testid="owner-badge"
      >
        <Crown className="size-3 shrink-0" aria-hidden="true" />
        Game Owner
      </span>
    );
  }

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
      {/* sm-structural-allow: text abbreviation show/hide at viewport width, not layout structure */}
      <span className="hidden sm:inline">Game Owner</span>
      {/* sm-structural-allow: text abbreviation show/hide at viewport width, not layout structure */}
      <span className="sm:hidden">Owner</span>
    </Badge>
  );
}

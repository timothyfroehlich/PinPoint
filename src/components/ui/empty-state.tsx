import type React from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "card" | "bare";
  /**
   * `"compact"` for an empty section inside a denser page (a sidebar list, an
   * activity feed): a smaller icon, tighter padding, no circle.
   */
  size?: "default" | "compact";
}

/**
 * EmptyState — canonical pattern for zero-item lists and sections.
 *
 * Design bible §13: icon-in-circle + heading + optional body + optional CTA.
 * - `variant="card"` (default) wraps content in a <Card> with py-12 text-center.
 * - `variant="bare"` renders the content directly — use when the parent is already a Card.
 * - `size="compact"` shrinks the icon and padding for an empty section that
 *   sits among other content.
 *
 * Rules:
 * - Icon must be a single lucide-react icon rendered at size-12 in a muted
 *   circle (size-5, no circle, when compact).
 * - Keep title under 40 characters. Use description for more detail.
 * - Provide an action only if the user can take a productive next step.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "card",
  size = "default",
}: EmptyStateProps): React.JSX.Element {
  const compact = size === "compact";
  const content = (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "px-4 py-5" : "px-6 py-12"
      )}
    >
      {compact ? (
        <Icon
          className="mb-2 size-5 text-muted-foreground"
          aria-hidden="true"
        />
      ) : (
        <div className="mb-4 inline-flex size-24 items-center justify-center rounded-full bg-muted">
          <Icon className="size-12 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      <p
        className={cn(
          "font-semibold text-balance text-foreground",
          compact ? "mt-0 text-sm" : "text-base"
        )}
      >
        {title}
      </p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-pretty text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? (
        <div className={compact ? "mt-3" : "mt-4"}>{action}</div>
      ) : null}
    </div>
  );

  if (variant === "bare") {
    return content;
  }

  return (
    <Card
      className={cn(compact && "rounded-lg border-outline-variant shadow-none")}
    >
      {content}
    </Card>
  );
}

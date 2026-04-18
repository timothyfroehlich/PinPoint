import type React from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "~/components/ui/card";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "card" | "bare";
}

/**
 * EmptyState — canonical pattern for zero-item lists and sections.
 *
 * Design bible §13: icon-in-circle + heading + optional body + optional CTA.
 * - `variant="card"` (default) wraps content in a <Card> with py-12 text-center.
 * - `variant="bare"` renders the content directly — use when the parent is already a Card.
 *
 * Rules:
 * - Icon must be a single lucide-react icon rendered at size-12 in a muted circle.
 * - Keep title under 40 characters. Use description for more detail.
 * - Provide an action only if the user can take a productive next step.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "card",
}: EmptyStateProps): React.JSX.Element {
  const content = (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 inline-flex size-24 items-center justify-center rounded-full bg-muted">
        <Icon className="size-12 text-muted-foreground" />
      </div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );

  if (variant === "bare") {
    return content;
  }

  return <Card>{content}</Card>;
}

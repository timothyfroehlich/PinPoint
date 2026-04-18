import type React from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import { Button } from "~/components/ui/button";

interface MachineEmptyStateProps {
  machineInitials: string;
}

/**
 * MachineEmptyState — pre-configured empty state for the "game is operational" case.
 *
 * Shown on machine detail pages when there are no open issues.
 * Thin wrapper around <EmptyState> with icon/copy pre-set.
 */
export function MachineEmptyState({
  machineInitials,
}: MachineEmptyStateProps): React.JSX.Element {
  return (
    <EmptyState
      variant="bare"
      icon={CheckCircle2}
      title="No open issues"
      description="The game is operational. Great job!"
      action={
        <Button variant="outline" size="sm" asChild>
          <Link
            href={`/report?machine=${machineInitials}`}
            aria-label="Report a new issue"
          >
            Report an Issue
          </Link>
        </Button>
      }
    />
  );
}

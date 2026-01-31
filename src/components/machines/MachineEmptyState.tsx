import type React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

interface MachineEmptyStateProps {
  machineInitials: string;
}

export function MachineEmptyState({
  machineInitials,
}: MachineEmptyStateProps): React.JSX.Element {
  return (
    <div className="py-16 text-center">
      <Link
        href={`/report?machine=${machineInitials}`}
        className="group inline-flex flex-col items-center"
        aria-label="Report a new issue"
      >
        <div className="inline-flex size-12 items-center justify-center rounded-full bg-surface-variant mb-4 group-hover:bg-primary/10 transition-colors duration-200">
          <Plus className="size-6 text-on-surface-variant group-hover:text-primary transition-colors duration-200" />
        </div>
        <p className="text-lg font-medium text-on-surface mb-1 group-hover:text-primary transition-colors duration-200">
          No open issues
        </p>
      </Link>
      <p className="text-sm text-on-surface-variant mt-1">
        The game is operational. Great job!
      </p>
    </div>
  );
}

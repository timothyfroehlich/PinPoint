/**
 * Machines Page Error Boundary
 * Handles errors in machine management functionality
 * Phase 4C: Medium Priority Error Handling
 */

"use client";

import { ErrorBoundaryCard } from "~/components/ui/error-boundary-card";
import { errorConfigs } from "~/lib/errors/error-configs";

interface MachinesErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary for machines page - machine management functionality
 * Provides context-specific error handling for machine inventory
 */
export default function MachinesError({ error, reset }: MachinesErrorProps): React.JSX.Element {
  const config = errorConfigs.machines(reset);

  return <ErrorBoundaryCard error={error} reset={reset} config={config} />;
}

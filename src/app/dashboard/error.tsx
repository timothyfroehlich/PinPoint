/**
 * Dashboard Page Error Boundary
 * Handles errors in the main dashboard entry point
 * Phase 4C: Critical Route Error Handling
 */

"use client";

import { ErrorBoundaryCard } from "~/components/ui/error-boundary-card";
import { errorConfigs } from "~/lib/errors/error-configs";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary for dashboard page - main application entry point
 * Provides context-specific error handling for the primary user interface
 */
export default function DashboardError({
  error,
  reset,
}: DashboardErrorProps): JSX.Element {
  const config = errorConfigs.dashboard(reset);

  return <ErrorBoundaryCard error={error} reset={reset} config={config} />;
}

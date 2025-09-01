/**
 * Issues Page Error Boundary
 * Handles errors in the issue tracking system
 * Phase 4C: Critical Route Error Handling
 */

"use client";

import { ErrorBoundaryCard } from "~/components/ui/error-boundary-card";
import { errorConfigs } from "~/lib/errors/error-configs";

interface IssuesErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary for the issues page - core PinPoint functionality
 * Provides context-specific error handling for issue management
 */
export default function IssuesError({ error, reset }: IssuesErrorProps) {
  const config = errorConfigs.issues(reset);

  return <ErrorBoundaryCard error={error} reset={reset} config={config} />;
}

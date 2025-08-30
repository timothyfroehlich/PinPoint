/**
 * Individual Issue Page Error Boundary
 * Handles errors on specific issue detail pages
 * Phase 4C: Medium Priority Error Handling
 */

"use client";

import { ErrorBoundaryCard } from "~/components/ui/error-boundary-card";
import { errorConfigs } from "~/lib/errors/error-configs";

interface IssueDetailErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary for individual issue detail pages
 * Provides context-specific error handling for single issue views
 * Includes navigation back to issues list
 */
export default function IssueDetailError({ error, reset }: IssueDetailErrorProps) {
  const config = errorConfigs.issueDetail(reset);

  return (
    <ErrorBoundaryCard
      error={error}
      reset={reset}
      config={config}
    />
  );
}
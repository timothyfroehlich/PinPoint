"use client";

import type React from "react";

import { SegmentErrorBoundary } from "~/components/errors/SegmentErrorBoundary";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Issues segment error boundary.
 *
 * Catches unhandled errors within the issues section (issue list, issue
 * detail, report form). Provides a recovery path back to the issue list.
 */
export default function IssuesErrorPage({
  error,
  reset,
}: ErrorPageProps): React.JSX.Element {
  return (
    <SegmentErrorBoundary
      error={error}
      reset={reset}
      segment="issues"
      context="loading issues"
      backLabel="Back to Issues"
      backHref="/issues"
    />
  );
}

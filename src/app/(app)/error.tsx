"use client";

import type React from "react";

import { SegmentErrorBoundary } from "~/components/errors/SegmentErrorBoundary";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * App segment error boundary.
 *
 * Catches unhandled errors within the authenticated app shell (dashboard,
 * issues, machines, settings, admin, etc.) before they bubble to the root
 * boundary. Provides a recovery path back to the dashboard.
 */
export default function AppErrorPage({
  error,
  reset,
}: ErrorPageProps): React.JSX.Element {
  return (
    <SegmentErrorBoundary
      error={error}
      reset={reset}
      segment="app"
      context="loading the page"
      backLabel="Back to Dashboard"
      backHref="/dashboard"
    />
  );
}

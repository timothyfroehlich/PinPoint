"use client";

import type React from "react";

import { SegmentErrorBoundary } from "~/components/errors/SegmentErrorBoundary";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Admin segment error boundary.
 *
 * Catches unhandled errors within the admin section (user management,
 * integrations). Provides a recovery path back to the admin dashboard.
 */
export default function AdminErrorPage({
  error,
  reset,
}: ErrorPageProps): React.JSX.Element {
  return (
    <SegmentErrorBoundary
      error={error}
      reset={reset}
      segment="admin"
      context="loading admin"
      backLabel="Back to Admin"
      backHref="/admin"
    />
  );
}

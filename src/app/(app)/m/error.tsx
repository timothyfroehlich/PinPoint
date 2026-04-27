"use client";

import type React from "react";

import { SegmentErrorBoundary } from "~/components/errors/SegmentErrorBoundary";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Machines segment error boundary.
 *
 * Catches unhandled errors within the machines section (machine list, machine
 * detail, new machine form). Provides a recovery path back to the machine list.
 */
export default function MachinesErrorPage({
  error,
  reset,
}: ErrorPageProps): React.JSX.Element {
  return (
    <SegmentErrorBoundary
      error={error}
      reset={reset}
      segment="machines"
      context="loading machines"
      backLabel="Back to Machines"
      backHref="/m"
    />
  );
}

"use client";

import type React from "react";

import { SegmentErrorBoundary } from "~/components/errors/SegmentErrorBoundary";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Site segment error boundary.
 *
 * Catches unhandled errors within public site pages (about, help, privacy,
 * terms, changelog). Provides a recovery path back to the home page.
 */
export default function SiteErrorPage({
  error,
  reset,
}: ErrorPageProps): React.JSX.Element {
  return (
    <SegmentErrorBoundary
      error={error}
      reset={reset}
      segment="site"
      context="loading this page"
      backLabel="Back to Home"
      backHref="/"
    />
  );
}

"use client";

import type React from "react";

import { SegmentErrorBoundary } from "~/components/errors/SegmentErrorBoundary";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Settings segment error boundary.
 *
 * Catches unhandled errors within the settings section (profile, account,
 * notifications, connected accounts). Provides a recovery path back to
 * settings.
 */
export default function SettingsErrorPage({
  error,
  reset,
}: ErrorPageProps): React.JSX.Element {
  return (
    <SegmentErrorBoundary
      error={error}
      reset={reset}
      segment="settings"
      context="loading settings"
      backLabel="Back to Settings"
      backHref="/settings"
    />
  );
}

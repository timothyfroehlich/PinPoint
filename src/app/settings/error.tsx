/**
 * Settings Page Error Boundary
 * Handles errors in administrative functionality
 * Phase 4C: Critical Route Error Handling
 */

"use client";

import { ErrorBoundaryCard } from "~/components/ui/error-boundary-card";
import { errorConfigs } from "~/lib/errors/error-configs";

interface SettingsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary for settings pages - administrative functionality
 * Provides context-specific error handling for organization management
 */
export default function SettingsError({ error, reset }: SettingsErrorProps) {
  const config = errorConfigs.settings(reset);

  return (
    <ErrorBoundaryCard
      error={error}
      reset={reset}
      config={config}
    />
  );
}
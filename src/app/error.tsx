/**
 * Global Application Error Boundary
 * Catches all unhandled errors in the PinPoint application
 * Phase 4C: Comprehensive Error Handling
 */

"use client";

import { ErrorBoundaryCard } from "~/components/ui/error-boundary-card";
import { getErrorConfig, detectErrorType } from "~/lib/errors/error-configs";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global error boundary for the entire PinPoint application
 * Provides fallback UI when any unhandled error occurs
 * Uses automatic error type detection for appropriate messaging
 */
export default function GlobalError({ error, reset }: GlobalErrorProps): React.JSX.Element {
  // Automatically detect error type based on error message
  const errorType = detectErrorType(error);
  const config = getErrorConfig(errorType, reset);

  return (
    <html>
      <body>
        <ErrorBoundaryCard error={error} reset={reset} config={config} />
      </body>
    </html>
  );
}

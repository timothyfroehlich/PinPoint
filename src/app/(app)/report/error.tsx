"use client";

import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useEffect } from "react";

import { Button } from "~/components/ui/button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Report segment error boundary.
 *
 * Shown when the report form's server action throws an unhandled error (e.g. a
 * 504 timeout or unexpected server crash). The localStorage draft is preserved
 * by the form's save-effect (which only clears on state.success), so the user
 * can return to /report and pick up where they left off.
 */
export default function ReportErrorPage({
  error,
  reset,
}: ErrorPageProps): React.JSX.Element {
  useEffect(() => {
    Sentry.captureException(error, {
      contexts: {
        pinpoint: {
          segment: "report",
          digest: error.digest,
        },
      },
    });

    if (process.env.NODE_ENV !== "production") {
      console.error(`Unhandled error in segment "report":`, error);
    } else if (error.digest) {
      console.error(
        `Unhandled error in segment "report" (digest only):`,
        error.digest
      );
    } else {
      console.error(
        `Unhandled error in segment "report" (no digest available)`
      );
    }
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
      <div className="text-center">
        <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle
            className="size-8 text-destructive"
            aria-hidden="true"
          />
        </div>
        <h2 className="text-xl font-semibold text-balance">
          Your report could not be saved
        </h2>
        <p className="mt-2 max-w-sm text-pretty text-muted-foreground">
          Your draft has been kept. Please try again.
        </p>
        {/* sm-structural-allow: standalone full-width error boundary, viewport breakpoint is correct */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button onClick={reset}>Try Again</Button>
          <Button variant="outline" asChild>
            <Link href="/report">Back to Report Form</Link>
          </Button>
        </div>
        {error.digest && (
          <p className="mt-8 text-xs text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}

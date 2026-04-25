"use client";

import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useEffect } from "react";

import { Button } from "~/components/ui/button";

interface SegmentErrorBoundaryProps {
  /** The error passed from Next.js error boundary */
  error: Error & { digest?: string };
  /** The reset function passed from Next.js error boundary */
  reset: () => void;
  /** Sentry segment label, e.g. "app", "issues", "machines" */
  segment: string;
  /** User-facing description of what failed, e.g. "loading machines" */
  context: string;
  /** Link label for the recovery navigation, e.g. "Back to Machines" */
  backLabel: string;
  /** URL for the recovery navigation link, e.g. "/m" */
  backHref: string;
}

/**
 * Shared error boundary UI for per-segment error.tsx files.
 *
 * Each segment error.tsx wraps this with its own segment/context/backLabel/backHref.
 * Captures to Sentry via useEffect (required — error.tsx is always a Client Component).
 */
export function SegmentErrorBoundary({
  error,
  reset,
  segment,
  context,
  backLabel,
  backHref,
}: SegmentErrorBoundaryProps): React.JSX.Element {
  useEffect(() => {
    Sentry.captureException(error, {
      contexts: {
        pinpoint: {
          segment,
          digest: error.digest,
        },
      },
    });

    // Log full error details only in development to avoid leaking stack traces
    // in production DevTools. In production, log digest only for correlation.
    if (process.env.NODE_ENV !== "production") {
      console.error(`Unhandled error in segment "${segment}":`, error);
    } else if (error.digest) {
      console.error(
        `Unhandled error in segment "${segment}" (digest only):`,
        error.digest
      );
    }
  }, [error, segment]);

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
          Something went wrong {context}
        </h2>
        <p className="mt-2 max-w-sm text-pretty text-muted-foreground">
          An unexpected error occurred. You can try again or navigate away to
          recover.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button onClick={reset}>Try Again</Button>
          <Button variant="outline" asChild>
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        </div>
        {error.digest && (
          <p className="mt-8 text-xs text-muted-foreground/60">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import type React from "react";
import { useEffect } from "react";

import { Button } from "~/components/ui/button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root error boundary for the application.
 *
 * Catches unhandled errors and displays a user-friendly page
 * instead of a blank screen or the Next.js default error.
 */
export default function ErrorPage({
  error,
  reset,
}: ErrorPageProps): React.JSX.Element {
  useEffect(() => {
    // Capture to Sentry (matches global-error.tsx pattern)
    Sentry.captureException(error);

    // Log full error details only in development to avoid leaking stack traces
    // in production DevTools. In production, log digest only for correlation.
    if (process.env.NODE_ENV !== "production") {
      console.error("Unhandled error:", error);
    } else if (error.digest) {
      console.error("Unhandled error (digest only):", error.digest);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-muted-foreground/20">500</h1>
        <h2 className="mt-4 text-2xl font-semibold">Something went wrong</h2>
        <p className="mt-2 text-muted-foreground">
          An unexpected error occurred. Please try again or return to the home
          page.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button onClick={reset}>Try Again</Button>
          <Button variant="outline" asChild>
            <Link href="/">Go Home</Link>
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

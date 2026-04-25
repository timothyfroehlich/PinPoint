"use client";

import type React from "react";

import { SegmentErrorBoundary } from "~/components/errors/SegmentErrorBoundary";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Auth segment error boundary.
 *
 * Catches unhandled errors within the authentication flow (login, signup,
 * forgot password, reset password). Provides a recovery path back to login.
 */
export default function AuthErrorPage({
  error,
  reset,
}: ErrorPageProps): React.JSX.Element {
  return (
    <SegmentErrorBoundary
      error={error}
      reset={reset}
      segment="auth"
      context="during sign in"
      backLabel="Back to Login"
      backHref="/login"
    />
  );
}

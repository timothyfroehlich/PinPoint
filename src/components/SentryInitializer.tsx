"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

import {
  SENTRY_PRIVACY_OPTIONS,
  sentryEnvironmentOption,
} from "~/lib/observability/sentry-policy";

export function SentryInitializer(): null {
  useEffect(() => {
    if (Sentry.isInitialized()) {
      return;
    }

    // Manually initialize Sentry on the client to ensure the Feedback widget works
    // and to bypass potential bundler/auto-injection issues.
    Sentry.init({
      ...(process.env["NEXT_PUBLIC_SENTRY_DSN"] && {
        dsn: process.env["NEXT_PUBLIC_SENTRY_DSN"],
      }),
      tracesSampleRate: 0.1, // Sample 10% of transactions in production
      ...sentryEnvironmentOption(process.env["NEXT_PUBLIC_VERCEL_ENV"]),
      ...SENTRY_PRIVACY_OPTIONS,
      integrations: [
        Sentry.feedbackIntegration({
          colorScheme: "system",
          autoInject: false,
        }),
      ],
    });
  }, []);

  return null;
}

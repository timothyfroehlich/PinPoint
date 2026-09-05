"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

import { SENTRY_PRIVACY_OPTIONS } from "~/lib/observability/sentry-policy";

export function SentryInitializer(): null {
  useEffect(() => {
    // Manually initialize Sentry on the client to ensure the Feedback widget works
    // and to bypass potential bundler/auto-injection issues.
    Sentry.init({
      ...(process.env["NEXT_PUBLIC_SENTRY_DSN"] && {
        dsn: process.env["NEXT_PUBLIC_SENTRY_DSN"],
      }),
      tracesSampleRate: 0.1, // Sample 10% of transactions in production
      enableLogs: true, // Opens Sentry's Logs ingestion channel; emitter wiring is PP-2ta0
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

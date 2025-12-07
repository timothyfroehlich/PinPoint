"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export function SentryInitializer(): null {
  useEffect(() => {
    // Manually initialize Sentry on the client to ensure the Feedback widget works
    // and to bypass potential bundler/auto-injection issues.
    Sentry.init({
      ...(process.env["NEXT_PUBLIC_SENTRY_DSN"] && {
        dsn: process.env["NEXT_PUBLIC_SENTRY_DSN"],
      }),
      tracesSampleRate: 0.1, // Sample 10% of transactions in production
      enableLogs: process.env.NODE_ENV === "development", // Only log in development
      sendDefaultPii: false, // Do not send PII by default
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

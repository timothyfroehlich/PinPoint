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
      tracesSampleRate: 1,
      enableLogs: true,
      sendDefaultPii: true,
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

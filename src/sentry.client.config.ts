// This file configures the initialization of Sentry on the client side (browser).
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { feedbackIntegration } from "@sentry/react";

const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"];

if (!dsn) {
  // In production we want to fail, but in dev/build it might not be set
  // We'll log a warning if it's missing but allow the app to run (Sentry just won't initialize)
  console.warn(
    "NEXT_PUBLIC_SENTRY_DSN is not defined. Sentry will not be initialized."
  );
}

if (dsn) {
  Sentry.init({
    dsn,

    // Route requests through our server to bypass ad blockers
    tunnel: "/api/sentry-tunnel",

    // Add Feedback widget for bug reports with screenshots
    integrations: [
      feedbackIntegration({
        // Disable autoInject to manually attach to our button
        autoInject: false,

        // Customize the button
        triggerLabel: "Report a Bug",
        formTitle: "Report a Bug",
        submitButtonLabel: "Submit Bug Report",

        // Screenshots enabled by default
        enableScreenshot: true,
        isRequiredScreenshot: false,

        // Customize success message
        successMessageText: "Thanks! We'll review your report soon.",
      }),
    ],
    // Tracing - adjust sample rate for production
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Session Replay
    replaysSessionSampleRate: 0.0, // Disabled to avoid costs
    replaysOnErrorSampleRate: 0.0, // Disabled to avoid costs

    debug: false, // Disable debug in production
  });
}

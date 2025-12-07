// This file configures the initialization of Sentry on the client side (browser).
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { feedbackIntegration } from "@sentry/react";

const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"];

if (!dsn && !process.env["SENTRY_SUPPRESS_WARNING"]) {
  // In production we want to fail, but in dev/build it might not be set
  // We'll log a warning if it's missing but allow the app to run (Sentry just won't initialize)
  console.warn(
    "NEXT_PUBLIC_SENTRY_DSN is not defined. Sentry will not be initialized."
  );
}

if (dsn) {
  Sentry.init({
    dsn,

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 1,

    // Enable logs to be sent to Sentry
    enableLogs: true,

    // Enable sending user PII (Personally Identifiable Information)
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
    sendDefaultPii: true,

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
  });
}

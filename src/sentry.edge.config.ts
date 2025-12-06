// This file configures the initialization of Sentry for edge runtime bundles.
// The config you add here will be used whenever the edge runtime is used.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"];

if (dsn) {
  Sentry.init({
    dsn,

    // Tracing - adjust sample rate for production
    // We recommend adjusting this value in production, or using tracesSampler
    // for finer control
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
  });
}

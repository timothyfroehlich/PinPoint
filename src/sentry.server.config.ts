// This file configures the initialization of Sentry on the server side.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"];
if (!dsn) {
  throw new Error("NEXT_PUBLIC_SENTRY_DSN is required");
}

Sentry.init({
  dsn,

  // Tracing - adjust sample rate for production
  // We recommend adjusting this value in production, or using tracesSampler
  // for finer control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});

// This file configures the initialization of Sentry for edge runtime bundles.
// The config you add here will be used whenever the edge runtime is used.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"];

if (dsn) {
  Sentry.init({
    dsn,

    // Tracing
    tracesSampleRate: 1.0,

    // Debug
    debug: false,
  });
}

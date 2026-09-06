import * as Sentry from "@sentry/nextjs";

import { SENTRY_PRIVACY_OPTIONS } from "~/lib/observability/sentry-policy";

Sentry.init({
  ...(process.env["NEXT_PUBLIC_SENTRY_DSN"] && {
    dsn: process.env["NEXT_PUBLIC_SENTRY_DSN"],
  }),

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 0.1,

  // Enable structured logs to be forwarded to Sentry in all environments.
  // Production logs are critical for post-incident reconstruction (PP-2053.12).
  enableLogs: true,

  ...SENTRY_PRIVACY_OPTIONS,
});

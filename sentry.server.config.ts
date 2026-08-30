import * as Sentry from "@sentry/nextjs";

import { sentryBeforeSend } from "~/lib/observability/sentry-before-send";

Sentry.init({
  ...(process.env["NEXT_PUBLIC_SENTRY_DSN"] && {
    dsn: process.env["NEXT_PUBLIC_SENTRY_DSN"],
  }),

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 0.1,

  // Enable structured logs to be forwarded to Sentry in all environments.
  // Production logs are critical for post-incident reconstruction (PP-2053.12).
  enableLogs: true,

  // Do not send PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: false,

  beforeSend: sentryBeforeSend,
});

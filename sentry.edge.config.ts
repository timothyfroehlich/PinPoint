import * as Sentry from "@sentry/nextjs";

Sentry.init({
  ...(process.env["NEXT_PUBLIC_SENTRY_DSN"] && {
    dsn: process.env["NEXT_PUBLIC_SENTRY_DSN"],
  }),

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});

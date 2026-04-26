import * as Sentry from "@sentry/nextjs";

Sentry.init({
  ...(process.env["NEXT_PUBLIC_SENTRY_DSN"] && {
    dsn: process.env["NEXT_PUBLIC_SENTRY_DSN"],
  }),

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 0.1,

  // Enable logs to be sent to Sentry only in development
  enableLogs: process.env.NODE_ENV === "development",

  // Do not send PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: false,

  beforeSend(event) {
    // Drop Supabase auth cold-start transients on Vercel preview deployments —
    // the branch DB is still provisioning, so auth checks fail until it's ready.
    if (process.env["VERCEL_ENV"] === "preview") {
      const msg = "Tenant or user not found";
      const inMessage = event.message?.includes(msg) ?? false;
      const inException =
        event.exception?.values?.some(
          (ex) => ex.value?.includes(msg) ?? false
        ) ?? false;
      if (inMessage || inException) return null;
    }
    return event;
  },
});

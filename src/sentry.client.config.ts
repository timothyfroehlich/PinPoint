// This file configures the initialization of Sentry on the client side (browser).
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"];
if (!dsn) {
  throw new Error("NEXT_PUBLIC_SENTRY_DSN is required");
}

Sentry.init({
  dsn,

  // Route requests through our server to bypass ad blockers
  tunnel: "/api/sentry-tunnel",

  // Add Feedback widget for bug reports with screenshots
  integrations: [
    Sentry.feedbackIntegration({
      // Ensure widget is injected automatically
      autoInject: true,
      // Attach to our manual button in DashboardLayout
      attachTo: "#feedback-trigger",

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
  // We recommend adjusting this value in production, or using tracesSampler
  // for finer control
  tracesSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.0, // Disabled to avoid costs

  // If the entire session is not sampled, use the below sample rate to sample
  // sessions when an error occurs.
  replaysOnErrorSampleRate: 0.0, // Disabled to avoid costs

  // Uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: process.env.NODE_ENV === 'development',

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: true,
});

console.log("PinPoint Sentry Client Config Loaded");

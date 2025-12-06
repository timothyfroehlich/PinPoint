const Sentry = require("@sentry/nextjs");
console.log("Has getFeedback:", !!Sentry.getFeedback);

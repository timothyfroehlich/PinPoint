const Sentry = require("@sentry/nextjs");
console.log("Has getClient:", !!Sentry.getClient);

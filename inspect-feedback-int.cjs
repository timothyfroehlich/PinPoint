const { feedbackIntegration } = require("@sentry/react");
const integration = feedbackIntegration({});
console.log("Integration name:", integration.name);

import { setupServer } from "msw/node";
import { createTRPCMsw, httpLink } from "msw-trpc";
import superjson from "superjson";

import type { AppRouter } from "~/server/api/root";

// Helper function to get base URL for testing (test environment specific)
function getTestBaseUrl(): string {
  // Use fixed port for tests to avoid environment variable conflicts
  return "http://localhost:3000/api/trpc";
}

// Create tRPC-specific MSW instance (matches production client config)
export const trpcMsw = createTRPCMsw<AppRouter>({
  links: [httpLink({ url: getTestBaseUrl() })],
  transformer: {
    input: superjson,
    output: superjson,
  },
});

// Create MSW server instance with request logging
export const server = setupServer();

// Add request logging to debug MSW interception
server.events.on("request:start", ({ request }) => {
  console.log(`[MSW] Intercepting: ${request.method} ${request.url}`);
});

server.events.on("request:match", ({ request }) => {
  console.log(`[MSW] Handler matched: ${request.method} ${request.url}`);
});

server.events.on("request:unhandled", ({ request }) => {
  console.log(`[MSW] Unhandled request: ${request.method} ${request.url}`);
});

// MSW server lifecycle management to prevent double initialization
let isListening = false;

export const ensureListening = () => {
  if (!isListening) {
    server.listen({ onUnhandledRequest: "warn" });
    isListening = true;
    console.log("[MSW] Server started");
  } else {
    console.log("[MSW] Server already listening, skipping initialization");
  }
};

export const ensureClosed = () => {
  if (isListening) {
    server.close();
    isListening = false;
    console.log("[MSW] Server stopped");
  }
};

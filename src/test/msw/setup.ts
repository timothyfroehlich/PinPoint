import { setupServer } from "msw/node";
import { createTRPCMsw, httpLink } from "msw-trpc";
import superjson from "superjson";

import type { AppRouter } from "../../server/api/root";

// Helper function to get base URL for testing (matches production getBaseUrl pattern)
function getTestBaseUrl(): string {
  const port = process.env.PORT ?? "3000";
  return `http://localhost:${port}/api/trpc`;
}

// Create tRPC-specific MSW instance (matches production client config)
export const trpcMsw = createTRPCMsw<AppRouter>({
  links: [httpLink({ url: getTestBaseUrl() })],
  transformer: {
    input: superjson,
    output: superjson,
  },
});

// Create MSW server instance
export const server = setupServer();

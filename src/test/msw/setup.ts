import { setupServer } from 'msw/node';
import { createTRPCMsw } from 'msw-trpc';
import superjson from 'superjson';

import type { AppRouter } from '../../server/api/root';

// Create tRPC-specific MSW instance with simplified configuration
export const trpcMsw = createTRPCMsw<AppRouter>({
  transformer: {
    input: superjson,
    output: superjson,
  },
  baseUrl: 'http://localhost:3000/api/trpc',
});

// Create MSW server instance
export const server = setupServer();
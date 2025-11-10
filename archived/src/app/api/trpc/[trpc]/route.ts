import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";

import type { TRPCContext } from "~/server/api/trpc.base";

import { isDevelopment } from "~/lib/environment";
import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { getErrorMessage } from "~/lib/utils/type-guards";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a HTTP request (e.g. when you make requests from Client Components).
 */
const createContext = async (req: NextRequest): Promise<TRPCContext> => {
  return createTRPCContext({
    headers: req.headers,
  });
};

const handler = (req: NextRequest): Promise<Response> => {
  const baseConfig = {
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
  };

  if (isDevelopment()) {
    return fetchRequestHandler({
      ...baseConfig,
      onError: ({ path, error }): void => {
        console.error(
          `❌ tRPC failed on ${path ?? "<no-path>"}: ${getErrorMessage(error)}`,
        );
      },
    });
  }

  return fetchRequestHandler(baseConfig);
};

export { handler as GET, handler as POST };

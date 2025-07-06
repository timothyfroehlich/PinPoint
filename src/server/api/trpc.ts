/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { cookies } from "next/headers";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  let session = await auth();

  // In development, check for impersonation when no real session exists
  if (!session && process.env.NODE_ENV === "development") {
    const cookieStore = await cookies();
    const impersonatedUserId = cookieStore.get(
      "next-auth.session-token.impersonated",
    )?.value;

    if (impersonatedUserId) {
      const impersonatedUser = await db.user.findUnique({
        where: { id: impersonatedUserId },
      });

      if (impersonatedUser) {
        // Create a fake session object for development
        session = {
          user: {
            id: impersonatedUser.id,
            name: impersonatedUser.name,
            email: impersonatedUser.email,
            image: impersonatedUser.image,
          },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        };
      }
    }
  }

  // For now, we'll hardcode the organization. In the future, this will be
  // derived from the subdomain of the request.
  const organization = await db.organization.findFirst();
  if (!organization) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "No organization found.",
    });
  }

  return {
    db,
    session,
    organization,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        // infers the `session` as non-nullable
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });

/**
 * Organization-scoped procedure
 *
 * This procedure ensures that the user is a member of the organization they are trying to access.
 * It also adds the membership to the context.
 */
export const organizationProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const membership = await ctx.db.membership.findFirst({
      where: {
        organizationId: ctx.organization.id,
        userId: ctx.session.user.id,
      },
    });

    if (!membership) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    return next({
      ctx: {
        ...ctx,
        membership,
      },
    });
  },
);

/**
 * Admin-only procedure
 *
 * This procedure ensures that the user is an admin of the organization.
 * It builds on the organization procedure and adds admin role validation.
 */
export const adminProcedure = organizationProcedure.use(
  async ({ ctx, next }) => {
    if (ctx.membership.role !== "admin") {
      throw new TRPCError({ 
        code: "FORBIDDEN", 
        message: "Admin access required" 
      });
    }

    return next({
      ctx: {
        ...ctx,
        // membership is already available from organizationProcedure
      },
    });
  },
);

/**
 * Base tRPC procedures and middleware
 *
 * This file contains the fundamental building blocks for tRPC procedures
 * that are used across the application. It's separated to avoid circular
 * dependencies between trpc.ts and trpc.permission.ts.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import type { Session } from "next-auth";
import type { ExtendedPrismaClient } from "~/server/db";

import { env } from "~/env";
import { auth } from "~/server/auth";
import { getGlobalDatabaseProvider } from "~/server/db/provider";
import { ServiceFactory } from "~/server/services/factory";

/**
 * Base context interface for tRPC
 */
interface CreateTRPCContextOptions {
  headers: Headers;
}

/**
 * Organization type for context
 */
interface Organization {
  id: string;
  subdomain: string;
  name: string;
  // Add other fields as needed
}

/**
 * Permission type for context
 */
interface Permission {
  id: string;
  name: string;
}

/**
 * Role type for context
 */
interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

/**
 * Membership type for context
 */
interface Membership {
  id: string;
  organizationId: string;
  userId: string;
  role: Role;
}

/**
 * tRPC context type that includes all available properties
 */
export interface TRPCContext {
  db: ExtendedPrismaClient;
  session: Session | null;
  organization: Organization;
  services: ServiceFactory;
  headers: Headers;
}

/**
 * Enhanced context for protected procedures with authenticated user
 */
export interface ProtectedTRPCContext extends TRPCContext {
  session: Session & {
    user: NonNullable<Session["user"]>;
  };
}

/**
 * Enhanced context for organization procedures with membership info
 */
export interface OrganizationTRPCContext extends ProtectedTRPCContext {
  membership: Membership;
  userPermissions: string[];
}

/**
 * Context creation for tRPC
 */
export const createTRPCContext = async (opts: CreateTRPCContextOptions): Promise<TRPCContext> => {
  const dbProvider = getGlobalDatabaseProvider();
   
  const db = dbProvider.getClient();
  const services = new ServiceFactory(db);
  const session = await auth();

  let organization: Organization | null = null;

  // If user is authenticated and has organization context, use that
  if (session?.user.organizationId) {
     
    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
    });
    if (org) {
      organization = org as Organization;
    }
  }

  // Extract subdomain from headers (set by middleware)
  const subdomain =
    opts.headers.get("x-subdomain") ?? env.DEFAULT_ORG_SUBDOMAIN;

  // Fallback to organization based on subdomain
  if (!organization) {
     
    const org = await db.organization.findUnique({
      where: { subdomain },
    });
    if (org) {
      organization = org as Organization;
    }
  }

  if (!organization) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Organization with subdomain "${subdomain}" not found.`,
    });
  }

  return {
     
    db,
    session,
    organization,
    services,
    headers: opts.headers,
  };
};

/**
 * tRPC initialization
 */
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.issues : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

/**
 * Timing middleware
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
  if (env.NODE_ENV !== "test") {
    console.log(`[TRPC] ${path} took ${String(end - start)}ms to execute`);
  }

  return result;
});

/**
 * Base procedures
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        ...ctx,
        // infers the `session` as non-nullable
        session: { ...ctx.session, user: ctx.session.user },
      } satisfies ProtectedTRPCContext,
    });
  });

export const organizationProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    if (!ctx.organization) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      });
    }
     
    const membership = await ctx.db.membership.findFirst({
      where: {
        organizationId: ctx.organization.id,
        userId: ctx.session.user.id,
      },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!membership) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You don't have permission to access this organization",
      });
    }

    return next({
      ctx: {
        ...ctx,
        membership: membership as Membership,
         
        userPermissions: membership.role.permissions.map((p: { name: string }) => p.name),
      } satisfies OrganizationTRPCContext,
    });
  },
);

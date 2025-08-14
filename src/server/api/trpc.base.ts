/**
 * Base tRPC procedures and middleware
 *
 * This file contains the fundamental building blocks for tRPC procedures
 * that are used across the application. It's separated to avoid circular
 * dependencies between trpc.ts and trpc.permission.ts.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import superjson from "superjson";
import { ZodError } from "zod";

import type { LoggerInterface } from "~/lib/logger";
import type { SupabaseServerClient } from "~/lib/supabase/server";
import type { PinPointSupabaseUser } from "~/lib/supabase/types";
import type { ExtendedPrismaClient } from "~/server/db";
import type { DrizzleClient } from "~/server/db/drizzle";

import { env } from "~/env";
import { logger } from "~/lib/logger";
import {
  ERROR_MESSAGE_TRUNCATE_LENGTH,
  SLOW_OPERATION_THRESHOLD_MS,
} from "~/lib/logger-constants";
import { createClient } from "~/lib/supabase/server";
import { createTraceContext, traceStorage } from "~/lib/tracing";
import { getUserPermissionsForSupabaseUser } from "~/server/auth/permissions";
import { getSupabaseUser } from "~/server/auth/supabase";
import { getGlobalDatabaseProvider } from "~/server/db/provider";
import { organizations } from "~/server/db/schema";
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
  drizzle: DrizzleClient;
  user: PinPointSupabaseUser | null;
  supabase: SupabaseServerClient;
  organization: Organization | null;
  services: ServiceFactory;
  headers: Headers;
  logger: LoggerInterface;
  traceId?: string;
  requestId?: string;
}

/**
 * Enhanced context for protected procedures with authenticated user
 */
export interface ProtectedTRPCContext extends TRPCContext {
  user: PinPointSupabaseUser;
}

/**
 * Enhanced context for organization procedures with membership info
 * Note: organization is guaranteed to be non-null by organizationProcedure middleware
 */
export interface OrganizationTRPCContext extends ProtectedTRPCContext {
  organization: Organization; // Override to be non-null (guaranteed by middleware)
  membership: Membership;
  userPermissions: string[];
}

/**
 * Context creation for tRPC
 */
export const createTRPCContext = async (
  opts: CreateTRPCContextOptions,
): Promise<TRPCContext> => {
  const dbProvider = getGlobalDatabaseProvider();

  const db = dbProvider.getClient();
  const drizzle = dbProvider.getDrizzleClient();
  const services = new ServiceFactory(db, drizzle);
  const supabase = await createClient();
  const user = await getSupabaseUser();

  let organization: Organization | null = null;

  // If user is authenticated and has organization context, use that
  if (user?.app_metadata.organization_id) {
    const org = await drizzle.query.organizations.findFirst({
      where: eq(organizations.id, user.app_metadata.organization_id),
    });
    if (org) {
      // Type-safe assignment - Drizzle findFirst returns full object
      organization = {
        id: org.id,
        subdomain: org.subdomain,
        name: org.name,
      } satisfies Organization;
    }
  }

  // Extract subdomain from headers (set by middleware)
  const subdomain =
    opts.headers.get("x-subdomain") ?? env.DEFAULT_ORG_SUBDOMAIN;

  // Fallback to organization based on subdomain
  if (!organization) {
    const org = await drizzle.query.organizations.findFirst({
      where: eq(organizations.subdomain, subdomain),
    });
    if (org) {
      // Type-safe assignment - Drizzle findFirst returns full object
      organization = {
        id: org.id,
        subdomain: org.subdomain,
        name: org.name,
      } satisfies Organization;
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
    drizzle,
    user,
    supabase,
    organization,
    services,
    headers: opts.headers,
    logger,
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
        zodError: error.cause instanceof ZodError ? error.cause.issues : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

/**
 * Enhanced logging middleware with trace correlation
 */
const loggingMiddleware = t.middleware(async ({ path, type, next, ctx }) => {
  const start = Date.now();
  const traceContext = createTraceContext();

  const contextLogger = logger.child({
    component: `tRPC.${type}.${path}`,
    traceId: traceContext.traceId,
    requestId: traceContext.requestId,
    organizationId: ctx.organization?.id,
    userId: ctx.user?.id,
  });

  return traceStorage.run(traceContext, async () => {
    const enhancedCtx = {
      ...ctx,
      logger: contextLogger,
      traceId: traceContext.traceId,
      requestId: traceContext.requestId,
    };

    try {
      contextLogger.info({
        msg: `${type} ${path} started`,
        context: {
          operation: path,
          hasAuth: !!ctx.user,
          hasOrg: !!ctx.organization,
        },
      });

      if (t._config.isDev) {
        // artificial delay in dev
        const waitMs = Math.floor(Math.random() * 400) + 100;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }

      const result = await next({ ctx: enhancedCtx });
      const duration = Date.now() - start;

      // Log slow operations
      if (duration > SLOW_OPERATION_THRESHOLD_MS) {
        contextLogger.warn({
          msg: `Slow ${type} ${path} completed`,
          context: {
            duration,
            operation: path,
            performance: "slow",
          },
        });
      } else {
        contextLogger.info({
          msg: `${type} ${path} completed`,
          context: {
            duration,
            operation: path,
          },
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      contextLogger.error({
        msg: `${type} ${path} failed`,
        error: {
          type: error instanceof Error ? error.constructor.name : "Unknown",
          code: (error as { code?: string }).code ?? "UNKNOWN",
          message:
            error instanceof Error
              ? error.message.substring(0, ERROR_MESSAGE_TRUNCATE_LENGTH)
              : "Unknown error",
        },
        context: {
          duration,
          operation: path,
          success: false,
        },
      });

      throw error;
    }
  });
});

/**
 * Base procedures
 */
export const publicProcedure = t.procedure.use(loggingMiddleware);

export const protectedProcedure = t.procedure
  .use(loggingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        ...ctx,
        // infers the `user` as non-nullable
        user: ctx.user,
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
        userId: ctx.user.id,
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

    // Get user permissions (handles admin role automatically)
    const userPermissions = await getUserPermissionsForSupabaseUser(
      ctx.user,
      ctx.db,
      ctx.organization.id,
    );

    return next({
      ctx: {
        ...ctx,
        organization: ctx.organization, // Safe assertion - already checked above
        membership: {
          id: membership.id,
          organizationId: membership.organizationId,
          userId: membership.userId,
          role: membership.role,
        } satisfies Membership,
        userPermissions,
      } satisfies OrganizationTRPCContext,
    });
  },
);

/**
 * Base tRPC procedures and middleware
 *
 * This file contains the fundamental building blocks for tRPC procedures
 * that are used across the application. It's separated to avoid circular
 * dependencies between trpc.ts and trpc.permission.ts.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { eq, and, sql } from "drizzle-orm";
import superjson from "superjson";
import { ZodError } from "zod";

import type { LoggerInterface } from "~/lib/logger";
import type { SupabaseServerClient } from "~/lib/supabase/server";
import type { PinPointSupabaseUser } from "~/lib/supabase/types";
import type { DrizzleClient } from "~/server/db/drizzle";

import { env } from "~/env";
import { logger } from "~/lib/logger";
import {
  ERROR_MESSAGE_TRUNCATE_LENGTH,
  SLOW_OPERATION_THRESHOLD_MS,
} from "~/lib/logger-constants";
import { createClient } from "~/lib/supabase/server";
import { getUserOrganizationId } from "~/lib/supabase/rls-helpers";
import { createTraceContext, traceStorage } from "~/lib/tracing";
import { getUserPermissionsForSupabaseUser } from "~/server/auth/permissions";
import { getSupabaseUser } from "~/server/auth/supabase";
import { getGlobalDatabaseProvider } from "~/server/db/provider";
import { organizations, memberships } from "~/server/db/schema";
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
  db: DrizzleClient;
  user: PinPointSupabaseUser | null;
  supabase: SupabaseServerClient;
  organizationId: string | null;
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
  organizationId: string | null;
}

/**
 * Enhanced context for RLS-aware organization procedures
 * organizationId is guaranteed non-null and automatically used by RLS policies
 */
export interface RLSOrganizationTRPCContext extends ProtectedTRPCContext {
  organizationId: string; // Override to be non-null (guaranteed by middleware)
  organization: Organization; // Override to be non-null (guaranteed by middleware)
  membership: Membership;
  userPermissions: string[];
}

/**
 * Legacy organization context for backward compatibility
 * @deprecated Use RLSOrganizationTRPCContext directly
 */
export type OrganizationTRPCContext = RLSOrganizationTRPCContext;

/**
 * Context creation for tRPC with RLS-aware organization handling
 */
export const createTRPCContext = async (
  opts: CreateTRPCContextOptions,
): Promise<TRPCContext> => {
  const dbProvider = getGlobalDatabaseProvider();

  const db = dbProvider.getClient();
  const services = new ServiceFactory(db);
  const supabase = await createClient();
  const user = await getSupabaseUser();

  // Get organization ID from user's app_metadata (used by RLS policies)
  const organizationId = await getUserOrganizationId(supabase);

  let organization: Organization | null = null;

  // If user has organization context, fetch organization details
  if (organizationId) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });
    if (org) {
      organization = {
        id: org.id,
        subdomain: org.subdomain,
        name: org.name,
      } satisfies Organization;
    }
  }

  // Fallback: derive organization from subdomain for users without app_metadata organizationId
  if (!organization) {
    const subdomain =
      opts.headers.get("x-subdomain") ?? env.DEFAULT_ORG_SUBDOMAIN;

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.subdomain, subdomain),
    });

    if (org) {
      organization = {
        id: org.id,
        subdomain: org.subdomain,
        name: org.name,
      } satisfies Organization;

      // Set organizationId for downstream procedures if not already set
      if (!organizationId) {
        organizationId = org.id;
      }

      // Set session variable for RLS policies (simple, no verification)
      try {
        await db.execute(
          sql`SET LOCAL app.current_organization_id = ${org.id}`,
        );
      } catch (error) {
        // Log but continue - application-layer filtering will work as fallback
        logger.warn({
          msg: "Could not set RLS session variable, using application-layer filtering",
          component: "createTRPCContext",
          context: { organizationId: org.id, subdomain },
        });
      }
    }
  }

  // Create organization-scoped service factory if we have organization context
  const contextServices = organizationId
    ? services.withOrganization(organizationId)
    : services;

  return {
    db,
    user,
    supabase,
    organizationId,
    organization,
    services: contextServices,
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

/**
 * RLS-aware organization procedure with automatic organizational scoping and context repair
 *
 * This procedure ensures:
 * 1. User is authenticated
 * 2. User has organization context (organizationId in app_metadata or can be repaired)
 * 3. RLS policies will automatically scope all database queries
 *
 * Enhanced with authentication context repair:
 * - Attempts to find user's organization through membership if app_metadata is missing
 * - Provides fallback mechanisms for broken authentication contexts
 *
 * CRITICAL: organizationId is now handled by RLS policies automatically!
 * No manual filtering needed in router queries.
 */
export const organizationProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    let organizationId = ctx.organizationId;
    let organization = ctx.organization;

    // Phase 2.2: Authentication context repair
    // If user is missing organizationId in app_metadata, attempt to repair via membership lookup
    if (!organizationId) {
      ctx.logger.warn({
        msg: "Attempting authentication context repair - user missing organizationId",
        component: "organizationProcedure",
        context: {
          userId: ctx.user.id,
          hasAppMetadata: !!ctx.user.app_metadata,
          operation: "context_repair",
        },
      });

      // Try to find user's organization through their membership
      try {
        const userMembership = await ctx.db.query.memberships.findFirst({
          where: eq(memberships.user_id, ctx.user.id),
          with: {
            organization: true,
          },
          orderBy: [sql`updated_at DESC`], // Get most recent membership
        });

        if (userMembership?.organization) {
          organizationId = userMembership.organization_id;
          organization = {
            id: userMembership.organization.id,
            subdomain: userMembership.organization.subdomain,
            name: userMembership.organization.name,
          };

          ctx.logger.info({
            msg: "Authentication context repair successful",
            component: "organizationProcedure",
            context: {
              userId: ctx.user.id,
              repairedOrganizationId: organizationId,
              repairMethod: "membership_lookup",
            },
          });
        }
      } catch (error) {
        ctx.logger.error({
          msg: "Authentication context repair failed",
          component: "organizationProcedure",
          context: {
            userId: ctx.user.id,
            operation: "membership_lookup_failed",
          },
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    // Final validation after repair attempts
    if (!organizationId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "User does not have organization context. Please contact support if this persists.",
      });
    }

    if (!organization) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      });
    }

    // RLS automatically scopes this query to user's organization
    const membership = await ctx.db.query.memberships.findFirst({
      where: and(
        eq(memberships.organization_id, organizationId),
        eq(memberships.user_id, ctx.user.id),
      ),
      with: {
        role: {
          with: {
            rolePermissions: {
              with: {
                permission: true,
              },
            },
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
    );

    return next({
      ctx: {
        ...ctx,
        organizationId, // Guaranteed non-null (original or repaired)
        organization, // Guaranteed non-null (original or repaired)
        membership: {
          id: membership.id,
          organizationId: membership.organization_id,
          userId: membership.user_id,
          role: {
            id: membership.role.id,
            name: membership.role.name,
            permissions: membership.role.rolePermissions.map(
              (rp) => rp.permission,
            ),
          },
        } satisfies Membership,
        userPermissions,
      } satisfies RLSOrganizationTRPCContext,
    });
  },
);

/**
 * Simplified organization procedure for RLS-enabled operations
 *
 * This is the new recommended procedure that leverages RLS for automatic
 * organizational scoping without complex middleware.
 *
 * Use this for new routers that don't need complex permission checking.
 */
export const orgScopedProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "User does not have organization context",
    });
  }

  return next({
    ctx: {
      ...ctx,
      organizationId: ctx.organizationId, // Guaranteed non-null for RLS
    },
  });
});

/**
 * Anonymous organization-scoped procedure
 *
 * This procedure ensures anonymous users have organization context from subdomain
 * resolution. Use this instead of publicProcedure for multi-tenant operations
 * that require organization context.
 *
 * Features:
 * - Validates organization context exists (from subdomain resolution)
 * - Provides guaranteed non-null organizationId for consistent usage
 * - Standardizes error handling for missing organization context
 * - Compatible with application-layer organization filtering patterns
 */
export const anonOrgScopedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.organization) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Organization not found. Please check the URL or subdomain.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      organizationId: ctx.organization.id, // Guaranteed non-null for consistency
      organization: ctx.organization, // Guaranteed non-null
    },
  });
});

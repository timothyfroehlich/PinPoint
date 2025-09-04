/**
 * Request Context Core - Phase 2A
 * Unified per-request context accessible across server components, actions, API routes
 * 
 * Builds on Phase 1 canonical auth resolver and existing AsyncLocalStorage infrastructure
 */

import { AsyncLocalStorage } from "async_hooks";
import type { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";

import { TRACE_ID_SLICE_LENGTH } from "~/lib/logger-constants";
import { getRequestAuthContext, type AuthContext } from "~/server/auth/context";

/**
 * Core request context shape - Phase 2A v1
 */
export interface RequestContext {
  requestId: string;
  startedAt: Date;
  auth: AuthContext;
  orgId?: string;
  membership?: {
    id: string;
    role: {
      id: string;
      name: string;
    };
  };
  flags: Record<string, unknown>;
  locale?: string;
}

/**
 * AsyncLocalStorage for request context
 */
const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${uuidv4().slice(0, TRACE_ID_SLICE_LENGTH)}`;
}

/**
 * Initialize request context from Next.js request
 * Integrates with Phase 1 canonical auth resolver
 */
export async function initRequestContext(request: NextRequest): Promise<RequestContext> {
  const requestId = generateRequestId();
  const startedAt = new Date();
  
  // Use Phase 1 canonical auth resolver (cached, no duplication)
  const auth = await getRequestAuthContext();
  
  // Extract locale from Accept-Language header if available
  const headers = request.headers;
  const acceptLanguage = headers.get('accept-language');
  const locale = acceptLanguage?.split(',')[0]?.split('-')[0];
  
  // Build context based on auth state
  const baseContext = {
    requestId,
    startedAt,
    auth,
    flags: {}, // Empty for Phase 2A, feature flags in later phases
  };
  
  let context: RequestContext;
  
  if (auth.kind === 'authorized') {
    context = {
      ...baseContext,
      orgId: auth.org.id,
      membership: {
        id: auth.membership.id,
        role: {
          id: auth.membership.role.id,
          name: auth.membership.role.name,
        },
      },
      ...(locale && { locale }),
    };
  } else if (auth.kind === 'no-membership') {
    context = {
      ...baseContext,
      orgId: auth.orgId,
      ...(locale && { locale }),
    };
  } else {
    context = {
      ...baseContext,
      ...(locale && { locale }),
    };
  }
  
  return context;
}

/**
 * Get current request context
 * Returns undefined if no context is set (outside request scope)
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Execute function within request context
 * Used by middleware to establish context for the request lifecycle
 */
export async function withRequestContext<T>(
  context: RequestContext,
  fn: () => Promise<T>,
): Promise<T> {
  return requestContextStorage.run(context, fn);
}

/**
 * Type guard to check if we have authorized context
 */
export function hasAuthorizedContext(
  context: RequestContext | undefined,
): context is RequestContext & { auth: Extract<AuthContext, { kind: 'authorized' }> } {
  return context?.auth.kind === 'authorized';
}

/**
 * Type guard to check if we have authenticated context (authorized or no-membership)
 */
export function hasAuthenticatedContext(
  context: RequestContext | undefined,
): context is RequestContext & { auth: Exclude<AuthContext, { kind: 'unauthenticated' }> } {
  return context?.auth.kind !== 'unauthenticated';
}

/**
 * Helper to get organization ID from context
 */
export function getOrgIdFromContext(): string | undefined {
  const context = getRequestContext();
  return context?.orgId;
}

/**
 * Helper to get user ID from context
 */
export function getUserIdFromContext(): string | undefined {
  const context = getRequestContext();
  return hasAuthenticatedContext(context) ? context.auth.user.id : undefined;
}

/**
 * Helper to require authorized context (throws if not available)
 */
export function requireAuthorizedContext(): RequestContext & { 
  auth: Extract<AuthContext, { kind: 'authorized' }> 
} {
  const context = getRequestContext();
  if (!hasAuthorizedContext(context)) {
    throw new Error('Member access required - no authorized context available');
  }
  return context;
}
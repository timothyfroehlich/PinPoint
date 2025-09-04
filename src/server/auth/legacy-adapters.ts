/**
 * Phase 1: Legacy Authentication Function Adapters
 *
 * These adapters provide backward compatibility during migration.
 * Each adapter calls the canonical resolver and maps to legacy shape.
 * Emits deprecation warnings to track usage during transition.
 */

import { cache } from "react";
import { getRequestAuthContext, requireAuthorized } from "./context";
import { trackAuthResolverCall } from "../../lib/auth/instrumentation";

/**
 * Track deprecation warnings (deduplicated)
 */
const warnedFunctions = new Set<string>();

function emitDeprecationWarning(functionName: string, replacement: string): void {
  const strict = process.env['AUTH_ADAPTER_STRICT'] === '1';
  if (!warnedFunctions.has(functionName)) {
    warnedFunctions.add(functionName);
    const message = `[AUTH-ADAPTER] DEPRECATED: ${functionName} - use ${replacement} instead`;
    if (strict) {
      // In strict mode we throw immediately to flush out remaining legacy imports fast
      throw new Error(`${message} (AUTH_ADAPTER_STRICT=1)`);
    } else {
      console.warn(message);
    }
  }
}

// =============================================================================
// ADAPTER: requireMemberAccess (most heavily used)
// =============================================================================

export const requireMemberAccessAdapter = cache(async () => {
  trackAuthResolverCall('requireMemberAccess[ADAPTER]');
  emitDeprecationWarning('requireMemberAccess', 'getRequestAuthContext + requireAuthorized');

  const ctx = await requireAuthorized();

  // Map to legacy shape
  return {
    user: {
      id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
    },
    organization: {
      id: ctx.org.id,
      name: ctx.org.name,
      subdomain: ctx.org.subdomain,
    },
    membership: {
      id: ctx.membership.id,
      role: ctx.membership.role,
      userId: ctx.membership.userId,
      organizationId: ctx.membership.organizationId,
    },
  };
});

// =============================================================================
// ADAPTER: requireOrganizationContext (organization-context.ts version)
// =============================================================================

export const requireOrganizationContextAdapter = cache(async () => {
  trackAuthResolverCall('requireOrganizationContext[ADAPTER]');
  emitDeprecationWarning('requireOrganizationContext', 'getRequestAuthContext + requireAuthorized');

  const ctx = await requireAuthorized();

  // Map to legacy OrganizationContext shape
  return {
    user: ctx.user,
    organization: {
      id: ctx.org.id,
      name: ctx.org.name,
      subdomain: ctx.org.subdomain,
    },
    membership: ctx.membership,
    accessLevel: 'member' as const,
  };
});

// =============================================================================
// ADAPTER: getOrganizationContext (returns null instead of throwing)
// =============================================================================

export const getOrganizationContextAdapter = cache(async () => {
  trackAuthResolverCall('getOrganizationContext[ADAPTER]');
  emitDeprecationWarning('getOrganizationContext', 'getRequestAuthContext');

  const ctx = await getRequestAuthContext();

  if (ctx.kind === 'authorized') {
    return {
      user: ctx.user,
      organization: {
        id: ctx.org.id,
        name: ctx.org.name,
        subdomain: ctx.org.subdomain,
      },
      membership: ctx.membership,
      accessLevel: 'member' as const,
    };
  }

  // Return null for legacy compatibility (doesn't throw)
  return null;
});

// =============================================================================
// ADAPTER: getServerAuthContext (actions version)
// =============================================================================

export const getServerAuthContextAdapter = cache(async () => {
  trackAuthResolverCall('getServerAuthContext[ADAPTER]');
  emitDeprecationWarning('getServerAuthContext', 'getRequestAuthContext + requireAuthorized');

  const ctx = await requireAuthorized();

  // Map to actions auth shape
  return {
    user: {
      id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
    },
    organizationId: ctx.org.id,
  };
});

// =============================================================================
// ADAPTER: getActionAuthContext
// =============================================================================

export const getActionAuthContextAdapter = cache(async () => {
  trackAuthResolverCall('getActionAuthContext[ADAPTER]');
  emitDeprecationWarning('getActionAuthContext', 'getRequestAuthContext + requireAuthorized');

  const ctx = await requireAuthorized();

  // Map to action auth shape (same as getServerAuthContext)
  return {
    user: {
      id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
    },
    organizationId: ctx.org.id,
  };
});

// =============================================================================
// ADAPTER: getUserWithOrganization (RLS helpers)
// =============================================================================

export const getUserWithOrganizationAdapter = cache(async () => {
  trackAuthResolverCall('getUserWithOrganization[ADAPTER]');
  emitDeprecationWarning('getUserWithOrganization', 'getRequestAuthContext');

  const ctx = await getRequestAuthContext();

  if (ctx.kind === 'unauthenticated') {
    throw new Error('User not authenticated');
  }

  // Map to RLS helper shape
  return {
    user: ctx.user,
    organizationId: ctx.kind === 'authorized' ? ctx.org.id : ctx.orgId,
  };
});

// =============================================================================
// ADAPTER: requireSupabaseUserContext
// =============================================================================

export const requireSupabaseUserContextAdapter = cache(async () => {
  trackAuthResolverCall('requireSupabaseUserContext[ADAPTER]');
  emitDeprecationWarning('requireSupabaseUserContext', 'getRequestAuthContext');

  const ctx = await getRequestAuthContext();

  if (ctx.kind === 'unauthenticated') {
    throw new Error('User not authenticated');
  }

  // Map to Supabase user context shape
  return {
    user: {
      id: ctx.user.id,
      email: ctx.user.email,
      app_metadata: {
        organizationId: ctx.kind === 'authorized' ? ctx.org.id : ctx.orgId,
      },
    },
    organizationId: ctx.kind === 'authorized' ? ctx.org.id : ctx.orgId,
  };
});

// =============================================================================
// UTILITY: Get adapter usage stats
// =============================================================================

export function getAdapterStats() {
  return {
    warnedFunctions: Array.from(warnedFunctions),
    totalAdapters: warnedFunctions.size,
  };
}

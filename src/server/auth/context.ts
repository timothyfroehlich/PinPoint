/**
 * Canonical Authentication Context Resolver - Phase 1
 * Single deterministic, cached request-scoped authentication resolution
 * 
 * Implements the 4-layer authentication stack:
 * 1. Session - Read cookies / Supabase session
 * 2. Identity - Normalize user (id, email) 
 * 3. Org Context - Resolve orgId + load org
 * 4. Authorization - Fetch membership & role
 */

import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "~/lib/supabase/server";
import { extractTrustedSubdomain } from "~/lib/subdomain-verification";
import { getOrganizationBySubdomain } from "~/lib/dal/public-organizations";
import { getUserMembershipPublic } from "~/lib/dal/public-organizations";
import { trackAuthResolverCall } from "~/lib/auth/instrumentation";

/**
 * Base user type (identity layer)
 */
interface BaseUser {
  id: string;
  email: string;
  name?: string;
}

/**
 * Organization type
 */
interface Org {
  id: string;
  name: string;
  subdomain: string;
}

/**
 * Membership type
 */
interface Membership {
  id: string;
  role: {
    id: string;
    name: string;
  };
  userId: string;
  organizationId: string;
}

/**
 * Canonical return type - discriminated union (never throws)
 */
export type AuthContext =
  | { kind: 'unauthenticated' }
  | { kind: 'no-membership'; user: BaseUser; orgId: string }
  | { kind: 'authorized'; user: BaseUser; org: Org; membership: Membership };

/**
 * Single canonical authentication resolver
 * Uses React 19 cache() for request-level memoization
 * Returns structured union (never throws)
 */
export const getRequestAuthContext = cache(async (): Promise<AuthContext> => {
  // Track this resolver call for instrumentation
  trackAuthResolverCall('getRequestAuthContext');

  try {
    // 1. Session Layer: Read cookies + Supabase session
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { kind: 'unauthenticated' };
    }

    // 2. Identity Layer: Normalize user (strip sensitive fields)
    const userName = user.user_metadata?.['name'] as string | undefined;
    const baseUser: BaseUser = {
      id: user.id,
      email: user.email ?? '',
      ...(userName && { name: userName }),
    };

    // 3. Org Context Layer: Resolve orgId (precedence order)
    // Priority: subdomain header > user.app_metadata.organizationId
    const headersList = await headers();
    const subdomain = extractTrustedSubdomain(headersList);
    const metadataOrgId = user.app_metadata?.['organizationId'] as string;
    
    let orgId: string;
    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
      orgId = subdomain;
    } else if (metadataOrgId) {
      orgId = metadataOrgId;
    } else {
      return { kind: 'unauthenticated' }; // No valid org resolution
    }

    // Fetch organization (1 query)
    const org = await getOrganizationBySubdomain(orgId);
    if (!org) {
      return { kind: 'no-membership', user: baseUser, orgId };
    }

    // 4. Authorization Layer: Fetch membership (1 query)  
    const membership = await getUserMembershipPublic(user.id, org.id);
    if (!membership) {
      return { kind: 'no-membership', user: baseUser, orgId: org.id };
    }

    // Success: Full authorization
    return {
      kind: 'authorized',
      user: baseUser,
      org: {
        id: org.id,
        name: org.name,
        subdomain: org.subdomain,
      },
      membership: {
        id: membership.id,
        role: {
          id: membership.role.id,
          name: membership.role.name,
        },
        userId: membership.user_id,
        organizationId: membership.organization_id,
      },
    };

  } catch (error) {
    // Never throw - return structured failure
    console.error('[AUTH-CONTEXT] Unexpected error during resolution:', error);
    return { kind: 'unauthenticated' };
  }
});

/**
 * Legacy enforcement helper (thin wrapper)
 * Throws error for backward compatibility
 */
export async function requireAuthorized(): Promise<Extract<AuthContext, { kind: 'authorized' }>> {
  const ctx = await getRequestAuthContext();
  if (ctx.kind !== 'authorized') {
    throw new Error('Member access required');
  }
  return ctx;
}

/**
 * Type guards for working with discriminated union
 */
export function isAuthorized(ctx: AuthContext): ctx is Extract<AuthContext, { kind: 'authorized' }> {
  return ctx.kind === 'authorized';
}

export function isAuthenticated(ctx: AuthContext): ctx is Exclude<AuthContext, { kind: 'unauthenticated' }> {
  return ctx.kind !== 'unauthenticated';
}
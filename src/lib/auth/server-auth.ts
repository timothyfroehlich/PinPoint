/**
 * Server Authentication Context - Phase 2C RSC Migration
 * Unified server-side authentication utilities for Server Components
 * Integrates with existing DAL authentication while providing Phase 2C standard interface
 */

import { cache } from "react";
import { redirect } from "next/navigation";
import { getServerAuthContext } from "~/lib/dal/shared";
import { createClient } from "~/lib/supabase/server";

export interface ServerAuthContext {
  user: {
    id: string;
    email: string;
    name?: string;
    profile_picture?: string;
    user_metadata?: {
      organizationId?: string;
      role?: string;
    };
  };
  organizationId: string;
  supabase: ReturnType<typeof createClient>;
}

// Create Supabase server client with proper cookie handling
// Delegates to existing DAL implementation for consistency
export async function createServerSupabaseClient() {
  return await createClient();
}

// Get authenticated user context (optional - returns null if not logged in)
// Integrates with existing DAL getServerAuthContext but provides Phase 2C interface
export const getServerAuth = cache(async (): Promise<ServerAuthContext | null> => {
  try {
    const dalContext = await getServerAuthContext();
    
    if (!dalContext.user || !dalContext.organizationId) {
      return null;
    }
    
    // Transform DAL context to Phase 2C ServerAuthContext interface
    return {
      user: {
        id: dalContext.user.id,
        email: dalContext.user.email!,
        name: dalContext.user.user_metadata?.name || dalContext.user.email!,
        profile_picture: dalContext.user.user_metadata?.profile_picture,
        user_metadata: dalContext.user.user_metadata
      },
      organizationId: dalContext.organizationId,
      supabase: await createClient()
    };
  } catch (error) {
    console.error("Server auth error:", error);
    return null;
  }
});

// Require authenticated user context (redirects if not logged in)
// Provides Phase 2C standard interface with automatic redirect
export const requireServerAuth = cache(async (): Promise<ServerAuthContext> => {
  const authContext = await getServerAuth();
  
  if (!authContext) {
    redirect("/auth/sign-in");
  }
  
  return authContext;
});

// Development authentication helper
export async function getDevAuthContext(): Promise<ServerAuthContext> {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Dev auth only available in development");
  }
  
  // Return mock auth context for development
  return {
    user: {
      id: "test-user-tim",
      email: "tim@austinpinball.com",
      name: "Tim Froehlich",
      user_metadata: {
        organizationId: "test-org-pinpoint",
        role: "admin"
      }
    },
    organizationId: "test-org-pinpoint",
    supabase: await createServerSupabaseClient()
  };
}

// Organization membership validation
export async function validateOrganizationAccess(
  userId: string, 
  organizationId: string
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  
  // Check if user has membership in organization
  const { data: membership } = await supabase
    .from("memberships")
    .select("id, role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .single();
  
  return !!membership;
}
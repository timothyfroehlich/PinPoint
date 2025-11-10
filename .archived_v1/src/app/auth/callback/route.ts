/**
 * Auth Callback Route - Alpha Single-Org Mode
 * Handles OAuth and magic link callbacks
 * Simplified to always use ALPHA_ORG_ID
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "~/lib/supabase/server";
import { updateUserOrganization } from "~/lib/supabase/rls-helpers";
import { getUserMembershipPublic } from "~/lib/dal/public-organizations";
import { getInMemoryRateLimiter } from "~/lib/rate-limit/inMemory";
import { METADATA_KEYS } from "~/lib/constants/entity-ui";
import { env } from "~/env";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Rate limiting for auth callback endpoint - prevent abuse
  const clientIP =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const rateLimiter = getInMemoryRateLimiter();
  const rateKey = `auth-callback:${clientIP}`;

  const allowed = rateLimiter.check(rateKey, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per window per IP
  });

  if (!allowed) {
    console.warn("[AUTH-CALLBACK] Rate limit exceeded", {
      operation: "rate_limit_check",
      clientIP: clientIP.replace(/\d+/g, "xxx"), // Mask IP for privacy
      timestamp: new Date().toISOString(),
    });
    return NextResponse.redirect(
      `${request.nextUrl.origin}/auth/auth-code-error?error=rate_limited`,
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Alpha: Ensure app_metadata.organizationId is set to ALPHA_ORG_ID
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const resolvedOrgId = env.ALPHA_ORG_ID;

          // Validate user has membership in ALPHA org
          const membership = await getUserMembershipPublic(
            user.id,
            resolvedOrgId,
          );
          if (!membership) {
            console.warn(
              "[AUTH-CALLBACK] User has no membership in alpha organization",
              {
                operation: "membership_validation",
                userId: user.id,
                orgId: resolvedOrgId,
                timestamp: new Date().toISOString(),
              },
            );
            // Don't update metadata for users without membership
          } else {
            // Update metadata if not already set or different
            const current = user.app_metadata[
              METADATA_KEYS.ORGANIZATION_ID
            ] as unknown;
            if (current !== resolvedOrgId) {
              await updateUserOrganization(user.id, resolvedOrgId);
            }
          }
        }
      } catch (e) {
        // Non-fatal: proceed with redirect even if metadata update fails
        console.warn("[AUTH-CALLBACK] Failed to update app_metadata", {
          operation: "metadata_update",
          error: e instanceof Error ? e.message : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }

      // Authentication successful - redirect to requested path
      return NextResponse.redirect(`${request.nextUrl.origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(
    `${request.nextUrl.origin}/auth/auth-code-error`,
  );
}

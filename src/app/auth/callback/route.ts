import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "~/lib/supabase/server";
import { updateUserOrganization } from "~/lib/supabase/rls-helpers";
import { extractTrustedSubdomain } from "~/lib/subdomain-verification";
import { resolveOrgSubdomainFromHost } from "~/lib/domain-org-mapping";
import {
  getOrganizationBySubdomain,
  getUserMembershipPublic,
} from "~/lib/dal/public-organizations";
import { getInMemoryRateLimiter } from "~/lib/rate-limit/inMemory";
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
      // Attempt to ensure app_metadata.organizationId is set for RLS policies
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const queryOrgId = searchParams.get("organizationId");

        let resolvedOrgId: string | null = queryOrgId;
        if (!resolvedOrgId) {
          // Derive from subdomain (trusted header or host alias fallback)
          const trustedSubdomain = extractTrustedSubdomain(
            request.headers as unknown as Headers,
          );
          const host = request.headers.get("host") ?? "";
          const subdomain =
            trustedSubdomain ?? resolveOrgSubdomainFromHost(host);
          if (subdomain) {
            const org = await getOrganizationBySubdomain(subdomain);
            resolvedOrgId = org?.id ?? null;
          }
        }

        if (user && resolvedOrgId) {
          // Validate user has membership in the resolved organization
          const membership = await getUserMembershipPublic(
            user.id,
            resolvedOrgId,
          );
          if (!membership) {
            console.warn(
              "[AUTH-CALLBACK] User has no membership in resolved organization",
              {
                operation: "membership_validation",
                userId: user.id,
                hasResolvedOrg: !!resolvedOrgId,
                timestamp: new Date().toISOString(),
              },
            );
            // Don't update metadata for unauthorized organization - skip metadata update
          } else {
            const current = user.app_metadata["organizationId"] as unknown;
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

      // Authentication successful - user is now organization-agnostic
      // Organization context will be determined per-request from subdomain

      // Redirect to the appropriate subdomain URL
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`http://localhost:3000${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${request.nextUrl.origin}${next}`);
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(
    `${request.nextUrl.origin}/auth/auth-code-error`,
  );
}

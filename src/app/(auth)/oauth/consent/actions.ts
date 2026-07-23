"use server";

import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { getUserAccessLevel } from "~/lib/permissions/access";
import { getLoginUrl } from "~/lib/login-url";
import { log } from "~/lib/logger";
import { authorizationIdSchema } from "./schemas";

/** Build the consent page URL for a given authorization id. */
function consentUrl(authorizationId: string): string {
  return `/oauth/consent?authorization_id=${encodeURIComponent(
    authorizationId
  )}`;
}

/**
 * Shared approve/deny handler for the Supabase OAuth 2.1 consent screen.
 *
 * Admin-only (PP-u4ab.5; technician+ tracked in PP-u4ab.6). Re-checks auth and
 * access level server-side — never trusts the page that rendered the form. On
 * success Supabase returns a fully-formed `redirect_url` back to the OAuth
 * client (Claude Code), which we hand to Next's `redirect()`.
 */
async function decideConsent(
  formData: FormData,
  decision: "approve" | "deny"
): Promise<never> {
  const parsed = authorizationIdSchema.safeParse(
    formData.get("authorization_id")
  );
  if (!parsed.success) {
    redirect("/oauth/consent");
  }
  const authorizationId = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(getLoginUrl(consentUrl(authorizationId)));
  }

  const accessLevel = await getUserAccessLevel(user.id);
  if (accessLevel !== "admin") {
    // Non-admins can't authorize the MCP surface. Bounce back to the page,
    // which renders the admin-only notice.
    redirect(consentUrl(authorizationId));
  }

  const { data, error } =
    decision === "approve"
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, {
          skipBrowserRedirect: true,
        })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, {
          skipBrowserRedirect: true,
        });

  if (error) {
    log.error(
      { action: "oauth-consent", decision, message: error.message },
      "OAuth consent decision failed"
    );
    // A failed decision usually invalidates the authorization, so bouncing back
    // to the consent page lands the user on its "expired / no longer valid"
    // notice. Nothing productive to retry inline.
    redirect(consentUrl(authorizationId));
  }

  redirect(data.redirect_url);
}

export async function approveConsentAction(formData: FormData): Promise<never> {
  return decideConsent(formData, "approve");
}

export async function denyConsentAction(formData: FormData): Promise<never> {
  return decideConsent(formData, "deny");
}

/* eslint-disable eslint-comments/no-restricted-disable, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- Auth callback requires direct Supabase client usage which returns any */
/**
 * Auth callback route requires direct use of createServerClient with custom cookie handling
 * to properly set cookies in the response. Standard SSR wrapper cannot be used here.
 * The `any` types from createServerClient are unavoidable in this context.
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { getSupabaseEnv } from "~/lib/supabase/env";
import { getSiteUrl, isInternalUrl } from "~/lib/url";
import { reportError } from "~/lib/observability/report-error";

export function resolveRedirectPath(nextParam: string | null): string {
  const fallback = "/";

  if (!nextParam) {
    return fallback;
  }

  if (isInternalUrl(nextParam)) {
    return nextParam;
  }

  // Allow absolute URLs that point to the configured site URL only.
  try {
    const siteUrl = getSiteUrl();
    const siteHost = new URL(siteUrl).host;
    const parsed = new URL(nextParam);

    if (parsed.host === siteHost) {
      const normalizedPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      if (isInternalUrl(normalizedPath)) {
        return normalizedPath;
      }
    }
  } catch {
    // swallow parse errors and fall through to fallback
  }

  return fallback;
}

/**
 * Auth callback route for OAuth flows.
 *
 * Active providers: Discord (PP-7kq). Google is wired as a config stub
 * (see supabase/config.toml.template) — add a registry entry in
 * `src/lib/auth/providers.ts` to enable it end-to-end.
 *
 * Required for CORE-SSR-004 compliance.
 *
 * Flow:
 * 1. User initiates OAuth via signInWithProviderAction or linkProviderAction
 * 2. Supabase redirects through the provider → back to this route with a code
 * 3. exchangeCodeForSession resolves the code into a session cookie
 * 4. Redirect to `next` (defaults to `/`)
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 * @see src/lib/auth/providers.ts for the provider registry
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const nextParam = searchParams.get("next") ?? "/";

  // Security: Always use configured site URL for redirects, never trust Host header
  const next = resolveRedirectPath(nextParam);
  const siteUrl = getSiteUrl();

  const shouldUseLoadingScreen = next === "/reset-password";
  const redirectPath = shouldUseLoadingScreen
    ? `/auth/callback-loading?next=${encodeURIComponent(next)}`
    : next;

  // Ensure redirectPath starts with / to avoid double slashes if siteUrl has trailing slash
  // getSiteUrl() typically does not have trailing slash, but good to be safe.
  // Actually getSiteUrl implementation: return `...` (no trailing slash usually).
  // But redirectPath from resolveRedirectPath always starts with / due to isInternalUrl check.

  const targetUrl = `${siteUrl}${redirectPath}`;

  const redirectToTarget = (): NextResponse => {
    return NextResponse.redirect(targetUrl);
  };

  const supabaseClient = createSupabaseClient(request);
  const { supabase, pendingCookies } = supabaseClient;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      await syncDiscordIdentity(supabase);
      return applyCookies(redirectToTarget(), pendingCookies);
    }

    reportError(error, {
      action: "auth.callback",
      step: "exchangeCodeForSession",
    });
  }

  const otpType = isValidEmailOtpType(typeParam);
  if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    });

    if (!error) {
      await syncDiscordIdentity(supabase);
      return applyCookies(redirectToTarget(), pendingCookies);
    }

    reportError(error, {
      action: "auth.callback",
      step: "verifyOtp",
      type: otpType,
    });
  }

  // Auth failed or no code - redirect to error page
  // Use siteUrl for error page redirect too
  return applyCookies(
    NextResponse.redirect(`${siteUrl}/auth/auth-code-error`),
    pendingCookies
  );
}

function isValidEmailOtpType(value: string | null): value is EmailOtpType {
  if (!value) {
    return false;
  }

  return (
    value === "signup" ||
    value === "invite" ||
    value === "magiclink" ||
    value === "recovery" ||
    value === "email_change" ||
    value === "email"
  );
}

async function syncDiscordIdentity(
  supabase: ReturnType<typeof createServerClient>
): Promise<void> {
  // Errors here are non-fatal for the OAuth callback (the user is signed in
  // either way) but they cause UI/runtime drift: the Connected Accounts
  // panel reads auth.identities while testDiscordDmAction reads
  // user_profiles.discord_user_id. A silent failure here means the badge
  // says "Connected" but DMs report "Link your Discord account first."
  // Wrap in try/catch + reportError so the divergence shows up in Sentry
  // instead of disappearing.
  try {
    const { data: userResponse } = await supabase.auth.getUser();
    const user = userResponse.user;
    if (!user) return;

    // getUserIdentities() makes a fresh query; user.identities from getUser()
    // can lag behind a just-completed link. We only mirror when a Discord
    // identity is actually present — a non-Discord sign-in (email/password,
    // password recovery, magic link) must NOT silently clear an existing
    // discord_user_id. Unlinking is handled in oauth-actions-core.ts.
    const { data: identitiesData, error: identitiesError } =
      await supabase.auth.getUserIdentities();
    if (identitiesError) {
      reportError(identitiesError, {
        action: "auth.callback.syncDiscordIdentity",
        step: "getUserIdentities",
        userId: user.id,
      });
      return;
    }

    const identities = identitiesData.identities as {
      provider: string;
      identity_data?: { provider_id?: string; sub?: string };
    }[];
    const discord = identities.find((i) => i.provider === "discord");
    if (!discord) return;

    const discordUserId =
      discord.identity_data?.provider_id ?? discord.identity_data?.sub ?? null;
    if (!discordUserId) return;

    await db
      .update(userProfiles)
      .set({ discordUserId })
      .where(eq(userProfiles.id, user.id));
  } catch (error) {
    reportError(error, {
      action: "auth.callback.syncDiscordIdentity",
    });
  }
}

function createSupabaseClient(request: NextRequest): {
  supabase: ReturnType<typeof createServerClient>;
  pendingCookies: { name: string; value: string; options?: CookieOptions }[];
} {
  const { url: supabaseUrl, publishableKey: supabaseKey } = getSupabaseEnv();

  const pendingCookies: {
    name: string;
    value: string;
    options?: CookieOptions;
  }[] = [];

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          pendingCookies.push({ name, value, options });
        });
      },
    },
  });

  return { supabase, pendingCookies };
}

function applyCookies(
  response: NextResponse,
  cookies: { name: string; value: string; options?: CookieOptions }[]
): NextResponse {
  cookies.forEach(({ name, value, options }) => {
    if (options) {
      response.cookies.set(name, value, options);
    } else {
      response.cookies.set(name, value);
    }
  });
  return response;
}

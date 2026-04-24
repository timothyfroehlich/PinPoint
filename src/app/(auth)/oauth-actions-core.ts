/**
 * Internal core for OAuth server actions. Kept separate from
 * `oauth-actions.ts` ("use server") so unit tests can exercise the
 * Result-returning logic without the `<form action>` void-return wrappers.
 *
 * App code should NOT import from this module — use `oauth-actions.ts`.
 */

import { createClient } from "~/lib/supabase/server";
import { type Result, ok, err } from "~/lib/result";
import { getSiteUrl } from "~/lib/url";
import { log } from "~/lib/logger";
import { getProvider, providers, type ProviderKey } from "~/lib/auth/providers";
import { canUnlinkIdentity } from "~/lib/auth/identity-guards";

export type SignInWithProviderResult = Result<
  { redirectUrl: string },
  "PROVIDER_UNAVAILABLE" | "SERVER"
>;

export type LinkProviderResult = Result<
  { redirectUrl: string },
  "PROVIDER_UNAVAILABLE" | "NOT_AUTHENTICATED" | "SERVER"
>;

export type UnlinkProviderResult = Result<
  void,
  | "PROVIDER_UNAVAILABLE"
  | "NOT_AUTHENTICATED"
  | "ONLY_IDENTITY"
  | "NOT_LINKED"
  | "SERVER"
>;

function isProviderKey(value: string): value is ProviderKey {
  return Object.prototype.hasOwnProperty.call(providers, value);
}

export async function runSignInWithProvider(
  rawKey: string
): Promise<SignInWithProviderResult> {
  if (!isProviderKey(rawKey)) {
    return err("PROVIDER_UNAVAILABLE", "Unknown provider");
  }
  const provider = getProvider(rawKey);

  if (!provider.isAvailable()) {
    log.warn(
      { providerKey: rawKey, action: "oauth-sign-in" },
      "Sign-in attempted for unavailable provider"
    );
    return err("PROVIDER_UNAVAILABLE", "This login method is not configured");
  }

  const supabase = await createClient();
  // CORE-SSR-002: getUser() must immediately follow createClient(), even in
  // pre-auth flows, to keep cookie refresh semantics consistent with middleware.
  await supabase.auth.getUser();

  const siteUrl = getSiteUrl();
  const redirectTo = `${siteUrl}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider.key,
    options: {
      scopes: provider.scopes,
      redirectTo,
    },
  });

  if (error || !data.url) {
    log.error(
      { providerKey: rawKey, error: error?.message, action: "oauth-sign-in" },
      "signInWithOAuth failed"
    );
    return err("SERVER", "Unable to start OAuth sign-in");
  }

  return ok({ redirectUrl: data.url });
}

export async function runLinkProvider(
  rawKey: string
): Promise<LinkProviderResult> {
  if (!isProviderKey(rawKey)) {
    return err("PROVIDER_UNAVAILABLE", "Unknown provider");
  }
  const provider = getProvider(rawKey);

  if (!provider.isAvailable()) {
    return err("PROVIDER_UNAVAILABLE", "This provider is not configured");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("NOT_AUTHENTICATED", "You must be signed in to link accounts");
  }

  const siteUrl = getSiteUrl();
  // Route through /auth/callback so exchangeCodeForSession runs. Skipping the
  // callback would drop us on /settings with a stray `code` param and no code
  // exchange, so the link would never actually persist.
  const redirectTo = `${siteUrl}/auth/callback?next=/settings`;

  const { data, error } = await supabase.auth.linkIdentity({
    provider: provider.key,
    options: {
      scopes: provider.scopes,
      redirectTo,
    },
  });

  if (error || !data.url) {
    log.error(
      {
        userId: user.id,
        providerKey: rawKey,
        error: error?.message,
        action: "oauth-link",
      },
      "linkIdentity failed"
    );
    return err("SERVER", "Unable to start account linking");
  }

  return ok({ redirectUrl: data.url });
}

export async function runUnlinkProvider(
  rawKey: string
): Promise<UnlinkProviderResult> {
  if (!isProviderKey(rawKey)) {
    return err("PROVIDER_UNAVAILABLE", "Unknown provider");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("NOT_AUTHENTICATED", "You must be signed in");
  }

  const { data: identitiesData, error: identitiesError } =
    await supabase.auth.getUserIdentities();

  if (identitiesError) {
    log.error(
      {
        userId: user.id,
        error: identitiesError.message,
        action: "oauth-unlink",
      },
      "getUserIdentities failed"
    );
    return err("SERVER", "Unable to load your linked accounts");
  }

  const check = canUnlinkIdentity(identitiesData.identities, rawKey);

  if (!check.ok) {
    if (check.reason === "ONLY_IDENTITY") {
      return err(
        "ONLY_IDENTITY",
        "Add a password or another provider before disconnecting this one"
      );
    }
    return err("NOT_LINKED", "This provider is not linked to your account");
  }

  const { error: unlinkError } = await supabase.auth.unlinkIdentity(
    check.identity
  );

  if (unlinkError) {
    log.error(
      {
        userId: user.id,
        providerKey: rawKey,
        error: unlinkError.message,
        action: "oauth-unlink",
      },
      "unlinkIdentity failed"
    );
    return err("SERVER", "Unable to disconnect this provider");
  }

  log.info(
    { userId: user.id, providerKey: rawKey, action: "oauth-unlink" },
    "Provider unlinked successfully"
  );

  return ok(undefined);
}

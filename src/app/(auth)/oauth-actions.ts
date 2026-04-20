"use server";

import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { type Result, ok, err } from "~/lib/result";
import { getSiteUrl } from "~/lib/url";
import { log } from "~/lib/logger";
import { getProvider, providers, type ProviderKey } from "~/lib/auth/providers";
import { canUnlinkIdentity } from "~/lib/auth/identity-guards";

export type SignInWithProviderResult = Result<
  void,
  "PROVIDER_UNAVAILABLE" | "SERVER"
>;

export type LinkProviderResult = Result<
  void,
  "PROVIDER_UNAVAILABLE" | "NOT_AUTHENTICATED" | "SERVER"
>;

export type UnlinkProviderResult = Result<
  void,
  "NOT_AUTHENTICATED" | "ONLY_IDENTITY" | "NOT_LINKED" | "SERVER"
>;

function isProviderKey(value: string): value is ProviderKey {
  return value in providers;
}

/**
 * Initiates OAuth sign-in for a provider (anonymous → authenticated).
 *
 * Wraps `supabase.auth.signInWithOAuth`. Supabase returns a redirect URL;
 * this action throws a Next.js redirect to that URL. The provider redirects
 * back to `/auth/callback?code=...` which the existing callback route handles.
 *
 * Called from the login and signup forms.
 */
export async function signInWithProviderAction(
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

  redirect(data.url);
}

/**
 * Adds a provider identity to the currently logged-in user.
 *
 * Wraps `supabase.auth.linkIdentity()`. Requires
 * `enable_manual_linking = true` in `supabase/config.toml.template`.
 *
 * Called from Connected Accounts settings section.
 */
export async function linkProviderAction(
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
  const redirectTo = `${siteUrl}/settings`;

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

  redirect(data.url);
}

/**
 * Removes a provider identity from the current user.
 *
 * Enforces the invariant that a user always retains ≥1 identity
 * (otherwise they lose all login methods and are locked out).
 *
 * Called from Connected Accounts settings section.
 */
export async function unlinkProviderAction(
  rawKey: string
): Promise<UnlinkProviderResult> {
  if (!isProviderKey(rawKey)) {
    return err("NOT_LINKED", "Unknown provider");
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

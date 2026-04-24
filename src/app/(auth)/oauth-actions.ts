"use server";

import { redirect } from "next/navigation";
import {
  runSignInWithProvider,
  runLinkProvider,
  runUnlinkProvider,
} from "./oauth-actions-core";

export type {
  SignInWithProviderResult,
  LinkProviderResult,
  UnlinkProviderResult,
} from "./oauth-actions-core";

/**
 * Initiates OAuth sign-in for a provider (anonymous → authenticated).
 *
 * Wraps `supabase.auth.signInWithOAuth` via the internal core. On success,
 * redirects to the provider authorize URL; on failure, redirects back to
 * `/login?oauth_error=<code>` so the login page can surface the problem.
 *
 * Bound as a `<form action>` on login and signup pages (bind the provider
 * key as the first argument so FormData can be the second argument).
 */
export async function signInWithProviderAction(rawKey: string): Promise<void> {
  const result = await runSignInWithProvider(rawKey);
  if (!result.ok) {
    redirect(`/login?oauth_error=${encodeURIComponent(result.code)}`);
  }
  redirect(result.value.redirectUrl);
}

/**
 * Adds a provider identity to the currently logged-in user.
 *
 * Wraps `supabase.auth.linkIdentity()`. Requires `enable_manual_linking = true`
 * in `supabase/config.toml.template`. On failure redirects to
 * `/settings?oauth_error=<code>`.
 *
 * Bound as a `<form action>` in Connected Accounts settings.
 */
export async function linkProviderAction(rawKey: string): Promise<void> {
  const result = await runLinkProvider(rawKey);
  if (!result.ok) {
    redirect(`/settings?oauth_error=${encodeURIComponent(result.code)}`);
  }
  redirect(result.value.redirectUrl);
}

/**
 * Removes a provider identity from the current user.
 *
 * Enforces the invariant that a user always retains ≥1 identity. On failure
 * redirects to `/settings?oauth_error=<code>`; on success redirects to
 * `/settings?oauth_status=unlinked` so the page can flash a confirmation.
 *
 * Bound as a `<form action>` in Connected Accounts settings.
 */
export async function unlinkProviderAction(rawKey: string): Promise<void> {
  const result = await runUnlinkProvider(rawKey);
  if (!result.ok) {
    redirect(`/settings?oauth_error=${encodeURIComponent(result.code)}`);
  }
  redirect(`/settings?oauth_status=unlinked`);
}

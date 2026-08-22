"use client";

import {
  COOKIE_CONSENT_KEY,
  LAST_ISSUES_PATH_KEY,
  CHANGELOG_SEEN_KEY,
  PREFERENCE_MAX_AGE_SECONDS,
} from "./constants";

/**
 * Sets a cookie on the client side (synchronous).
 * The cookie will be immediately available for the next server request.
 */
function setClientCookie(name: string, value: string, maxAge: number): void {
  // `window?.location` is NOT an equivalent rewrite: `?.` guards a nullish
  // *value*, not an undeclared *binding*. Under SSR `window` is undeclared, so
  // the optional chain would still throw a ReferenceError. typescript-eslint
  // knows this and stays quiet; oxlint doesn't, so it is silenced here rather
  // than dropped from the mirror wholesale. Block form because the expression
  // wraps onto a continuation line and `-next-line` would miss it. (PP-4zcj.)
  /* oxlint-disable typescript/prefer-optional-chain -- `window?.location` would still ReferenceError under SSR; see the note above */
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:";
  /* oxlint-enable typescript/prefer-optional-chain -- end of the SSR-guard expression */
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/**
 * Stores the last issues path in a cookie (client-side, synchronous).
 * This is faster than a server action and ensures the cookie is
 * available immediately for the next navigation.
 */
export function storeLastIssuesPath(path: string): void {
  setClientCookie(LAST_ISSUES_PATH_KEY, path, PREFERENCE_MAX_AGE_SECONDS);
}

/**
 * Stores the number of changelog entries the user has seen (client-side, synchronous).
 * Called when the user visits the What's New page to clear the badge.
 */
export function storeChangelogSeen(count: number): void {
  setClientCookie(
    CHANGELOG_SEEN_KEY,
    count.toString(),
    PREFERENCE_MAX_AGE_SECONDS
  );
}

/** Stores cookie consent acknowledgment (client-side). */
export function storeCookieConsent(): void {
  setClientCookie(COOKIE_CONSENT_KEY, "true", PREFERENCE_MAX_AGE_SECONDS);
}

/** Checks if user has already acknowledged cookie consent. */
export function hasCookieConsent(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split("; ")
    .some((c) => c.startsWith(`${COOKIE_CONSENT_KEY}=`));
}

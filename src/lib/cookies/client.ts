"use client";

import {
  COOKIE_CONSENT_KEY,
  LAST_ISSUES_PATH_KEY,
  SIDEBAR_COLLAPSED_KEY,
  CHANGELOG_SEEN_KEY,
  PREFERENCE_MAX_AGE_SECONDS,
} from "./constants";

/**
 * Sets a cookie on the client side (synchronous).
 * The cookie will be immediately available for the next server request.
 */
function setClientCookie(name: string, value: string, maxAge: number): void {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:";
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
 * Stores the sidebar collapsed state in a cookie (client-side, synchronous).
 */
export function storeSidebarCollapsed(collapsed: boolean): void {
  setClientCookie(
    SIDEBAR_COLLAPSED_KEY,
    collapsed.toString(),
    PREFERENCE_MAX_AGE_SECONDS
  );
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

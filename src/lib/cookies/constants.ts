/**
 * Shared constants for cookie utilities.
 * Used by both client-side and server-side cookie functions.
 */

export const LAST_ISSUES_PATH_KEY = "lastIssuesPath";
export const SIDEBAR_COLLAPSED_KEY = "sidebarCollapsed";
export const CHANGELOG_SEEN_KEY = "changelogSeen";
export const DEFAULT_ISSUES_PATH = "/issues";

export const COOKIE_CONSENT_KEY = "cookieConsent";

/**
 * Enables the cookie banner for environments where it is normally gated (Dev/Preview/E2E).
 * Note: This does NOT override an existing `cookieConsent=true` value; the
 * client banner component may still hide itself based on that cookie.
 */
export const DEV_SHOW_COOKIE_BANNER_KEY = "devShowCookieBanner";

/**
 * @deprecated Use DEV_SHOW_COOKIE_BANNER_KEY instead.
 */
export const ENABLE_COOKIE_BANNER_OVERRIDE_KEY = DEV_SHOW_COOKIE_BANNER_KEY;

/**
 * @deprecated Use DEV_SHOW_COOKIE_BANNER_KEY instead.
 */
export const FORCE_SHOW_COOKIE_BANNER_KEY = DEV_SHOW_COOKIE_BANNER_KEY;

/** Cookie lifetime: 1 year in seconds */
export const PREFERENCE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

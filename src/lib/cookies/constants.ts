/**
 * Shared constants for cookie utilities.
 * Used by both client-side and server-side cookie functions.
 */

export const LAST_ISSUES_PATH_KEY = "lastIssuesPath";
export const SIDEBAR_COLLAPSED_KEY = "sidebarCollapsed";
export const CHANGELOG_SEEN_KEY = "changelogSeen";
export const DEFAULT_ISSUES_PATH = "/issues";

/** Cookie lifetime: 1 year in seconds */
export const PREFERENCE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

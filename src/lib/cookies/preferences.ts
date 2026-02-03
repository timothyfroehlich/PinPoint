import { cookies } from "next/headers";

const LAST_ISSUES_PATH_KEY = "lastIssuesPath";
const DEFAULT_ISSUES_PATH = "/issues";

const SIDEBAR_COLLAPSED_KEY = "sidebarCollapsed";

/**
 * Cookie options for user preferences.
 * Non-httpOnly so they can be read on both server and client.
 */
const PREFERENCE_COOKIE_OPTIONS = {
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365, // 1 year
};

/**
 * Reads the last issues path from cookies (server-side).
 * Returns the stored path or default "/issues".
 */
export async function getLastIssuesPath(): Promise<string> {
  const cookieStore = await cookies();
  const stored = cookieStore.get(LAST_ISSUES_PATH_KEY);
  return stored?.value ?? DEFAULT_ISSUES_PATH;
}

/**
 * Sets the last issues path cookie (server-side, for use in server actions).
 */
export async function setLastIssuesPathCookie(path: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LAST_ISSUES_PATH_KEY, path, PREFERENCE_COOKIE_OPTIONS);
}

/**
 * Reads the sidebar collapsed state from cookies (server-side).
 * Returns true if collapsed, false otherwise.
 */
export async function getSidebarCollapsed(): Promise<boolean> {
  const cookieStore = await cookies();
  const stored = cookieStore.get(SIDEBAR_COLLAPSED_KEY);
  return stored?.value === "true";
}

/**
 * Sets the sidebar collapsed cookie (server-side, for use in server actions).
 */
export async function setSidebarCollapsedCookie(
  collapsed: boolean
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(
    SIDEBAR_COLLAPSED_KEY,
    collapsed.toString(),
    PREFERENCE_COOKIE_OPTIONS
  );
}

/**
 * Builds a login URL that redirects back to the given path after authentication.
 * Centralizes the login redirect pattern to prevent parameter name drift.
 *
 * This lives in its own file (separate from url.ts) because url.ts imports
 * the logger which uses Node.js 'fs' — making it unsafe for client components.
 */
export function getLoginUrl(returnTo: string): string {
  return `/login?next=${encodeURIComponent(returnTo)}`;
}

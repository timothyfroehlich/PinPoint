/**
 * Returning to a list (spec list-views.md §11). Within one browser tab
 * session the app navigation reopens the last View Configuration and page a
 * List Host showed; sessionStorage is per tab and ends with the session, so a
 * new session opens the list as §10.10 describes (§11.2). Storage can be
 * unavailable (private mode, blocked site data); every read and write
 * tolerates that, and the plain list path is the fallback.
 */

const KEY_PREFIX = "pinpoint:list-return:";

/** Dispatched on `window` whenever a list's remembered URL changes. */
export const LIST_RETURN_EVENT = "pinpoint:list-return";

/** Remembers `url` (path plus query) as the last URL of the list at `listPath`. */
export function rememberListUrl(listPath: string, url: string): void {
  try {
    window.sessionStorage.setItem(`${KEY_PREFIX}${listPath}`, url);
  } catch {
    // Without storage, returning opens the list's own default.
    return;
  }
  window.dispatchEvent(new Event(LIST_RETURN_EVENT));
}

/**
 * The URL app navigation should open for the list at `listPath`: the last one
 * this tab session used there, or null. Only same-list URLs are returned, so
 * a stored value can never send the person anywhere else.
 */
export function readListUrl(listPath: string): string | null {
  let stored: string | null;
  try {
    stored = window.sessionStorage.getItem(`${KEY_PREFIX}${listPath}`);
  } catch {
    return null;
  }
  if (stored === null) return null;
  return stored === listPath || stored.startsWith(`${listPath}?`)
    ? stored
    : null;
}

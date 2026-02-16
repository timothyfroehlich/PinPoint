const INTERNAL_DOMAIN = "pinpoint.internal";

/** Check if an email belongs to an admin-created username-only account. */
export function isInternalAccount(email: string): boolean {
  return email.endsWith(`@${INTERNAL_DOMAIN}`);
}

/** Convert a plain username to its internal email representation. */
export function usernameToInternalEmail(username: string): string {
  return `${username}@${INTERNAL_DOMAIN}`;
}

/**
 * PII masking helpers for log output.
 *
 * Established precedent is call-site masking: mask the value where it is
 * logged rather than relying on a global log redactor. Keeps recipient /
 * account PII out of logs while retaining just enough of a prefix to
 * correlate entries during debugging.
 */

/**
 * Mask an email address for logging: keep the first (up to) three characters
 * and replace the remainder with `***`.
 *
 * Handles short and empty strings gracefully — an empty string yields `"***"`.
 */
export function maskEmail(email: string): string {
  return email.slice(0, 3) + "***";
}

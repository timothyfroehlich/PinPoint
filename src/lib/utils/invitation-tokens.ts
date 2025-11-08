/**
 * Invitation Token Utilities
 *
 * Secure token generation and validation for user invitations.
 * Tokens are cryptographically secure and hashed before storage.
 */

import { createHash, randomBytes } from 'crypto';

/**
 * Generate a secure invitation token
 *
 * @returns Object with plain token (for email link) and hash (for database storage)
 */
export function generateInvitationToken(): { token: string; hash: string } {
  // Generate 32 bytes of random data (256 bits)
  const token = randomBytes(32).toString('base64url');

  // Hash the token for database storage (one-way hash)
  const hash = createHash('sha256').update(token).digest('hex');

  return { token, hash };
}

/**
 * Hash a plain token for comparison with stored hash
 *
 * @param token - Plain text token from invitation link
 * @returns SHA-256 hash of the token
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Validate token format (base64url encoded)
 *
 * @param token - Token to validate
 * @returns True if token format is valid
 */
export function isValidTokenFormat(token: string): boolean {
  // base64url uses only: A-Z, a-z, 0-9, -, _
  const base64urlRegex = /^[A-Za-z0-9_-]+$/;
  return base64urlRegex.test(token) && token.length >= 32;
}

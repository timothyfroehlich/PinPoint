/**
 * Tests for Invitation Token Utilities
 *
 * Security-critical tests for token generation, hashing, and validation.
 * These tokens are used for user invitations and must be cryptographically secure.
 */

import { describe, it, expect } from 'vitest';
import {
  generateInvitationToken,
  hashToken,
  isValidTokenFormat,
} from '../invitation-tokens';

describe('generateInvitationToken', () => {
  it('should generate a token with minimum 32 characters', () => {
    const { token } = generateInvitationToken();

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThanOrEqual(32);
  });

  it('should generate unique tokens on each call', () => {
    const tokens = new Set<string>();
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const { token } = generateInvitationToken();
      tokens.add(token);
    }

    expect(tokens.size).toBe(iterations);
  });

  it('should return both token and hash', () => {
    const result = generateInvitationToken();

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('hash');
    expect(typeof result.token).toBe('string');
    expect(typeof result.hash).toBe('string');
  });

  it('should generate hash that matches token when hashed', () => {
    const { token, hash } = generateInvitationToken();
    const recomputedHash = hashToken(token);

    expect(hash).toBe(recomputedHash);
  });

  it('should generate valid base64url encoded tokens', () => {
    const { token } = generateInvitationToken();

    // base64url uses only: A-Z, a-z, 0-9, -, _
    // Should NOT contain: +, /, =
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token).not.toContain('+');
    expect(token).not.toContain('/');
    expect(token).not.toContain('=');
  });

  it('should generate SHA-256 hash (64 hex characters)', () => {
    const { hash } = generateInvitationToken();

    // SHA-256 produces 32 bytes = 64 hex characters
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should generate cryptographically random tokens', () => {
    // Statistical test: check that tokens have good entropy
    const { token } = generateInvitationToken();
    const chars = token.split('');
    const uniqueChars = new Set(chars);

    // With 32+ bytes of random data, we should see good character diversity
    // Expect at least 20 unique characters in a 43+ character token
    expect(uniqueChars.size).toBeGreaterThanOrEqual(20);
  });

  it('should generate different hashes for different tokens', () => {
    const result1 = generateInvitationToken();
    const result2 = generateInvitationToken();

    expect(result1.token).not.toBe(result2.token);
    expect(result1.hash).not.toBe(result2.hash);
  });
});

describe('hashToken', () => {
  it('should produce consistent SHA-256 hashes', () => {
    const token = 'test-token-12345';

    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    const hash3 = hashToken(token);

    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });

  it('should produce different hashes for different tokens', () => {
    const token1 = 'token-one';
    const token2 = 'token-two';

    const hash1 = hashToken(token1);
    const hash2 = hashToken(token2);

    expect(hash1).not.toBe(hash2);
  });

  it('should produce 64-character hex string (SHA-256)', () => {
    const token = 'any-token';
    const hash = hashToken(token);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should be case-sensitive', () => {
    const hash1 = hashToken('Token');
    const hash2 = hashToken('token');

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty strings', () => {
    const hash = hashToken('');

    // SHA-256 of empty string is a valid hash
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should match hash from generateInvitationToken', () => {
    const { token, hash } = generateInvitationToken();
    const recomputedHash = hashToken(token);

    expect(hash).toBe(recomputedHash);
  });

  it('should produce one-way hash (non-reversible)', () => {
    // This is a conceptual test - we verify hash properties
    const token = generateInvitationToken().token;
    const hash = hashToken(token);

    // Hash should not contain the original token
    expect(hash).not.toContain(token);
    // Hash should be different length than token
    expect(hash.length).not.toBe(token.length);
  });
});

describe('isValidTokenFormat', () => {
  it('should accept valid base64url tokens', () => {
    const validTokens = [
      'abcdefghijklmnopqrstuvwxyzABCDEF', // 32 chars, letters
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456', // 32 chars, mixed
      '1234567890-_ABCDEFGHIJKLMNOPQRST', // 32 chars, with - and _
      'a'.repeat(32), // Exactly 32 chars
      'a'.repeat(50), // More than 32 chars
    ];

    validTokens.forEach((token) => {
      expect(isValidTokenFormat(token)).toBe(true);
    });
  });

  it('should accept tokens generated by generateInvitationToken', () => {
    const { token } = generateInvitationToken();

    expect(isValidTokenFormat(token)).toBe(true);
  });

  it('should reject tokens shorter than 32 characters', () => {
    const shortTokens = [
      '', // Empty
      'a', // 1 char
      'abcdefghij', // 10 chars
      'abcdefghijklmnopqrstuvwxyzABCD', // 31 chars (one short!)
    ];

    shortTokens.forEach((token) => {
      expect(isValidTokenFormat(token)).toBe(false);
    });
  });

  it('should reject tokens with invalid characters', () => {
    const invalidTokens = [
      'abcdefghijklmnopqrstuvwxyz+ABCDEF', // Contains +
      'abcdefghijklmnopqrstuvwxyz/ABCDEF', // Contains /
      'abcdefghijklmnopqrstuvwxyz=ABCDEF', // Contains =
      'abcdefghijklmnopqrstuvwxyz ABCDEF', // Contains space
      'abcdefghijklmnopqrstuvwxyz!ABCDEF', // Contains !
      'abcdefghijklmnopqrstuvwxyz@ABCDEF', // Contains @
      'abcdefghijklmnopqrstuvwxyz#ABCDEF', // Contains #
      'abcdefghijklmnopqrstuvwxyz$ABCDEF', // Contains $
    ];

    invalidTokens.forEach((token) => {
      expect(isValidTokenFormat(token)).toBe(false);
    });
  });

  it('should only accept base64url character set', () => {
    // Valid: A-Z, a-z, 0-9, -, _
    const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const token = validChars.slice(0, 32);

    expect(isValidTokenFormat(token)).toBe(true);

    // Invalid: base64 chars (+, /, =) should fail
    const base64Token = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ+/=ABC';
    expect(isValidTokenFormat(base64Token)).toBe(false);
  });

  it('should handle special edge cases', () => {
    // All dashes and underscores (valid base64url chars)
    expect(isValidTokenFormat('-'.repeat(32))).toBe(true);
    expect(isValidTokenFormat('_'.repeat(32))).toBe(true);

    // All numbers
    expect(isValidTokenFormat('0'.repeat(32))).toBe(true);

    // Mixed valid chars
    expect(isValidTokenFormat('aA0-_'.repeat(7) + 'aA0-_aa')).toBe(true);
  });

  it('should be strict about length requirement', () => {
    // Exactly 31 chars should fail
    expect(isValidTokenFormat('a'.repeat(31))).toBe(false);

    // Exactly 32 chars should pass
    expect(isValidTokenFormat('a'.repeat(32))).toBe(true);

    // 33+ chars should pass
    expect(isValidTokenFormat('a'.repeat(33))).toBe(true);
    expect(isValidTokenFormat('a'.repeat(100))).toBe(true);
  });
});

describe('Token Security Integration', () => {
  it('should create tokens that pass validation', () => {
    for (let i = 0; i < 10; i++) {
      const { token } = generateInvitationToken();
      expect(isValidTokenFormat(token)).toBe(true);
    }
  });

  it('should create tokens suitable for URL use (base64url)', () => {
    const { token } = generateInvitationToken();

    // Should be safe for URLs without encoding
    const encoded = encodeURIComponent(token);
    expect(encoded).toBe(token); // No encoding needed
  });

  it('should maintain hash consistency across token lifecycle', () => {
    // Simulate token lifecycle: generate -> store hash -> validate later
    const { token, hash } = generateInvitationToken();

    // Store hash (database storage)
    const storedHash = hash;

    // Later: user clicks link with token, we hash it to compare
    const tokenFromUrl = token;
    const recomputedHash = hashToken(tokenFromUrl);

    // Should match stored hash
    expect(recomputedHash).toBe(storedHash);
  });

  it('should create collision-resistant tokens', () => {
    // Generate many tokens and verify no hash collisions
    const hashes = new Set<string>();
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      const { hash } = generateInvitationToken();
      hashes.add(hash);
    }

    // All hashes should be unique (no collisions)
    expect(hashes.size).toBe(iterations);
  });

  it('should not reveal token from hash', () => {
    const { token, hash } = generateInvitationToken();

    // Hash should not contain any substring of token
    const tokenChunks = [
      token.slice(0, 8),
      token.slice(8, 16),
      token.slice(-8),
    ];

    tokenChunks.forEach((chunk) => {
      expect(hash.toLowerCase()).not.toContain(chunk.toLowerCase());
    });
  });
});

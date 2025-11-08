/**
 * Tests for Resend Email Service
 *
 * Tests for sending invitation emails with proper error handling,
 * template rendering, and integration with the Resend API.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendInvitationEmail } from '../resend';
import type { InvitationEmailParams } from '../resend';

// Create mock send function that will be shared
const mockSend = vi.fn();

// Mock the Resend package
vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      constructor(_apiKey?: string) {
        // Constructor can accept api key but we ignore it in tests
      }

      get emails() {
        return {
          send: mockSend,
        };
      }
    },
  };
});

// Mock environment variables
vi.mock('~/env', () => ({
  env: {
    RESEND_API_KEY: 'test-api-key',
    INVITATION_FROM_EMAIL: 'test@pinpoint.test',
    INVITATION_FROM_NAME: 'PinPoint Test',
    NEXT_PUBLIC_BASE_URL: 'https://test.pinpoint.app',
  },
}));

describe('sendInvitationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createTestParams = (
    overrides?: Partial<InvitationEmailParams>,
  ): InvitationEmailParams => ({
    to: 'user@example.com',
    organizationName: 'Test Organization',
    inviterName: 'John Doe',
    roleName: 'Member',
    token: 'abc123def456ghi789jkl012mno345pq',
    expiresAt: new Date('2025-12-31T23:59:59Z'),
    ...overrides,
  });

  describe('Successful Email Sending', () => {
    it('should send email successfully and return success result', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg_123456' },
        error: null,
      });

      const params = createTestParams();
      const result = await sendInvitationEmail(params);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg_123456');
      expect(result.error).toBeUndefined();
    });

    it('should call Resend with correct parameters', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg_123456' },
        error: null,
      });

      const params = createTestParams();
      await sendInvitationEmail(params);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'PinPoint Test <test@pinpoint.test>',
          to: 'user@example.com',
          subject:
            "You've been invited to join Test Organization on PinPoint",
        }),
      );
    });

    it('should include both HTML and text versions of email', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg_123456' },
        error: null,
      });

      const params = createTestParams();
      await sendInvitationEmail(params);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toBeDefined();
      expect(call.text).toBeDefined();
      expect(typeof call.html).toBe('string');
      expect(typeof call.text).toBe('string');
    });

    it('should construct correct acceptance URL with token', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg_123456' },
        error: null,
      });

      const params = createTestParams({
        token: 'test-token-12345',
      });
      await sendInvitationEmail(params);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain(
        'https://test.pinpoint.app/auth/accept-invitation/test-token-12345',
      );
      expect(call.text).toContain(
        'https://test.pinpoint.app/auth/accept-invitation/test-token-12345',
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle Resend API errors gracefully', async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: {
          message: 'API rate limit exceeded',
          name: 'rate_limit_exceeded',
        },
      });

      const params = createTestParams();
      const result = await sendInvitationEmail(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API rate limit exceeded');
      expect(result.messageId).toBeUndefined();
    });

    it('should handle network exceptions', async () => {
      mockSend.mockRejectedValue(new Error('Network error'));

      const params = createTestParams();
      const result = await sendInvitationEmail(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle unknown errors', async () => {
      mockSend.mockRejectedValue('Unknown error type');

      const params = createTestParams();
      const result = await sendInvitationEmail(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should handle Resend error without message', async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: {
          name: 'unknown_error',
        },
      });

      const params = createTestParams();
      const result = await sendInvitationEmail(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown email error');
    });
  });

  describe('Email Content', () => {
    beforeEach(() => {
      mockSend.mockResolvedValue({
        data: { id: 'msg_123456' },
        error: null,
      });
    });

    it('should include organization name in email', async () => {
      const params = createTestParams({
        organizationName: 'Acme Corporation',
      });
      await sendInvitationEmail(params);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('Acme Corporation');
      expect(call.text).toContain('Acme Corporation');
      expect(call.subject).toContain('Acme Corporation');
    });

    it('should include inviter name in email', async () => {
      const params = createTestParams({
        inviterName: 'Jane Smith',
      });
      await sendInvitationEmail(params);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('Jane Smith');
      expect(call.text).toContain('Jane Smith');
    });

    it('should include role name in email', async () => {
      const params = createTestParams({
        roleName: 'Admin',
      });
      await sendInvitationEmail(params);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('Admin');
      expect(call.text).toContain('Admin');
    });

    it('should include formatted expiration date', async () => {
      const params = createTestParams({
        expiresAt: new Date('2025-12-25T00:00:00Z'),
      });
      await sendInvitationEmail(params);

      const call = mockSend.mock.calls[0][0];
      // Date should be formatted as "Thursday, December 25, 2025"
      expect(call.html).toContain('December');
      expect(call.html).toContain('2025');
      expect(call.text).toContain('December');
      expect(call.text).toContain('2025');
    });

    it('should include personal message when provided', async () => {
      const params = createTestParams({
        personalMessage: 'Welcome to our team! Looking forward to working with you.',
      });
      await sendInvitationEmail(params);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain(
        'Welcome to our team! Looking forward to working with you.',
      );
      expect(call.text).toContain(
        'Welcome to our team! Looking forward to working with you.',
      );
    });

    it('should work without personal message', async () => {
      const params = createTestParams({
        personalMessage: undefined,
      });
      await sendInvitationEmail(params);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toBeDefined();
      expect(call.text).toBeDefined();
      // Should not have the personal message section
      expect(call.html).not.toContain('Personal message');
    });

    it('should escape HTML in personal message', async () => {
      const params = createTestParams({
        personalMessage: '<script>alert("xss")</script>',
      });
      await sendInvitationEmail(params);

      const call = mockSend.mock.calls[0][0];
      // HTML should be escaped in the HTML email
      // Note: This test assumes the implementation escapes HTML.
      // If it doesn't, this is a security issue that should be fixed.
      expect(call.html).not.toContain('<script>');
    });
  });

  describe('Email Template Structure', () => {
    beforeEach(() => {
      mockSend.mockResolvedValue({
        data: { id: 'msg_123456' },
        error: null,
      });
    });

    it('should have valid HTML email structure', async () => {
      const params = createTestParams();
      await sendInvitationEmail(params);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('<!DOCTYPE html>');
      expect(call.html).toContain('<html');
      expect(call.html).toContain('</html>');
      expect(call.html).toContain('<body');
      expect(call.html).toContain('</body>');
    });

    it('should include CTA button in HTML', async () => {
      const params = createTestParams();
      await sendInvitationEmail(params);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('Accept Invitation');
    });

    it('should include fallback URL in HTML footer', async () => {
      const params = createTestParams();
      await sendInvitationEmail(params);

      const call = mockSend.mock.calls[0][0];
      // Should have fallback link for email clients that don't support buttons
      const tokenInUrl = params.token;
      expect(call.html).toContain(tokenInUrl);
    });

    it('should have plain text version with acceptance URL', async () => {
      const params = createTestParams();
      await sendInvitationEmail(params);

      const call = mockSend.mock.calls[0][0];
      expect(call.text).toContain('Accept your invitation:');
      expect(call.text).toContain(
        'https://test.pinpoint.app/auth/accept-invitation/',
      );
    });

    it('should have consistent information in both HTML and text', async () => {
      const params = createTestParams();
      await sendInvitationEmail(params);

      const call = mockSend.mock.calls[0][0];

      // Both should mention the organization
      expect(call.html).toContain(params.organizationName);
      expect(call.text).toContain(params.organizationName);

      // Both should mention the inviter
      expect(call.html).toContain(params.inviterName);
      expect(call.text).toContain(params.inviterName);

      // Both should mention the role
      expect(call.html).toContain(params.roleName);
      expect(call.text).toContain(params.roleName);
    });
  });

  describe('Integration', () => {
    it('should use environment variables for sender', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg_123456' },
        error: null,
      });

      const params = createTestParams();
      await sendInvitationEmail(params);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'PinPoint Test <test@pinpoint.test>',
        }),
      );
    });

    it('should use environment variable for base URL', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg_123456' },
        error: null,
      });

      const params = createTestParams();
      await sendInvitationEmail(params);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('https://test.pinpoint.app/auth/accept-invitation/');
    });

    it('should handle concurrent email sends', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg_123456' },
        error: null,
      });

      const params1 = createTestParams({ to: 'user1@example.com' });
      const params2 = createTestParams({ to: 'user2@example.com' });
      const params3 = createTestParams({ to: 'user3@example.com' });

      const results = await Promise.all([
        sendInvitationEmail(params1),
        sendInvitationEmail(params2),
        sendInvitationEmail(params3),
      ]);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockSend.mockResolvedValue({
        data: { id: 'msg_123456' },
        error: null,
      });
    });

    it('should handle very long organization names', async () => {
      const params = createTestParams({
        organizationName: 'A'.repeat(200),
      });
      const result = await sendInvitationEmail(params);

      expect(result.success).toBe(true);
    });

    it('should handle special characters in names', async () => {
      const params = createTestParams({
        organizationName: "O'Reilly & Associates",
        inviterName: 'José García-López',
      });
      const result = await sendInvitationEmail(params);

      expect(result.success).toBe(true);
      const call = mockSend.mock.calls[0][0];
      // HTML should be properly escaped
      expect(call.html).toContain('O&#039;Reilly &amp; Associates');
      // Non-ASCII characters should pass through (UTF-8 is safe in HTML)
      expect(call.html).toContain('José García-López');
    });

    it('should handle international email addresses', async () => {
      const params = createTestParams({
        to: 'user@münchen.de',
      });
      const result = await sendInvitationEmail(params);

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@münchen.de',
        }),
      );
    });

    it('should handle tokens with URL-safe characters', async () => {
      const params = createTestParams({
        token: 'abc-123_def-456_ghi-789_jkl-012',
      });
      const result = await sendInvitationEmail(params);

      expect(result.success).toBe(true);
      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('abc-123_def-456_ghi-789_jkl-012');
    });
  });
});

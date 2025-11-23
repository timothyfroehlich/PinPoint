import { describe, it, expect } from "vitest";

/**
 * Unit tests for brittle Mailpit utility code
 *
 * Background: These utilities handle regex extraction and HTML entity decoding
 * for password reset emails. The regex patterns are brittle and need unit tests
 * to prevent regressions.
 *
 * These tests extract the core logic from mailpit.ts for unit testing without
 * requiring a full E2E test environment.
 */

// Extract the regex from actual implementation (mailpit.ts line 123)
const PASSWORD_RESET_LINK_REGEX = /href="([^"]*\/auth\/v1\/verify[^"]*)"/i;

/**
 * Decode HTML entities found in Supabase email links
 *
 * Matches the implementation in mailpit.ts (lines 128-133)
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'"); // Note: Implementation uses &#39;, not &#x3D;
}

/**
 * Extract password reset link from HTML body
 *
 * Simplified version of getPasswordResetLink() for unit testing
 */
function extractPasswordResetLink(htmlBody: string): string | null {
  const match = PASSWORD_RESET_LINK_REGEX.exec(htmlBody);
  if (!match?.[1]) return null;
  return decodeHtmlEntities(match[1]);
}

describe("extractPasswordResetLink", () => {
  it("should extract valid Supabase password reset link from HTML", () => {
    // Realistic Supabase password reset email HTML structure
    const htmlBody = `
      <html>
        <body>
          <p>Reset your password:</p>
          <a href="http://localhost:54321/auth/v1/verify?token=abc123&amp;type=recovery&amp;redirect_to=http://localhost:3000/reset-password">
            Reset Password
          </a>
        </body>
      </html>
    `;

    const link = extractPasswordResetLink(htmlBody);

    expect(link).toBeTruthy();
    expect(link).toContain("auth/v1/verify");
    expect(link).toContain("type=recovery");
    expect(link).toContain("redirect_to=");
    expect(link).not.toContain("&amp;"); // Should be decoded to &
  });

  it("should return null when no reset link in HTML", () => {
    const htmlBody = `
      <html>
        <body>
          <p>This is a different email with no reset link.</p>
          <a href="http://example.com/other-link">Click here</a>
        </body>
      </html>
    `;

    const link = extractPasswordResetLink(htmlBody);

    expect(link).toBeNull();
  });

  it("should handle malformed HTML gracefully", () => {
    // Malformed HTML with unclosed tags and broken href
    const htmlBody = `
      <html>
        <body>
          <a href="broken link
          <p>Unclosed tags
    `;

    const link = extractPasswordResetLink(htmlBody);

    // Regex should not match malformed HTML
    expect(link).toBeNull();
  });
});

describe("decodeHtmlEntities", () => {
  it("should decode all common HTML entities", () => {
    // Test all 5 entities from actual implementation (lines 128-133)
    const encoded =
      "token=abc&amp;type=recovery&lt;script&gt;&quot;alert&#39;test&quot;";
    const decoded = decodeHtmlEntities(encoded);

    expect(decoded).toBe('token=abc&type=recovery<script>"alert\'test"');
    expect(decoded).toContain("&"); // &amp; -> &
    expect(decoded).toContain("<"); // &lt; -> <
    expect(decoded).toContain(">"); // &gt; -> >
    expect(decoded).toContain('"'); // &quot; -> "
    expect(decoded).toContain("'"); // &#39; -> '
  });

  it("should leave unknown entities unchanged", () => {
    // Entity not in our decode list should remain unchanged
    const text = "unknown&nbsp;entity&copy;2025";
    const decoded = decodeHtmlEntities(text);

    // &nbsp; and &copy; are not in our decode list
    expect(decoded).toBe("unknown&nbsp;entity&copy;2025");
  });
});

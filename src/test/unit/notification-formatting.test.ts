import { describe, it, expect, vi } from "vitest";
import {
  getEmailHtml,
  getEmailSubject,
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
} from "~/lib/notification-formatting";

vi.mock("~/lib/url", () => ({
  getSiteUrl: () => "http://test.com",
}));

describe("Notification Formatting", () => {
  describe("getEmailHtml", () => {
    it("should sanitize comment content to prevent XSS", () => {
      const maliciousContent =
        '<script>alert("xss")</script>Hello <img src=x onerror=alert(1)>';
      const html = getEmailHtml(
        "new_comment",
        "Test Issue",
        "Test Machine",
        "MM-01", // formattedIssueId
        maliciousContent // commentContent
      );

      // Should not contain script tags or onerror handlers
      expect(html).not.toContain("<script>");
      expect(html).not.toContain("onerror=");

      // Should still contain safe content
      expect(html).toContain("Hello");
    });

    it("should preserve safe HTML in comments", () => {
      const safeContent = "<b>Bold</b> and <i>Italic</i>";
      const html = getEmailHtml(
        "new_comment",
        "Test Issue",
        "Test Machine",
        "MM-01",
        safeContent
      );

      expect(html).toContain("<b>Bold</b>");
      expect(html).toContain("<i>Italic</i>");
    });

    it("should handle empty comment content", () => {
      const html = getEmailHtml(
        "new_comment",
        "Test Issue",
        "Test Machine",
        "MM-01",
        undefined
      );

      expect(html).toContain("<blockquote></blockquote>");
    });
  });

  describe("Issue Link Generation", () => {
    it("should generate a deep link to the specific issue in email", () => {
      const html = getEmailHtml(
        "new_issue",
        "Something is broken",
        "Twilight Zone",
        "TZ-42"
      );

      // Assert the correct link format: /m/[initials]/i/[number]
      expect(html).toContain('href="http://test.com/m/TZ/i/42"');
    });

    it("should fallback to generic link if ID is missing", () => {
      const html = getEmailHtml("new_issue", "Title", "Machine");
      expect(html).toContain('href="http://test.com/issues"');
    });

    it("should fallback to generic link for issue ID without a dash", () => {
      const html = getEmailHtml("new_issue", "Title", "Machine", "TZ42");
      expect(html).toContain('href="http://test.com/issues"');
    });

    it("should fallback to generic link for issue ID with non-numeric suffix", () => {
      const html = getEmailHtml("new_issue", "Title", "Machine", "TZ-ABC");
      expect(html).toContain('href="http://test.com/issues"');
    });

    it("should fallback to generic link for empty string issue ID", () => {
      const html = getEmailHtml("new_issue", "Title", "Machine", "");
      expect(html).toContain('href="http://test.com/issues"');
    });

    it("should fallback to generic link for issue ID with only initials", () => {
      const html = getEmailHtml("new_issue", "Title", "Machine", "TZ-");
      expect(html).toContain('href="http://test.com/issues"');
    });

    it("should fallback to generic link for issue ID with only number", () => {
      const html = getEmailHtml("new_issue", "Title", "Machine", "-42");
      expect(html).toContain('href="http://test.com/issues"');
    });

    it("should fallback to generic link for initials with invalid characters", () => {
      const html = getEmailHtml("new_issue", "Title", "Machine", "T-Z-42");
      expect(html).toContain('href="http://test.com/issues"');
    });

    it("should fallback to generic link for initials too short", () => {
      const html = getEmailHtml("new_issue", "Title", "Machine", "T-42");
      expect(html).toContain('href="http://test.com/issues"');
    });

    it("should fallback to generic link for initials too long", () => {
      const html = getEmailHtml("new_issue", "Title", "Machine", "TOOLONG-42");
      expect(html).toContain('href="http://test.com/issues"');
    });

    it("should handle valid issue IDs with numeric initials", () => {
      const html = getEmailHtml("new_issue", "Title", "Machine", "2K-42");
      expect(html).toContain('href="http://test.com/m/2K/i/42"');
    });

    it("should fall back to issues page for invalid initials", () => {
      const html = getEmailHtml("new_issue", "Title", "Machine", "A+B-42");
      expect(html).toContain('href="http://test.com/issues"');
    });
  });

  describe("Machine Ownership Changed Email", () => {
    it("should render added-as-owner body", () => {
      const html = getEmailHtml(
        "machine_ownership_changed",
        undefined,
        "Medieval Madness",
        undefined,
        undefined,
        "added"
      );
      expect(html).toContain("<strong>added</strong>");
      expect(html).toContain("Medieval Madness");
      expect(html).toContain("receive notifications for new issues");
    });

    it("should render removed-as-owner body", () => {
      const html = getEmailHtml(
        "machine_ownership_changed",
        undefined,
        "Twilight Zone",
        undefined,
        undefined,
        "removed"
      );
      expect(html).toContain("<strong>removed</strong>");
      expect(html).toContain("Twilight Zone");
      expect(html).toContain("no longer receive notifications");
    });

    it("should generate correct subject for added owner", () => {
      const subject = getEmailSubject(
        "machine_ownership_changed",
        undefined,
        "Medieval Madness",
        undefined,
        "added"
      );
      expect(subject).toBe(
        "[Medieval Madness] Ownership Update: You have been added as an owner"
      );
    });

    it("should generate correct subject for removed owner", () => {
      const subject = getEmailSubject(
        "machine_ownership_changed",
        undefined,
        "Twilight Zone",
        undefined,
        "removed"
      );
      expect(subject).toBe(
        "[Twilight Zone] Ownership Update: You have been removed as an owner"
      );
    });
  });

  describe("Email Footer", () => {
    it("should include settings link in email footer", () => {
      const html = getEmailHtml("new_issue", "Title", "Machine", "TZ-01");
      expect(html).toContain("Manage notification settings");
      expect(html).toContain('href="http://test.com/settings"');
    });

    it("should include unsubscribe link when userId and secret are provided", () => {
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-secret-key");

      const html = getEmailHtml(
        "new_issue",
        "Title",
        "Machine",
        "TZ-01",
        undefined,
        undefined,
        "user-123"
      );
      expect(html).toContain("Unsubscribe from all emails");
      expect(html).toContain("/api/unsubscribe?uid=user-123&token=");

      vi.unstubAllEnvs();
    });

    it("should not include unsubscribe link when no userId is provided", () => {
      const html = getEmailHtml("new_issue", "Title", "Machine", "TZ-01");
      expect(html).not.toContain("Unsubscribe from all emails");
    });
  });

  describe("Unsubscribe Token", () => {
    it("should generate a consistent HMAC token", () => {
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-secret");

      const token1 = generateUnsubscribeToken("user-abc");
      const token2 = generateUnsubscribeToken("user-abc");
      expect(token1).toBe(token2);
      expect(token1.length).toBe(64); // SHA-256 hex digest

      vi.unstubAllEnvs();
    });

    it("should generate different tokens for different users", () => {
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-secret");

      const token1 = generateUnsubscribeToken("user-1");
      const token2 = generateUnsubscribeToken("user-2");
      expect(token1).not.toBe(token2);

      vi.unstubAllEnvs();
    });

    it("should return empty string when no secret is configured", () => {
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
      // Need to delete the env var since empty string is falsy
      // eslint-disable-next-line @typescript-eslint/dot-notation -- dynamic key deletion
      delete process.env["SUPABASE_SERVICE_ROLE_KEY"];

      const token = generateUnsubscribeToken("user-abc");
      expect(token).toBe("");

      vi.unstubAllEnvs();
    });

    it("should verify a valid token", () => {
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-secret");

      const token = generateUnsubscribeToken("user-abc");
      expect(verifyUnsubscribeToken("user-abc", token)).toBe(true);

      vi.unstubAllEnvs();
    });

    it("should reject an invalid token", () => {
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-secret");

      expect(verifyUnsubscribeToken("user-abc", "invalid-token")).toBe(false);

      vi.unstubAllEnvs();
    });

    it("should reject a token for the wrong user", () => {
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-secret");

      const token = generateUnsubscribeToken("user-1");
      expect(verifyUnsubscribeToken("user-2", token)).toBe(false);

      vi.unstubAllEnvs();
    });
  });
});

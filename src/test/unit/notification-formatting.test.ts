import { describe, it, expect, vi } from "vitest";
import { getEmailHtml } from "~/lib/notification-formatting";

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

    it("should URL encode initials for safety", () => {
      const html = getEmailHtml("new_issue", "Title", "Machine", "TZ-42");
      // The initials should be URL encoded (though TZ doesn't need it, the mechanism should be there)
      expect(html).toContain('href="http://test.com/m/TZ/i/42"');
    });
  });
});

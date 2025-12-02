import { describe, it, expect } from "vitest";
import { getEmailHtml } from "~/lib/notification-formatting";

describe("Notification Formatting", () => {
  describe("getEmailHtml", () => {
    it("should sanitize comment content to prevent XSS", () => {
      const maliciousContent =
        '<script>alert("xss")</script>Hello <img src=x onerror=alert(1)>';
      const html = getEmailHtml(
        "new_comment",
        "Test Issue",
        "Test Machine",
        maliciousContent
      );

      // Should not contain script tags or onerror handlers
      expect(html).not.toContain("<script>");
      expect(html).not.toContain("onerror=");

      // Should still contain safe content
      expect(html).toContain("Hello");
      // DOMPurify might strip the img tag entirely if it's invalid or keep it safe
      // We mainly care that the dangerous parts are gone
    });

    it("should preserve safe HTML in comments", () => {
      const safeContent = "<b>Bold</b> and <i>Italic</i>";
      const html = getEmailHtml(
        "new_comment",
        "Test Issue",
        "Test Machine",
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
        undefined
      );

      expect(html).toContain("<blockquote></blockquote>");
    });
  });
});

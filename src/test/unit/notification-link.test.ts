import { describe, it, expect, vi } from "vitest";
import { getEmailHtml } from "~/lib/notification-formatting";

vi.mock("~/lib/url", () => ({
  getSiteUrl: () => "http://test.com",
}));

describe("Bug Reproduction: Incorrect Issue Link", () => {
  it("should generate a deep link to the specific issue in email", () => {
    const html = getEmailHtml(
      "new_issue",
      "Something is broken",
      "Twilight Zone",
      "TZ-42"
    );

    // Assert the correct link format: /m/[initials]/i/[number]
    // Currently, this will fail because it returns /issues
    expect(html).toContain('href="http://test.com/m/TZ/i/42"');
  });

  it("should fallback to generic link if ID is missing", () => {
    const html = getEmailHtml("new_issue", "Title", "Machine");
    expect(html).toContain('href="http://test.com/issues"');
  });
});

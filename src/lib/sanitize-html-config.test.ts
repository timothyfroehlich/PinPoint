import { describe, it, expect } from "vitest";
import sanitizeHtml from "sanitize-html";
import { NON_TEXT_TAGS } from "./sanitize-html-config";

describe("NON_TEXT_TAGS", () => {
  const sanitize = (dirty: string): string =>
    sanitizeHtml(dirty, {
      allowedTags: ["p", "strong"],
      nonTextTags: [...NON_TEXT_TAGS],
    });

  it("covers sanitize-html defaults plus raw-text bypass elements", () => {
    expect([...NON_TEXT_TAGS]).toEqual([
      "script",
      "style",
      "textarea",
      "option",
      "xmp",
      "noscript",
      "noembed",
      "noframes",
    ]);
  });

  it.each(["xmp", "noscript", "noembed", "noframes"])(
    "drops the text content of <%s> instead of leaving it as a re-parseable string",
    (tag) => {
      const payload = `<p>Hi</p><${tag}><script>alert(1)</script></${tag}>`;
      const cleaned = sanitize(payload);

      expect(cleaned).toContain("<p>Hi</p>");
      expect(cleaned).not.toContain("<script>");
      expect(cleaned).not.toContain("&lt;script&gt;");
      expect(cleaned).not.toContain("alert(1)");
    }
  );

  it("still drops <script> and <style> content (defaults preserved)", () => {
    expect(sanitize("<p>a</p><script>alert(1)</script>")).not.toContain(
      "alert(1)"
    );
    expect(sanitize("<p>a</p><style>body{}</style>")).not.toContain("body{}");
  });
});

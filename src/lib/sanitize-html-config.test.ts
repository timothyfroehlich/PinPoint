import { describe, it, expect } from "vitest";
import sanitizeHtml from "sanitize-html";
import { NON_TEXT_TAGS } from "./sanitize-html-config";

describe("NON_TEXT_TAGS", () => {
  const sanitize = (dirty: string): string =>
    sanitizeHtml(dirty, {
      allowedTags: ["p", "strong"],
      nonTextTags: [...NON_TEXT_TAGS],
    });

  it.each([
    "script",
    "style",
    "textarea",
    "option",
    "xmp",
    "noscript",
    "noembed",
    "noframes",
  ])(
    "drops the text content of <%s> instead of leaving it as a re-parseable string",
    (tag) => {
      const payload = `<p>Hi</p><${tag}>discard-me<script>alert(1)</script></${tag}>`;
      const cleaned = sanitize(payload);

      expect(cleaned).toBe("<p>Hi</p>");
      expect(cleaned).not.toContain("<script>");
      expect(cleaned).not.toContain("&lt;script&gt;");
      expect(cleaned).not.toContain("alert(1)");
    }
  );
});

import { describe, it, expect } from "vitest";
import { renderMarkdownToHtml } from "~/lib/markdown";

describe("renderMarkdownToHtml", () => {
  it("renders headers correctly", () => {
    const md = "# Header 1\n## Header 2\n### Header 3";
    const html = renderMarkdownToHtml(md);
    expect(html).toContain("<h1>Header 1</h1>");
    expect(html).toContain("<h2>Header 2</h2>");
    expect(html).toContain("<h3>Header 3</h3>");
  });

  it("renders lists correctly", () => {
    const md = "- Item 1\n- Item 2";
    const html = renderMarkdownToHtml(md);
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>Item 1</li>");
    expect(html).toContain("<li>Item 2</li>");
    expect(html).toContain("</ul>");
  });

  it("renders inline styles", () => {
    const md = "**bold** *italic* `code`";
    const html = renderMarkdownToHtml(md);
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<code>code</code>");
  });

  it("renders links with classes", () => {
    const md = "[link](https://example.com)";
    const html = renderMarkdownToHtml(md);
    expect(html).toContain('<a href="https://example.com"');
    expect(html).toContain('class="text-primary hover:underline underline-offset-4"');
  });

  it("sanitizes javascript links (XSS)", () => {
    const md = "[click me](javascript:alert(1))";
    const html = renderMarkdownToHtml(md);
    // sanitize-html removes javascript: hrefs
    expect(html).not.toContain("javascript:alert(1)");
    expect(html).toContain("click me");
  });

  it("sanitizes malicious tags", () => {
    const md = "Normal text <script>alert(1)</script>";
    // Since we escapeHtml first, <script> becomes &lt;script&gt;
    // sanitizeHtml sees &lt;script&gt; (text) and preserves it.
    // The script is NOT executed.
    const html = renderMarkdownToHtml(md);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

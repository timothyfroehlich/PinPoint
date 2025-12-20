import { renderMarkdownToHtml } from "./markdown";
import { describe, it, expect } from "vitest";

describe("renderMarkdownToHtml", () => {
  it("renders headings", () => {
    expect(renderMarkdownToHtml("# H1")).toContain("<h1>H1</h1>");
    expect(renderMarkdownToHtml("## H2")).toContain("<h2>H2</h2>");
    expect(renderMarkdownToHtml("### H3")).toContain("<h3>H3</h3>");
  });

  it("renders lists", () => {
    const input = "- Item 1\n- Item 2";
    const output = renderMarkdownToHtml(input);
    expect(output).toContain("<ul>");
    expect(output).toContain("<li>Item 1</li>");
    expect(output).toContain("<li>Item 2</li>");
    expect(output).toContain("</ul>");
  });

  it("renders bold, italic, code", () => {
    expect(renderMarkdownToHtml("**bold**")).toContain("<strong>bold</strong>");
    expect(renderMarkdownToHtml("*italic*")).toContain("<em>italic</em>");
    expect(renderMarkdownToHtml("`code`")).toContain("<code>code</code>");
  });

  it("renders links correctly", () => {
    const input = "[Google](https://google.com)";
    const output = renderMarkdownToHtml(input);
    expect(output).toContain('href="https://google.com"');
    expect(output).toContain('class="text-primary hover:underline underline-offset-4"');
    expect(output).toContain("Google");
  });

  it("sanitizes javascript: links (XSS)", () => {
    const input = "[Click me](javascript:alert(1))";
    const output = renderMarkdownToHtml(input);
    expect(output).not.toContain("javascript:alert(1)");
    // sanitize-html removes the href attribute for disallowed schemes
    expect(output).not.toContain('href="javascript');
  });

  it("sanitizes HTML tags in input", () => {
    const input = "Normal <script>alert(1)</script>";
    const output = renderMarkdownToHtml(input);
    // escapeHtml converts < to &lt;, so sanitizeHtml sees &lt;script&gt; (text)
    // So it should render as text.
    expect(output).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(output).not.toContain("<script>");
  });
});

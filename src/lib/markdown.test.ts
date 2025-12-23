import { describe, expect, it } from "vitest";
import { renderMarkdownToHtml } from "./markdown";

describe("renderMarkdownToHtml", () => {
  it("renders headers", () => {
    expect(renderMarkdownToHtml("# Header 1")).toBe("<h1>Header 1</h1>");
    expect(renderMarkdownToHtml("## Header 2")).toBe("<h2>Header 2</h2>");
    expect(renderMarkdownToHtml("### Header 3")).toBe("<h3>Header 3</h3>");
  });

  it("renders lists", () => {
    const input = "- Item 1\n- Item 2";
    expect(renderMarkdownToHtml(input)).toBe(
      "<ul>\n<li>Item 1</li>\n<li>Item 2</li>\n</ul>"
    );
  });

  it("renders inline formatting", () => {
    expect(renderMarkdownToHtml("This is **bold** text")).toBe(
      "<p>This is <strong>bold</strong> text</p>"
    );
    expect(renderMarkdownToHtml("This is *italic* text")).toBe(
      "<p>This is <em>italic</em> text</p>"
    );
    expect(renderMarkdownToHtml("This is `code`")).toBe(
      "<p>This is <code>code</code></p>"
    );
  });

  it("renders links", () => {
    const input = "[Example](https://example.com)";
    const output = renderMarkdownToHtml(input);
    expect(output).toContain('href="https://example.com"');
    expect(output).toContain(
      'class="text-primary hover:underline underline-offset-4"'
    );
    expect(output).toContain('target="_blank"');
    expect(output).toContain('rel="noopener noreferrer"');
    expect(output).toContain(">Example</a>");
  });

  it("sanitizes dangerous tags", () => {
    const input = "<script>alert('xss')</script>";
    const output = renderMarkdownToHtml(input);
    expect(output).toBe("<p>&lt;script&gt;alert('xss')&lt;/script&gt;</p>");
  });

  it("sanitizes dangerous attributes", () => {
    const input = '<p onmouseover="alert(1)">Click me</p>';
    const output = renderMarkdownToHtml(input);
    // sanitize-html seems to decode &quot; to " in text content, which is fine as long as < is escaped
    expect(output).toBe(
      '<p>&lt;p onmouseover="alert(1)"&gt;Click me&lt;/p&gt;</p>'
    );
  });

  it("prevents javascript: URLs in links", () => {
    const input = "[XSS](javascript:alert(1))";
    const output = renderMarkdownToHtml(input);
    // sanitize-html removes the href if the protocol is not allowed
    expect(output).not.toContain("javascript:");
    expect(output).toMatch(/<a [^>]*class="[^"]*"[^>]*>XSS<\/a>/);
    expect(output).not.toContain('href="javascript:alert(1)"');
  });

  it("prevents XSS via link text", () => {
    const input = "[<script>alert(1)</script>](https://example.com)";
    const output = renderMarkdownToHtml(input);
    expect(output).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(output).not.toContain("<script>");
  });

  it("allows mailto links", () => {
    const input = "[Mail](mailto:test@example.com)";
    const output = renderMarkdownToHtml(input);
    expect(output).toContain('href="mailto:test@example.com"');
  });
});

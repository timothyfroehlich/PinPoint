// src/lib/tiptap/render.test.ts
import { describe, expect, it } from "vitest";
import { renderDocToHtml, renderDocToEmailHtml } from "./render";
import type { ProseMirrorDoc } from "./types";

describe("renderDocToHtml", () => {
  it("renders a simple paragraph", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    };
    expect(renderDocToHtml(doc)).toBe("<p>Hello world</p>");
  });

  it("renders a mention as a profile link", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hey " },
            {
              type: "mention",
              attrs: { id: "user-1", label: "Tim" },
            },
          ],
        },
      ],
    };
    const html = renderDocToHtml(doc);
    expect(html).toContain(
      '<a class="mention" href="/profile/user-1" data-mention-id="user-1">@Tim</a>'
    );
  });

  it("strips script tags", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            {
              type: "text",
              marks: [{ type: "bold" }],
              text: "<script>alert('xss')</script>",
            },
          ],
        },
      ],
    };
    const html = renderDocToHtml(doc);
    expect(html).not.toContain("<script>");
    expect(html).toContain(
      "<p>Hello <strong>&lt;script&gt;alert('xss')&lt;/script&gt;</strong></p>"
    );
  });
});

describe("renderDocToEmailHtml", () => {
  it("converts mention link to bold text", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hey " },
            {
              type: "mention",
              attrs: { id: "user-1", label: "Tim" },
            },
          ],
        },
      ],
    };
    const html = renderDocToEmailHtml(doc);
    expect(html).not.toContain("<a");
    expect(html).toContain("<strong>@Tim</strong>");
  });
});

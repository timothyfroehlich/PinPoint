// src/lib/tiptap/render.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { renderDocToHtml, RENDER_FAILED_SENTINEL } from "./render";
import type { ProseMirrorDoc } from "./types";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

describe("renderDocToHtml", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("returns the render-failed sentinel and calls Sentry when content throws", () => {
    // A doc whose content array contains null forces renderNode to access
    // .type on null, throwing a TypeError at runtime.
    const malformedDoc: ProseMirrorDoc = {
      type: "doc",
      content: [null] as unknown as ProseMirrorDoc["content"],
    };

    const html = renderDocToHtml(malformedDoc);

    expect(html).toBe(RENDER_FAILED_SENTINEL);
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledOnce();
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        contexts: { pinpoint: { action: "renderDocToHtml" } },
      })
    );
  });
});

import { describe, expect, it } from "vitest";
import { extractFirstParagraph } from "./first-paragraph";
import type { ProseMirrorDoc } from "./types";

describe("extractFirstParagraph", () => {
  it("extracts text from the first paragraph", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "First paragraph here." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Second paragraph." }],
        },
      ],
    };
    expect(extractFirstParagraph(doc)).toBe("First paragraph here.");
  });

  it("strips formatting marks (bold, italic, links)", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Bold text",
              marks: [{ type: "bold" }],
            },
            { type: "text", text: " and " },
            {
              type: "text",
              text: "italic",
              marks: [{ type: "italic" }],
            },
          ],
        },
      ],
    };
    expect(extractFirstParagraph(doc)).toBe("Bold text and italic");
  });

  it("handles mentions by using the label", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Reported by " },
            {
              type: "mention",
              attrs: { id: "user-123", label: "Tim" },
            },
          ],
        },
      ],
    };
    expect(extractFirstParagraph(doc)).toBe("Reported by @Tim");
  });

  it("joins hard breaks with spaces", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Line one" },
            { type: "hardBreak" },
            { type: "text", text: "Line two" },
          ],
        },
      ],
    };
    expect(extractFirstParagraph(doc)).toBe("Line one Line two");
  });

  it("returns empty string for null/undefined doc", () => {
    expect(extractFirstParagraph(null)).toBe("");
    expect(extractFirstParagraph(undefined)).toBe("");
  });

  it("returns empty string for empty doc", () => {
    const doc: ProseMirrorDoc = { type: "doc", content: [] };
    expect(extractFirstParagraph(doc)).toBe("");
  });

  it("returns empty string for doc with empty paragraph", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [{ type: "paragraph" }],
    };
    expect(extractFirstParagraph(doc)).toBe("");
  });

  it("skips non-paragraph first nodes (e.g., heading) and finds first paragraph", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "heading",
          content: [{ type: "text", text: "Title" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Body text" }],
        },
      ],
    };
    expect(extractFirstParagraph(doc)).toBe("Body text");
  });

  it("handles legacy plain text strings", () => {
    expect(extractFirstParagraph("Plain text value")).toBe("Plain text value");
  });
});

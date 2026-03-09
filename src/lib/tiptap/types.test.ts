// src/lib/tiptap/types.test.ts
import { describe, expect, it } from "vitest";
import {
  plainTextToDoc,
  extractMentions,
  docToPlainText,
  type ProseMirrorDoc,
} from "./types";

describe("plainTextToDoc", () => {
  it("converts single line to one paragraph", () => {
    const doc = plainTextToDoc("Hello world");
    expect(doc).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    });
  });

  it("splits double newlines into paragraphs", () => {
    const doc = plainTextToDoc("First paragraph\n\nSecond paragraph");
    expect(doc.content).toHaveLength(2);
    expect(doc.content[0].content?.[0]?.text).toBe("First paragraph");
    expect(doc.content[1].content?.[0]?.text).toBe("Second paragraph");
  });

  it("converts single newlines to hard breaks", () => {
    const doc = plainTextToDoc("Line 1\nLine 2");
    expect(doc.content).toHaveLength(1);
    const para = doc.content[0];
    expect(para.content).toHaveLength(3);
    expect(para.content?.[0]).toEqual({ type: "text", text: "Line 1" });
    expect(para.content?.[1]).toEqual({ type: "hardBreak" });
    expect(para.content?.[2]).toEqual({ type: "text", text: "Line 2" });
  });

  it("handles empty string", () => {
    const doc = plainTextToDoc("");
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].type).toBe("paragraph");
  });
});

describe("extractMentions", () => {
  it("returns empty array for doc with no mentions", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello" }],
        },
      ],
    };
    expect(extractMentions(doc)).toEqual([]);
  });

  it("extracts mention IDs from nested content", () => {
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
            { type: "text", text: " and " },
            {
              type: "mention",
              attrs: { id: "user-2", label: "Alex" },
            },
          ],
        },
      ],
    };
    expect(extractMentions(doc)).toEqual(["user-1", "user-2"]);
  });

  it("deduplicates repeated mentions", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "mention", attrs: { id: "user-1", label: "Tim" } }],
        },
        {
          type: "paragraph",
          content: [{ type: "mention", attrs: { id: "user-1", label: "Tim" } }],
        },
      ],
    };
    expect(extractMentions(doc)).toEqual(["user-1"]);
  });
});

describe("docToPlainText", () => {
  it("extracts text from paragraphs", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    };
    expect(docToPlainText(doc)).toBe("Hello world");
  });

  it("renders mentions as @label", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hey " },
            { type: "mention", attrs: { id: "user-1", label: "Tim" } },
          ],
        },
      ],
    };
    expect(docToPlainText(doc)).toBe("Hey @Tim");
  });
});

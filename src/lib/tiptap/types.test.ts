// src/lib/tiptap/types.test.ts
import { describe, expect, it } from "vitest";
import {
  plainTextToDoc,
  extractMentions,
  docToPlainText,
  docIsEmpty,
  docsEqualByText,
  isProseMirrorDoc,
  type ProseMirrorDoc,
} from "./types";

describe("isProseMirrorDoc", () => {
  it("accepts a well-formed doc", () => {
    expect(isProseMirrorDoc({ type: "doc", content: [] })).toBe(true);
    expect(
      isProseMirrorDoc({
        type: "doc",
        content: [{ type: "paragraph" }],
      })
    ).toBe(true);
  });

  it("rejects a bare { type: doc } with no content array", () => {
    expect(isProseMirrorDoc({ type: "doc" })).toBe(false);
    expect(isProseMirrorDoc({ type: "doc", content: undefined })).toBe(false);
    expect(isProseMirrorDoc({ type: "doc", content: "nope" })).toBe(false);
  });

  it("rejects a non-doc node type", () => {
    expect(isProseMirrorDoc({ type: "paragraph", content: [] })).toBe(false);
  });

  it("rejects nullish, primitive, and array values", () => {
    expect(isProseMirrorDoc(null)).toBe(false);
    expect(isProseMirrorDoc(undefined)).toBe(false);
    expect(isProseMirrorDoc("doc")).toBe(false);
    expect(isProseMirrorDoc(42)).toBe(false);
    expect(isProseMirrorDoc([])).toBe(false);
    expect(isProseMirrorDoc({})).toBe(false);
  });
});

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

  it("returns [] for null, undefined, or a malformed doc", () => {
    expect(extractMentions(null)).toEqual([]);
    expect(extractMentions(undefined)).toEqual([]);
    expect(extractMentions({ type: "doc" } as never)).toEqual([]);
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

  it("passes legacy string values through unchanged", () => {
    expect(docToPlainText("legacy plain text")).toBe("legacy plain text");
  });

  it("returns '' for null, undefined, or a malformed doc", () => {
    expect(docToPlainText(null)).toBe("");
    expect(docToPlainText(undefined)).toBe("");
    expect(docToPlainText({ type: "doc" } as never)).toBe("");
  });
});

describe("docIsEmpty", () => {
  it("treats a bare { type: doc } (no content) as empty without crashing", () => {
    expect(docIsEmpty({ type: "doc" } as never)).toBe(true);
  });
  it("treats a single empty paragraph as empty", () => {
    expect(docIsEmpty({ type: "doc", content: [{ type: "paragraph" }] })).toBe(
      true
    );
  });
  it("treats a paragraph with text as non-empty", () => {
    expect(
      docIsEmpty({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "x" }] },
        ],
      })
    ).toBe(false);
  });
});

describe("docsEqualByText", () => {
  it("ignores whitespace-only differences", () => {
    const a: ProseMirrorDoc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
    };
    const b: ProseMirrorDoc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "hi  " }] },
      ],
    };
    expect(docsEqualByText(a, b)).toBe(true);
  });
  it("null and empty doc are text-equal", () => {
    expect(
      docsEqualByText(null, { type: "doc", content: [{ type: "paragraph" }] })
    ).toBe(true);
  });
});

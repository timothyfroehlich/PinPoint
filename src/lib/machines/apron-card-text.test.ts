import { describe, expect, it } from "vitest";
import {
  cardTextBlocks,
  cardTextDoc,
  cardTextLength,
  plainCardText,
} from "~/lib/machines/apron-card-text";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

const description: ProseMirrorDoc = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Rules" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Shoot the " },
        { type: "text", text: "ramps", marks: [{ type: "bold" }] },
        { type: "text", text: " and read " },
        {
          type: "text",
          text: "the guide",
          marks: [{ type: "link", attrs: { href: "https://example.test" } }],
        },
        { type: "hardBreak" },
        { type: "text", text: "Ask " },
        { type: "mention", attrs: { id: "u1", label: "Tim" } },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Lock", marks: [{ type: "italic" }] },
              ],
            },
          ],
        },
        { type: "listItem", content: [{ type: "paragraph" }] },
      ],
    },
    { type: "paragraph" },
  ],
};

describe("cardTextBlocks (spec apron-cards §3.7)", () => {
  it("keeps bold, italic, and lists; prints headings, links, and mentions as plain text", () => {
    expect(cardTextBlocks(description)).toEqual([
      { kind: "paragraph", runs: [{ text: "Rules" }] },
      {
        kind: "paragraph",
        runs: [
          { text: "Shoot the " },
          { text: "ramps", bold: true },
          { text: " and read the guide" },
          { text: "\n" },
          { text: "Ask @Tim" },
        ],
      },
      {
        kind: "list",
        ordered: false,
        items: [[{ text: "Lock", italic: true }]],
      },
    ]);
  });

  it("reads a missing doc as no text", () => {
    expect(cardTextBlocks(null)).toEqual([]);
  });
});

describe("cardTextDoc", () => {
  it("stores only what the card prints, and round-trips", () => {
    const doc = cardTextDoc(description);
    expect(doc?.content.map((node) => node.type)).toEqual([
      "paragraph",
      "paragraph",
      "bulletList",
    ]);
    expect(cardTextBlocks(doc)).toEqual(cardTextBlocks(description));
  });

  it("stores null for text that is only whitespace", () => {
    expect(
      cardTextDoc({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "  " }] },
        ],
      })
    ).toBeNull();
  });
});

describe("plainCardText and cardTextLength", () => {
  it("makes one paragraph per line and counts characters", () => {
    const blocks = plainCardText("One.\n\n  Two.  \n");
    expect(blocks).toEqual([
      { kind: "paragraph", runs: [{ text: "One." }] },
      { kind: "paragraph", runs: [{ text: "Two." }] },
    ]);
    expect(cardTextLength(blocks)).toBe(8);
  });
});
